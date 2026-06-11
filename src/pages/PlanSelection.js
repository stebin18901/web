import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import {
  buildAvailableClasses,
  CREATE_PAYMENT_LINK_URL,
  DEFAULT_SCHOOL_CLASS_OPTIONS,
  DEFAULT_SCHOOL_PLANS,
  getDefaultSchoolPlan,
  getUniqueClasses,
  normalizeClassName,
} from "../config/defaultSchool";
import "./PlanSelection.css";

const planRows = [DEFAULT_SCHOOL_PLANS.single, DEFAULT_SCHOOL_PLANS.multi, DEFAULT_SCHOOL_PLANS.mega];

const buildSession = (enrollmentId, enrollment) => {
  const selectedClasses = getUniqueClasses(enrollment.selectedClasses || [enrollment.className]);
  const plan = getDefaultSchoolPlan(enrollment.planId);
  return {
    id: enrollmentId,
    name: enrollment.name || enrollment.phone || "Student",
    className: selectedClasses[0] || enrollment.className || "Default",
    defaultClassName: enrollment.className || selectedClasses[0] || "",
    selectedClasses,
    classProfiles: enrollment.classProfiles || {},
    section: "",
    rollNumber: "",
    phone: enrollment.phone || "",
    schoolId: enrollment.schoolId || "",
    schoolName: enrollment.schoolName || "Default School",
    accessMode: "default-school",
    planId: plan.id,
    planName: plan.name,
    planMaxClasses: plan.maxClasses,
  };
};

const PlanSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const enrollmentId = searchParams.get("enrollmentId") || "";
  const [enrollment, setEnrollment] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState("single");
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => getDefaultSchoolPlan(selectedPlanId), [selectedPlanId]);
  const classOptions = useMemo(
    () => buildAvailableClasses([], [...availableClasses, enrollment?.className, ...selectedClasses]),
    [availableClasses, enrollment?.className, selectedClasses]
  );

  useEffect(() => {
    const loadEnrollment = async () => {
      if (!enrollmentId) {
        setError("Enrollment reference is missing.");
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "defaultSchoolEnrollments", enrollmentId));
        if (!snap.exists()) {
          setError("Enrollment was not found. Please register again.");
          return;
        }

        const data = snap.data();
        const [chapterSnap, quizSnap] = await Promise.all([
          getDocs(collection(db, "chapters")),
          getDocs(collection(db, "quizzes")),
        ]);
        const discoveredClasses = buildAvailableClasses(
          [
            ...chapterSnap.docs.map((docSnap) => docSnap.data()),
            ...quizSnap.docs.map((docSnap) => docSnap.data()),
          ],
          [data.className, ...(Array.isArray(data.selectedClasses) ? data.selectedClasses : [])]
        );
        setEnrollment(data);
        setAvailableClasses(discoveredClasses);
        const planId = data.planId || "single";
        const initialPlan = getDefaultSchoolPlan(planId);
        setSelectedPlanId(planId);
        const defaults = getUniqueClasses(data.selectedClasses || [data.className]);
        setSelectedClasses(initialPlan.allClasses ? discoveredClasses : defaults.slice(0, initialPlan.maxClasses));

        if (data.isPaid && data.planId) {
          localStorage.setItem("schoolStudentSession", JSON.stringify(buildSession(enrollmentId, data)));
          navigate("/dashboard", { replace: true });
        }
      } catch (err) {
        setError("Unable to load enrollment.");
      } finally {
        setLoading(false);
      }
    };

    loadEnrollment();
  }, [enrollmentId, navigate]);

  const choosePlan = (planId) => {
    const plan = getDefaultSchoolPlan(planId);
    const baseClasses = getUniqueClasses(selectedClasses.length ? selectedClasses : [enrollment?.className]);
    setSelectedPlanId(planId);
    setSelectedClasses(plan.allClasses ? DEFAULT_SCHOOL_CLASS_OPTIONS : baseClasses.slice(0, plan.maxClasses));
    setError("");
  };

  const toggleClass = (className) => {
    if (selectedPlan.allClasses) return;

    const cleanClassName = normalizeClassName(className);
    setSelectedClasses((prev) => {
      const current = getUniqueClasses(prev);
      if (current.includes(cleanClassName)) {
        return current.filter((item) => item !== cleanClassName);
      }
      if (current.length >= selectedPlan.maxClasses) return current;
      return [...current, cleanClassName];
    });
  };

  const handlePay = async () => {
    if (!enrollment) return;

    const classesForPlan = selectedPlan.allClasses ? DEFAULT_SCHOOL_CLASS_OPTIONS : getUniqueClasses(selectedClasses);
    if (!classesForPlan.length) {
      setError("Select at least one class.");
      return;
    }
    if (classesForPlan.length > selectedPlan.maxClasses) {
      setError(`This plan allows only ${selectedPlan.maxClasses} class${selectedPlan.maxClasses > 1 ? "es" : ""}.`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const enrollmentRef = doc(db, "defaultSchoolEnrollments", enrollmentId);
      const planPayload = {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        planAmount: selectedPlan.amount,
        planMaxClasses: selectedPlan.maxClasses,
        selectedClasses: classesForPlan,
        className: classesForPlan[0] || enrollment.className || "",
        updatedAt: new Date().toISOString(),
      };
      await setDoc(enrollmentRef, planPayload, { merge: true });

      if (enrollment.isPaid) {
        const paidEnrollment = { ...enrollment, ...planPayload, isPaid: true };
        localStorage.setItem("schoolStudentSession", JSON.stringify(buildSession(enrollmentId, paidEnrollment)));
        navigate("/dashboard", { replace: true });
        return;
      }

      const callbackUrl = `${window.location.origin}/payment-success?defaultStudentId=${encodeURIComponent(enrollmentId)}`;
      const canUseCurrentOrigin =
        window.location.protocol === "https:" &&
        !window.location.hostname.includes("localhost") &&
        !window.location.hostname.startsWith("127.");
      const paymentPayload = {
        userId: enrollmentId,
        studentId: enrollmentId,
        purpose: "defaultSchool",
        amount: selectedPlan.amount * 100,
        name: enrollment.name || "Student",
        phone: enrollment.phone || "",
        schoolId: enrollment.schoolId || "",
        schoolName: enrollment.schoolName || "",
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        selectedClasses: classesForPlan,
      };

      if (canUseCurrentOrigin) {
        paymentPayload.callbackUrl = callbackUrl;
      }

      const res = await fetch(CREATE_PAYMENT_LINK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentPayload),
      });
      const responseText = await res.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { error: responseText };
      }
      if (!res.ok) throw new Error(data.error || "Payment link creation failed.");
      if (!data.payment_url) throw new Error("Payment link creation failed.");

      await setDoc(
        enrollmentRef,
        {
          paymentLinkId: data.paymentLinkId || "",
          paymentLinkUrl: data.payment_url,
          paymentLinkCreatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      window.location.href = data.payment_url;
    } catch (err) {
      setError(err.message || "Unable to continue to payment.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="plan-page"><div className="plan-shell">Loading plans...</div></div>;
  }

  return (
    <div className="plan-page">
      <main className="plan-shell">
        <div className="plan-head">
          <div>
            <p>Default School</p>
            <h1>Choose Your Plan</h1>
            <span>{enrollment?.name || "Student"} | Class {enrollment?.className || "N/A"}</span>
          </div>
          <button type="button" onClick={() => navigate("/login", { replace: true })}>Back</button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <section className="plan-grid">
          {planRows.map((plan) => (
            <button
              type="button"
              key={plan.id}
              className={`plan-card ${selectedPlanId === plan.id ? "active" : ""}`}
              onClick={() => choosePlan(plan.id)}
            >
              <span>{plan.name}</span>
              <strong>Rs. {plan.amount}</strong>
              <small>
                {plan.allClasses
                  ? "Access to all classes"
                  : plan.maxClasses === 1
                  ? "Choose one class"
                  : `Choose up to ${plan.maxClasses} classes`}
              </small>
            </button>
          ))}
        </section>

        <section className="class-picker">
          <div className="class-picker-head">
            <h2>Classes</h2>
            <span>{selectedPlan.allClasses ? "All classes included" : `${selectedClasses.length} / ${selectedPlan.maxClasses}`}</span>
          </div>
          <div className="class-chip-grid">
            {DEFAULT_SCHOOL_CLASS_OPTIONS.map((className) => {
              const active = selectedPlan.allClasses || selectedClasses.includes(className);
              return (
                <button
                  type="button"
                  key={className}
                  className={`class-chip ${active ? "active" : ""}`}
                  onClick={() => toggleClass(className)}
                  disabled={selectedPlan.allClasses}
                >
                  {className}
                </button>
              );
            })}
          </div>
        </section>

        <button className="plan-pay-btn" type="button" onClick={handlePay} disabled={submitting}>
          {submitting ? "Preparing payment..." : enrollment?.isPaid ? "Save Plan" : `Pay Rs. ${selectedPlan.amount}`}
        </button>
      </main>
    </div>
  );
};

export default PlanSelection;
