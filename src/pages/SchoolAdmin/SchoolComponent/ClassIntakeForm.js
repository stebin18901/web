import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { RecaptchaVerifier, signInWithPhoneNumber, signOut } from "firebase/auth";
import { auth, db } from "../../../firebase/firebaseConfig";
import {
  DEFAULT_SCHOOL_CLASS_OPTIONS,
  MAX_PARENT_ACCOUNTS_PER_PHONE,
  getUniqueClasses,
} from "../../../config/defaultSchool";
import { fetchDemoContent } from "../../../utils/demoContent";
import "./ClassIntakeForm.css";

const normalize = (v) => String(v || "").trim();
const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const PHONE_PLACEHOLDER = "Phone Number (10 digits, e.g. 9876543210)";

export default function ClassIntakeForm() {
  const navigate = useNavigate();
  const { schoolId, className, type } = useParams();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("School");
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
  const classOptions = useMemo(
    () =>
      getUniqueClasses([
        normalizedClassName,
        ...availableClassOptions,
        ...DEFAULT_SCHOOL_CLASS_OPTIONS.map((value) => String(value)),
      ]),
    [availableClassOptions, normalizedClassName]
  );

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    className: "",
    rollNumber: "",
    phone: "",
    pin: "",
  });

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    className: "",
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
          setSchoolName(data.schoolName || "School");
        } else {
          setSchoolName("School");
        }

        const classesSnap = await getDocs(
          query(collection(db, "classes"), where("schoolId", "==", schoolIdValue || normalizedSchoolId))
        );
        const discoveredClasses = classesSnap.docs
          .map((entry) => String(entry.data()?.className || "").toUpperCase())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        setAvailableClassOptions(discoveredClasses);
        const defaultClassName = normalizedClassName || discoveredClasses[0] || DEFAULT_SCHOOL_CLASS_OPTIONS[0] || "";
        setStudentForm((prev) => ({
          ...prev,
          className: prev.className || defaultClassName,
        }));
        setTeacherForm((prev) => ({
          ...prev,
          className: prev.className || defaultClassName,
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

  const ensureClassExists = async (selectedClassName) => {
    const resolvedClassName = normalize(selectedClassName || normalizedClassName).toUpperCase();
    const classId = `${schoolIdValue || normalizedSchoolId}_${resolvedClassName}`;
    const classRef = doc(db, "classes", classId);
    const classSnap = await getDoc(classRef);

    if (!classSnap.exists()) {
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

    if (!studentForm.fullName || !selectedClassName || !studentForm.rollNumber || !cleanPin || !cleanPhone) {
      setStatus("Please fill name, class, roll number, PIN, and phone number.");
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
      const classId = await ensureClassExists(selectedClassName);
      const roll = normalize(studentForm.rollNumber);
      const enrollmentId = `${normalizedSchoolId}_${selectedClassName}_${roll}`;
      const fullName = normalize(studentForm.fullName);
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
        createdAt: new Date(),
        source: "class_form",
        paymentStatus: "pending_plan_selection",
        registrationStatus: "pending_plan_selection",
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
          isPaid: false,
          paymentStatus: "pending_plan_selection",
          registrationStatus: "pending_plan_selection",
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
          paymentStatus: "pending_plan_selection",
          registrationStatus: "pending_plan_selection",
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

      setStatus(`Details saved for ${selectedClassName}. Continue to choose a plan.`);
      setStudentForm({
        fullName: "",
        className: normalizedClassName || classOptions[0] || "",
        rollNumber: "",
        phone: "",
        pin: "",
      });
      resetOtpState();

      navigate(`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`, { replace: true });
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitTeacher = async (e) => {
    e.preventDefault();
    const selectedClassName = normalize(teacherForm.className || normalizedClassName || classOptions[0]).toUpperCase();

    if (!teacherForm.name || !teacherForm.email || !selectedClassName) {
      setStatus("Please fill teacher name, email, and class/division.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const classId = await ensureClassExists(selectedClassName);
      const teacherRef = await addDoc(collection(db, "users"), {
        name: normalize(teacherForm.name),
        email: normalize(teacherForm.email).toLowerCase(),
        phone: normalize(teacherForm.phone),
        subject: normalize(teacherForm.subject),
        role: "teacher",
        schoolId: schoolIdValue || normalizedSchoolId,
        assignedClass: selectedClassName,
        createdAt: new Date(),
        source: "class_form",
      });

      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      const currentTeam = classSnap.exists() && Array.isArray(classSnap.data().team) ? classSnap.data().team : [];
      const nextTeam = [
        ...currentTeam,
        {
          userId: teacherRef.id,
          name: normalize(teacherForm.name),
          email: normalize(teacherForm.email).toLowerCase(),
          subjects: teacherForm.subject ? [normalize(teacherForm.subject)] : [],
        },
      ];

      await setDoc(classRef, { team: nextTeam, updatedAt: new Date() }, { merge: true });

      setStatus("Teacher details submitted successfully.");
      setTeacherForm({ name: "", email: "", phone: "", subject: "", className: normalizedClassName || classOptions[0] || "" });
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
              <strong>Choose after form submission</strong>
            </div>
            <div>
              <span className="meta-label">What happens next</span>
              <strong>OTP, details saved, plan choice, payment</strong>
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
            >
              <option value="">Select Class / Division</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <input
              value={studentForm.rollNumber}
              onChange={(e) => setStudentForm((p) => ({ ...p, rollNumber: e.target.value }))}
              placeholder="Roll Number"
            />
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
            <select
              value={teacherForm.className || normalizedClassName || ""}
              onChange={(e) => setTeacherForm((p) => ({ ...p, className: e.target.value }))}
            >
              <option value="">Select Class / Division</option>
              {classOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
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
