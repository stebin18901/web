import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { RecaptchaVerifier, createUserWithEmailAndPassword, signInWithPhoneNumber, signOut } from "firebase/auth";
import { auth, db } from "../../../firebase/firebaseConfig";
import {
  MAX_PARENT_ACCOUNTS_PER_PHONE,
  getUniqueClasses,
} from "../../../config/defaultSchool";
import { fetchDemoContent } from "../../../utils/demoContent";
import "./ClassIntakeForm.css";

const normalize = (v) => String(v || "").trim();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const PHONE_PLACEHOLDER = "Phone Number (10 digits, e.g. 9876543210)";
const hasPaidSchoolAccess = (schoolData) => {
  const rawStatus =
    schoolData?.isPaidSchool ?? schoolData?.isPaid ?? schoolData?.paymentStatus ?? schoolData?.status;
  if (typeof rawStatus === "boolean") return rawStatus;
  const normalizedStatus = String(rawStatus || "").trim().toLowerCase();
  return ["paid", "active", "true", "yes"].includes(normalizedStatus);
};

export default function ClassIntakeForm() {
  const navigate = useNavigate();
  const { schoolId, className, type } = useParams();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("School");
  const [schoolMeta, setSchoolMeta] = useState({});
  const [paymentLinkToShow, setPaymentLinkToShow] = useState("");
  const [availableClassOptions, setAvailableClassOptions] = useState([]);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [otpNotice, setOtpNotice] = useState("");
  const [lastOtpRequestTime, setLastOtpRequestTime] = useState(0);
  const [demoTitle, setDemoTitle] = useState("Demo");
  const [hasDemoContent, setHasDemoContent] = useState(false);
  const OTP_COOLDOWN_MS = 60000;

  const schoolIdValue = useMemo(() => normalize(schoolId), [schoolId]);
  const normalizedSchoolId = useMemo(() => schoolIdValue.toLowerCase(), [schoolIdValue]);
  const normalizedClassName = useMemo(() => normalize(className).toUpperCase(), [className]);
  const formType = type === "teacher" ? "teacher" : "student";
  const studentClassOptions = useMemo(
    () => getUniqueClasses(availableClassOptions),
    [availableClassOptions]
  );

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    className: "",
    phone: "",
    pin: "",
  });

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    className: "",
    password: "",
  });

  useEffect(() => {
    const fetchSchoolMeta = async () => {
      if (!schoolIdValue && !normalizedSchoolId) return;
      try {
        let schoolSnap = schoolIdValue ? await getDoc(doc(db, "schools", schoolIdValue)) : null;
        if ((!schoolSnap || !schoolSnap.exists()) && normalizedSchoolId) {
          schoolSnap = await getDoc(doc(db, "schools", normalizedSchoolId));
        }

        if (schoolSnap?.exists()) {
          const data = schoolSnap.data();
          setSchoolMeta(data);
          setSchoolName(data.schoolName || "School");
        } else {
          setSchoolMeta({});
          setSchoolName("School");
        }

        const classesSnap = await getDocs(collection(db, "classes"));
        const discoveredClasses = classesSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => {
            const entrySchoolId = String(entry.schoolId || entry.schoolIdRaw || "").trim().toLowerCase();
            return entrySchoolId === normalizedSchoolId;
          })
          .map((entry) => String(entry.className || "").toUpperCase())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        setAvailableClassOptions(discoveredClasses);
        const defaultStudentClassName =
          discoveredClasses.includes(normalizedClassName) ? normalizedClassName : discoveredClasses[0] || "";
        const defaultTeacherClassName = normalizedClassName || discoveredClasses[0] || "";
        setStudentForm((prev) => ({
          ...prev,
          className: prev.className || defaultStudentClassName,
        }));
        setTeacherForm((prev) => ({
          ...prev,
          className: prev.className || defaultTeacherClassName,
        }));
      } catch {
        setSchoolName("School");
      }
    };

    fetchSchoolMeta();
  }, [normalizedClassName, normalizedSchoolId, schoolIdValue]);

  useEffect(() => {
    return () => {
      if (window.classIntakeRecaptchaVerifier) {
        try {
          window.classIntakeRecaptchaVerifier.clear();
        } catch {
          // Ignore cleanup failures
        }
        window.classIntakeRecaptchaVerifier = null;
      }
    };
  }, []);

  useEffect(() => {
    const loadDemoContent = async () => {
      try {
        const data = await fetchDemoContent();
        setDemoTitle(data.title || "Demo");
        setHasDemoContent(Boolean(String(data.html || "").trim()));
      } catch {
        setHasDemoContent(false);
      }
    };

    loadDemoContent();
  }, []);

  const clearRecaptchaVerifier = () => {
    if (window.classIntakeRecaptchaVerifier) {
      try {
        window.classIntakeRecaptchaVerifier.clear();
      } catch {
        // Ignore cleanup failures
      }
      window.classIntakeRecaptchaVerifier = null;
    }
    const container = document.getElementById("class-intake-recaptcha");
    if (container) {
      container.innerHTML = '<div id="class-intake-recaptcha-inner"></div>';
    }
  };

  const resetOtpState = () => {
    clearRecaptchaVerifier();
    setOtpCode("");
    setOtpSent(false);
    setOtpVerified(false);
    setConfirmationResult(null);
    setOtpNotice("");
    setLastOtpRequestTime(0);
  };

  const resendOtp = async () => {
    const cleanPhone = normalizePhone(studentForm.phone);
    if (cleanPhone.length !== 10) {
      setStatus("Invalid phone number format. Use 10 digits, for example 9876543210.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      setOtpCode("");
      setOtpVerified(false);
      setConfirmationResult(null);
      setOtpNotice("");
      setLastOtpRequestTime(0);
      await sendOtp(cleanPhone);
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async (cleanPhone) => {
    try {
      const now = Date.now();
      const elapsed = now - lastOtpRequestTime;
      if (lastOtpRequestTime > 0 && elapsed < OTP_COOLDOWN_MS) {
        const secs = Math.ceil((OTP_COOLDOWN_MS - elapsed) / 1000);
        setStatus(`Please wait ${secs} seconds before requesting another OTP.`);
        return false;
      }

      clearRecaptchaVerifier();
      await signOut(auth).catch(() => {});

      const verifierContainer = document.getElementById("class-intake-recaptcha-inner");
      if (!verifierContainer) {
        setStatus("reCAPTCHA container not found. Please refresh the page.");
        return false;
      }

      auth.languageCode = "en";
      window.classIntakeRecaptchaVerifier = new RecaptchaVerifier(
        auth,
        "class-intake-recaptcha-inner",
        {
          size: "invisible",
          callback: () => {
            setStatus("");
          },
          "expired-callback": () => {
            setStatus("reCAPTCHA expired. Please try sending OTP again.");
            clearRecaptchaVerifier();
          },
        }
      );

      const confirmation = await signInWithPhoneNumber(
        auth,
        `+91${cleanPhone}`,
        window.classIntakeRecaptchaVerifier
      );

      setLastOtpRequestTime(Date.now());
      setConfirmationResult(confirmation);
      setOtpSent(true);
      setOtpVerified(false);
      setOtpNotice("OTP sent to this phone number.");
      setStatus("");
      return true;
    } catch (err) {
      console.error("Error sending class intake OTP:", err);
      clearRecaptchaVerifier();

      let message = "Failed to send OTP. Please try again.";
      if (err.code === "auth/too-many-requests") {
        message = "Too many OTP requests. Please wait a few minutes before trying again.";
      } else if (err.code === "auth/invalid-phone-number") {
        message = "Invalid phone number format. Use 10 digits, for example 9876543210.";
      } else if (err.code === "auth/operation-not-allowed") {
        message = "Phone authentication is not enabled. Please contact support.";
      } else if (err.message) {
        message = err.message;
      }

      setStatus(message);
      return false;
    }
  };

  const verifyOtp = async () => {
    if (!confirmationResult) {
      setStatus("Please send OTP first.");
      return false;
    }
    if (otpCode.trim().length < 4) {
      setStatus("Enter the OTP.");
      return false;
    }

    try {
      await confirmationResult.confirm(otpCode.trim());
      setOtpVerified(true);
      setOtpNotice("Phone number verified.");
      return true;
    } catch {
      setStatus("Invalid OTP. Please try again.");
      return false;
    }
  };

  const ensureClassExists = async (selectedClassName, options = {}) => {
    const { allowCreate = true } = options;
    const resolvedClassName = normalize(selectedClassName || normalizedClassName).toUpperCase();
    const classId = `${schoolIdValue || normalizedSchoolId}_${resolvedClassName}`;
    const classRef = doc(db, "classes", classId);
    const classSnap = await getDoc(classRef);

    if (!classSnap.exists()) {
      if (!allowCreate) {
        throw new Error("Selected class or division is not available for this school.");
      }
      const grade = parseInt(resolvedClassName.match(/^\d+/)?.[0] || "0", 10);
      await setDoc(classRef, {
        schoolId: schoolIdValue || normalizedSchoolId,
        className: resolvedClassName,
        grade,
        division: resolvedClassName.replace(/^\d+/, "") || "A",
        createdAt: new Date(),
        source: "public_form",
      });
    }

    return classId;
  };

  const findExistingTeacher = async (emailValue) => {
    const normalizedEmail = normalize(emailValue).toLowerCase();
    if (!normalizedEmail) return null;

    const teacherQuery = query(
      collection(db, "users"),
      where("schoolId", "==", schoolIdValue || normalizedSchoolId)
    );
    const snap = await getDocs(teacherQuery);
    const match = snap.docs.find((entry) => normalize(entry.data()?.email).toLowerCase() === normalizedEmail);
    return match ? { id: match.id, ...match.data() } : null;
  };

  const getLinkedAccountsForPhone = async (cleanPhone) => {
    const phoneQuery = query(
      collection(db, "defaultSchoolEnrollments"),
      where("phone", "==", cleanPhone)
    );
    const snap = await getDocs(phoneQuery);

    return snap.docs
      .map((entry) => ({
        id: entry.id,
        ...entry.data(),
      }))
      .filter((entry) => normalize(entry.schoolId).toLowerCase() === normalizedSchoolId);
  };

  const submitStudent = async (e) => {
    e.preventDefault();
    const selectedClassName = normalize(studentForm.className || normalizedClassName).toUpperCase();
    const cleanPhone = normalizePhone(studentForm.phone);
    const cleanPin = normalize(studentForm.pin);
    const schoolIsPaid = hasPaidSchoolAccess(schoolMeta);
    const selectedPlanId = schoolMeta.selectedPlanId || "";
    const selectedPlanName = schoolMeta.selectedPlanName || "";
    const planAmount = Number(schoolMeta.planAmount || 0);
    const feeCollectionCycle = normalize(schoolMeta.feeCollectionCycle || "monthly").toLowerCase() || "monthly";
    const feeAmount = Number(schoolMeta.feeAmount || 0);
    const paymentStatus = schoolIsPaid ? "paid" : "pending_plan_selection";
    const registrationStatus = schoolIsPaid ? "active" : "pending_plan_selection";
    const studentIsPaid = schoolIsPaid;
    const feeStatus = schoolIsPaid ? "pending" : "not_applicable";

    if (!studentForm.fullName || !selectedClassName || !cleanPin || !cleanPhone) {
      setStatus("Please fill name, class, PIN, and phone number.");
      return;
    }

    if (cleanPhone.length !== 10) {
      setStatus("Invalid phone number format. Use 10 digits, for example 9876543210.");
      return;
    }

    if (cleanPin.length < 4) {
      setStatus("Enter a PIN with at least 4 characters.");
      return;
    }

    setLoading(true);
    setStatus("");
    setPaymentLinkToShow("");

    try {
      if (!otpSent) {
        const sent = await sendOtp(cleanPhone);
        if (!sent) {
          setLoading(false);
          return;
        }
        setLoading(false);
        return;
      }

      if (!otpVerified) {
        const verified = await verifyOtp();
        if (!verified) {
          setLoading(false);
          return;
        }
      }

      const linkedAccounts = await getLinkedAccountsForPhone(cleanPhone);
      if (!studentClassOptions.includes(selectedClassName)) {
        throw new Error("This class or division is not active yet. Ask the school admin to create it first.");
      }

      const classId = await ensureClassExists(selectedClassName, { allowCreate: false });
      const fullName = normalize(studentForm.fullName);

      const studentQuery = query(
        collection(db, "studentAccounts"),
        where("schoolId", "==", normalizedSchoolId)
      );
      const studentSnap = await getDocs(studentQuery);
      const classStudents = studentSnap.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((entry) => normalize(entry.className).toUpperCase() === selectedClassName);
      const nextRoll = classStudents.reduce((maxRoll, entry) => {
        const rollValue = Number(normalize(entry.rollNumber));
        return Number.isFinite(rollValue) ? Math.max(maxRoll, rollValue) : maxRoll;
      }, 0) + 1;
      const roll = String(nextRoll);
      const enrollmentId = `${normalizedSchoolId}_${selectedClassName}_${roll}`;
      const currentLinkedAccount = linkedAccounts.find((entry) => entry.id === enrollmentId);

      if (!currentLinkedAccount && linkedAccounts.length >= MAX_PARENT_ACCOUNTS_PER_PHONE) {
        setStatus(`A single parent phone number can be linked to a maximum of ${MAX_PARENT_ACCOUNTS_PER_PHONE} child accounts.`);
        return;
      }

      const studentPayload = {
        fullName,
        className: selectedClassName,
        rollNumber: roll,
        phone: cleanPhone,
        parentPhone: cleanPhone,
        parentAccountKey: `${normalizedSchoolId}_${cleanPhone}`,
        pin: cleanPin,
        schoolId: normalizedSchoolId,
        schoolIdRaw: schoolIdValue || normalizedSchoolId,
        schoolName,
        selectedPlanId,
        selectedPlanName,
        planAmount,
        isPaid: studentIsPaid,
        createdAt: new Date(),
        source: "class_form",
        paymentStatus,
        registrationStatus,
        feeStatus,
        feeCollectionCycle,
        feeAmount,
        feePaidAmount: 0,
        feePendingAmount: schoolIsPaid ? feeAmount : 0,
      };

      await setDoc(doc(db, "studentAccounts", enrollmentId), studentPayload, { merge: true });

      await setDoc(
        doc(db, "defaultSchoolEnrollments", enrollmentId),
        {
          phone: cleanPhone,
          parentPhone: cleanPhone,
          parentAccountKey: `${normalizedSchoolId}_${cleanPhone}`,
          name: fullName,
          schoolId: normalizedSchoolId,
          schoolName,
          className: selectedClassName,
          accessMode: "school-plan",
          selectedClasses: [selectedClassName],
          pin: cleanPin,
          selectedPlanId,
          selectedPlanName,
          planAmount,
          isPaid: studentIsPaid,
          paymentStatus,
          registrationStatus,
          feeStatus,
          feeCollectionCycle,
          feeAmount,
          feePaidAmount: 0,
          feePendingAmount: schoolIsPaid ? feeAmount : 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "classes", classId, "students", roll),
        {
          rollNumber: roll,
          name: fullName,
          phone: cleanPhone,
          parentPhone: cleanPhone,
          className: selectedClassName,
          createdAt: new Date(),
          source: "class_form",
          pin: cleanPin,
          selectedPlanId,
          selectedPlanName,
          planAmount,
          isPaid: studentIsPaid,
          paymentStatus,
          registrationStatus,
          feeStatus,
          feeCollectionCycle,
          feeAmount,
          feePaidAmount: 0,
          feePendingAmount: schoolIsPaid ? feeAmount : 0,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "studentRegistrationRequests", enrollmentId),
        {
          ...studentPayload,
          submittedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStatus(
        schoolIsPaid
          ? `Details saved for ${selectedClassName}. Roll number ${roll} was assigned automatically and the student can log in directly.`
          : `Details saved for ${selectedClassName}. Roll number ${roll} was assigned automatically. Continue to choose a plan.`
      );
      setStudentForm({
        fullName: "",
        className: studentClassOptions.includes(normalizedClassName)
          ? normalizedClassName
          : studentClassOptions[0] || "",
        phone: "",
        pin: "",
      });
      resetOtpState();

      if (schoolIsPaid) {
        navigate("/login", { replace: true });
      } else {
        navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`, { replace: true });
      }
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitTeacher = async (e) => {
    e.preventDefault();
    const teacherEmail = normalize(teacherForm.email).toLowerCase();
    const teacherName = normalize(teacherForm.name);
    const teacherSubject = normalize(teacherForm.subject);
    const teacherPassword = String(teacherForm.password || "");

    if (!teacherName || !teacherEmail || !teacherPassword) {
      setStatus("Please fill teacher name, email, and password.");
      return;
    }

    if (teacherPassword.length < 6) {
      setStatus("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const existingTeacher = await findExistingTeacher(teacherEmail);
      let teacherId = existingTeacher?.uid || "";

      if (existingTeacher?.uid) {
        setStatus("This teacher account already exists. Please use the teacher login page.");
        setLoading(false);
        return;
      }

      const teacherPayload = {
        name: teacherName,
        email: teacherEmail,
        phone: normalize(teacherForm.phone),
        subject: teacherSubject,
        role: "teacher",
        schoolId: schoolIdValue || normalizedSchoolId,
        assignedClass: existingTeacher?.assignedClass || "",
        assignedClasses: Array.from(new Set(existingTeacher?.assignedClasses || [])),
        source: "class_form",
        updatedAt: new Date(),
      };

      await signOut(auth).catch(() => {});
      const credential = await createUserWithEmailAndPassword(auth, teacherEmail, teacherPassword);
      teacherId = credential.user.uid;

      await setDoc(doc(db, "users", teacherId), {
        uid: teacherId,
        ...teacherPayload,
        createdAt: existingTeacher?.createdAt || new Date(),
      }, { merge: true });

      if (existingTeacher && existingTeacher.id !== teacherId) {
        await updateDoc(doc(db, "users", existingTeacher.id), {
          migratedToUid: teacherId,
          updatedAt: new Date(),
        }).catch(() => {});
      }

      await signOut(auth).catch(() => {});

      setStatus("Teacher account created successfully. Class assignment can be handled later from the school dashboard.");
      setTeacherForm({ name: "", email: "", phone: "", subject: "", className: "", password: "" });
      navigate("/teacher-login", { replace: true });
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="class-intake-page">
      <div className="class-intake-card">
        <h1>{formType === "student" ? "Student Registration" : "Teacher Details Form"}</h1>
        <p>
          School: <strong>{schoolName}</strong>
        </p>
        {hasDemoContent && (
          <button
            type="button"
            className="demo-link-button"
            onClick={() => window.open("/demo-view", "_blank", "noopener,noreferrer")}
          >
            View {demoTitle}
          </button>
        )}

        {formType === "student" && (
          <div className="plan-summary-card">
            <div>
              <span className="meta-label">Plan Selection</span>
              <strong>{hasPaidSchoolAccess(schoolMeta) ? "Handled by school" : "Choose after form submission"}</strong>
            </div>
            <div>
              <span className="meta-label">What happens next</span>
              <strong>
                {hasPaidSchoolAccess(schoolMeta)
                  ? "OTP, details saved, direct activation"
                  : "OTP, details saved, plan choice, payment"}
              </strong>
            </div>
          </div>
        )}

        {formType === "student" && (
          <p className="status-message" style={{ marginTop: 12 }}>
            Parent phone number can be linked to up to {MAX_PARENT_ACCOUNTS_PER_PHONE} child accounts.
          </p>
        )}

        {formType === "student" ? (
          <form onSubmit={submitStudent} className="intake-form">
            <input
              value={studentForm.fullName}
              onChange={(e) => setStudentForm((p) => ({ ...p, fullName: e.target.value }))}
              placeholder="Student Name"
            />
            <select
              value={studentForm.className || normalizedClassName || ""}
              onChange={(e) => setStudentForm((p) => ({ ...p, className: e.target.value }))}
              disabled={!studentClassOptions.length}
            >
              <option value="">{studentClassOptions.length ? "Select Class / Division" : "No classes available yet"}</option>
              {studentClassOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {!studentClassOptions.length ? (
              <p className="helper-note">No active classes found yet. Please ask the school admin to create classes first.</p>
            ) : null}
            <p className="helper-note">Roll number will be assigned automatically based on the next available number in the selected class.</p>
            <input
              value={studentForm.pin}
              onChange={(e) => {
                setStudentForm((p) => ({ ...p, pin: e.target.value }));
                if (otpSent || otpVerified) resetOtpState();
              }}
              placeholder="Create PIN"
              type="password"
            />
            <input
              value={studentForm.phone}
              onChange={(e) => {
                setStudentForm((p) => ({ ...p, phone: normalizePhone(e.target.value) }));
                if (otpSent || otpVerified) resetOtpState();
              }}
              placeholder={PHONE_PLACEHOLDER}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
            />
            {otpSent && (
              <>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter OTP"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={resendOtp}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Resend OTP"}
                </button>
              </>
            )}
            {otpNotice && <p className="otp-notice">{otpNotice}</p>}
            <button type="submit" disabled={loading}>
              {loading
                ? !otpSent
                  ? "Sending OTP..."
                  : !otpVerified
                  ? "Verifying OTP..."
                  : "Opening plans..."
                : !otpSent
                ? "Send OTP"
                : !otpVerified
                ? "Verify OTP & Continue"
                : "Continue to Plans"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitTeacher} className="intake-form">
            <p className="helper-note">Create the teacher account first. Class and subject assignment can be managed later from the school admin dashboard.</p>
            <input
              value={teacherForm.name}
              onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Teacher Name"
            />
            <input
              value={teacherForm.email}
              onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))}
              placeholder="Teacher Email"
            />
            <input
              value={teacherForm.password}
              onChange={(e) => setTeacherForm((p) => ({ ...p, password: e.target.value }))}
              placeholder="Create Password"
              type="password"
            />
            <input
              value={teacherForm.phone}
              onChange={(e) => setTeacherForm((p) => ({ ...p, phone: normalizePhone(e.target.value) }))}
              placeholder="Phone (optional, 10 digits)"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
            />
            <input
              value={teacherForm.subject}
              onChange={(e) => setTeacherForm((p) => ({ ...p, subject: e.target.value }))}
              placeholder="Subject (optional)"
            />
            <button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Teacher"}
            </button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
        <div id="class-intake-recaptcha">
          <div id="class-intake-recaptcha-inner"></div>
        </div>

        {paymentLinkToShow && (
          <a
            className="payment-link-button"
            href={paymentLinkToShow}
            target="_blank"
            rel="noreferrer"
          >
            Open payment link
          </a>
        )}
      </div>
    </div>
  );
}
