import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  CREATE_PAYMENT_LINK_URL,
  DEFAULT_SCHOOL_CLASS_OPTIONS,
  getDefaultSchoolPlan,
  getUniqueClasses,
} from "../../../config/defaultSchool";
import "./ClassIntakeForm.css";

const normalize = (v) => String(v || "").trim();

export default function ClassIntakeForm() {
  const { schoolId, className, type } = useParams();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("School");
  const [schoolConfig, setSchoolConfig] = useState({
    selectedPlanId: "",
    selectedPlanName: "",
    planAmount: 0,
  });
  const [paymentLinkToShow, setPaymentLinkToShow] = useState("");

  const schoolIdValue = useMemo(() => normalize(schoolId), [schoolId]);
  const normalizedSchoolId = useMemo(() => schoolIdValue.toLowerCase(), [schoolIdValue]);
  const normalizedClassName = useMemo(() => normalize(className).toUpperCase(), [className]);
  const formType = type === "teacher" ? "teacher" : "student";
  const classOptions = useMemo(
    () =>
      getUniqueClasses([
        normalizedClassName,
        ...DEFAULT_SCHOOL_CLASS_OPTIONS.map((value) => String(value)),
      ]),
    [normalizedClassName]
  );

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    className: "",
    rollNumber: "",
  });

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
  });

  useEffect(() => {
    const fetchSchoolMeta = async () => {
      if (!schoolIdValue && !normalizedSchoolId) return;
      try {
        let snap = schoolIdValue ? await getDoc(doc(db, "schools", schoolIdValue)) : null;
        if ((!snap || !snap.exists()) && normalizedSchoolId) {
          snap = await getDoc(doc(db, "schools", normalizedSchoolId));
        }
        if (snap?.exists()) {
          const data = snap.data();
          const plan = getDefaultSchoolPlan(data.selectedPlanId);
          setSchoolName(data.schoolName || "School");
          setSchoolConfig({
            selectedPlanId: data.selectedPlanId || "",
            selectedPlanName: data.selectedPlanName || plan.name || "No plan selected",
            planAmount: Number(data.planAmount || plan.amount || 0),
          });
          setStudentForm((prev) => ({
            ...prev,
            className: prev.className || normalizedClassName || classOptions[0] || "",
          }));
        } else {
          setSchoolName("School");
        }
      } catch {
        setSchoolName("School");
      }
    };

    fetchSchoolMeta();
  }, [classOptions, normalizedClassName, schoolIdValue, normalizedSchoolId]);

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

  const generatePaymentLink = async ({ enrollmentId, fullName, roll, planAmount, selectedClassName }) => {
    const paymentCallback = `${window.location.origin}/payment-success?defaultStudentId=${encodeURIComponent(enrollmentId)}`;
    const response = await fetch(CREATE_PAYMENT_LINK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: enrollmentId,
        studentId: enrollmentId,
        studentAccountId: enrollmentId,
        name: fullName,
        purpose: "defaultSchool",
        amount: planAmount,
        schoolId: normalizedSchoolId,
        schoolName,
        className: selectedClassName,
        rollNumber: roll,
        planId: schoolConfig.selectedPlanId,
        planName: schoolConfig.selectedPlanName,
        callbackUrl: paymentCallback,
      }),
    });

    const paymentData = await response.json();
    if (!response.ok) {
      throw new Error(paymentData.error || "Failed to create payment link");
    }

    const paymentUrl = resolvePaymentUrl(paymentData);
    if (!paymentUrl) {
      throw new Error("No payment link returned.");
    }

    return { ...paymentData, paymentUrl };
  };

  const resolvePaymentUrl = (paymentData) =>
    normalize(
      paymentData?.payment_url ||
        paymentData?.short_url ||
        paymentData?.url ||
        paymentData?.link ||
        paymentData?.paymentLink ||
        ""
    );

  const submitStudent = async (e) => {
    e.preventDefault();
    const selectedClassName = normalize(studentForm.className || normalizedClassName).toUpperCase();

    if (!studentForm.fullName || !selectedClassName || !studentForm.rollNumber) {
      setStatus("Please fill name, class, and roll number.");
      return;
    }

    setLoading(true);
    setStatus("");
    setPaymentLinkToShow("");

    try {
      const classId = await ensureClassExists(selectedClassName);
      const roll = normalize(studentForm.rollNumber);
      const plan = getDefaultSchoolPlan(schoolConfig.selectedPlanId);
      const planAmount = Number(schoolConfig.planAmount || plan.amount || 0);
      if (!planAmount) {
        setStatus("Please configure a school plan before collecting payments.");
        return;
      }

      const enrollmentId = `${normalizedSchoolId}_${selectedClassName}_${roll}`;
      const fullName = normalize(studentForm.fullName);
      const paymentData = await generatePaymentLink({
        enrollmentId,
        fullName,
        roll,
        planAmount,
        selectedClassName,
      });
      const paymentUrl = paymentData.paymentUrl;
      const autoPin = roll;

      const studentPayload = {
        fullName,
        className: selectedClassName,
        rollNumber: roll,
        pin: autoPin,
        schoolId: normalizedSchoolId,
        schoolIdRaw: schoolIdValue || normalizedSchoolId,
        schoolName,
        createdAt: new Date(),
        source: "class_form",
        selectedPlanId: schoolConfig.selectedPlanId || "",
        selectedPlanName: schoolConfig.selectedPlanName || "",
        planAmount,
        paymentStatus: "pending",
        registrationStatus: "pending_payment",
        paymentLinkId: paymentData.paymentLinkId || "",
        paymentUrl,
      };

      await setDoc(doc(db, "studentAccounts", enrollmentId), studentPayload, {
        merge: true,
      });

      await setDoc(
        doc(db, "defaultSchoolEnrollments", enrollmentId),
        {
          phone: "",
          name: fullName,
          schoolId: normalizedSchoolId,
          schoolName,
          className: selectedClassName,
          rollNumber: roll,
          accessMode: "school-plan",
          selectedClasses: [selectedClassName],
          selectedPlanId: schoolConfig.selectedPlanId || "",
          selectedPlanName: schoolConfig.selectedPlanName || "",
          planId: schoolConfig.selectedPlanId || "",
          planName: schoolConfig.selectedPlanName || "",
          planAmount,
          pin: autoPin,
          isPaid: false,
          paymentStatus: "pending",
          registrationStatus: "pending_payment",
          paymentLinkId: paymentData.paymentLinkId || "",
          paymentUrl,
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
          className: selectedClassName,
          createdAt: new Date(),
          source: "class_form",
          paymentStatus: "pending",
          registrationStatus: "pending_payment",
          planId: schoolConfig.selectedPlanId || "",
          planName: schoolConfig.selectedPlanName || "",
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

      setPaymentLinkToShow(paymentUrl);
      setStatus(`Open the payment link to complete registration for ${selectedClassName}.`);
      setStudentForm({
        fullName: "",
        className: normalizedClassName || classOptions[0] || "",
        rollNumber: "",
      });

      window.location.assign(paymentUrl);
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitTeacher = async (e) => {
    e.preventDefault();
    if (!teacherForm.name || !teacherForm.email) {
      setStatus("Please fill teacher name and email.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const classId = await ensureClassExists(normalizedClassName || classOptions[0] || "");
      const teacherRef = await addDoc(collection(db, "users"), {
        name: normalize(teacherForm.name),
        email: normalize(teacherForm.email).toLowerCase(),
        phone: normalize(teacherForm.phone),
        subject: normalize(teacherForm.subject),
        role: "teacher",
        schoolId: schoolIdValue || normalizedSchoolId,
        assignedClass: normalizedClassName,
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
      setTeacherForm({ name: "", email: "", phone: "", subject: "" });
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

        {formType === "student" && (
          <div className="plan-summary-card">
            <div>
              <span className="meta-label">Selected School Plan</span>
              <strong>{schoolConfig.selectedPlanName || "Not configured"}</strong>
            </div>
            <div>
              <span className="meta-label">Plan Amount</span>
              <strong>{schoolConfig.planAmount ? `₹${schoolConfig.planAmount}` : "No plan configured"}</strong>
            </div>
          </div>
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
              <option value="">Select Class</option>
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
            <button type="submit" disabled={loading || !schoolConfig.planAmount}>
              {loading
                ? "Opening payment..."
                : schoolConfig.planAmount
                ? `Pay ₹${schoolConfig.planAmount}`
                : "Select plan first"}
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
            <input
              value={teacherForm.phone}
              onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="Phone (optional)"
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
