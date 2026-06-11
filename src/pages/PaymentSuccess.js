import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getDefaultSchoolPlan, getUniqueClasses, VERIFY_DEFAULT_SCHOOL_PAYMENT_URL } from "../config/defaultSchool";
import "./PaymentSuccess.css";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking your payment...");

  const defaultStudentId = useMemo(
    () => searchParams.get("defaultStudentId") || searchParams.get("uid") || "",
    [searchParams]
  );
  const paymentLinkId = useMemo(
    () => searchParams.get("razorpay_payment_link_id") || searchParams.get("paymentLinkId") || "",
    [searchParams]
  );

  const verifyWithRazorpay = async (studentId, linkId) => {
    const res = await fetch(VERIFY_DEFAULT_SCHOOL_PAYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultStudentId: studentId,
        paymentLinkId: linkId,
      }),
    });
    const responseText = await res.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: responseText };
    }
    if (!res.ok) throw new Error(data.error || "Payment verification failed.");
    return data;
  };

  const checkPayment = async () => {
    if (!defaultStudentId) {
      setStatus("error");
      setMessage("Payment reference is missing.");
      return;
    }

    setStatus("checking");
    setMessage("Checking your payment...");

    try {
      const enrollmentRef = doc(db, "defaultSchoolEnrollments", defaultStudentId);
      let snap = await getDoc(enrollmentRef);
      if (!snap.exists()) {
        setStatus("error");
        setMessage("Student payment record was not found.");
        return;
      }

      let data = snap.data();
      if (!data.isPaid) {
        const linkId = paymentLinkId || data.paymentLinkId || "";
        if (linkId) {
          setMessage("Confirming payment with Razorpay...");
          const verification = await verifyWithRazorpay(defaultStudentId, linkId);
          if (!verification.paid) {
            setStatus("pending");
            setMessage(`Payment is not marked paid yet${verification.status ? ` (${verification.status})` : ""}. Please try again in a few seconds.`);
            return;
          }
          snap = await getDoc(enrollmentRef);
          data = snap.exists() ? snap.data() : data;
        } else {
          setStatus("pending");
          setMessage("Payment received, but the Razorpay link id is missing. Please try again in a few seconds.");
          return;
        }
      }

      const selectedClasses = getUniqueClasses(data.selectedClasses || [data.className]);
      const plan = getDefaultSchoolPlan(data.planId);
      localStorage.setItem(
        "schoolStudentSession",
        JSON.stringify({
          id: defaultStudentId,
          name: data.name || data.phone || "Student",
          className: selectedClasses[0] || data.className || "Default",
          defaultClassName: data.className || selectedClasses[0] || "",
          selectedClasses,
          classProfiles: data.classProfiles || {},
          section: "",
          rollNumber: "",
          phone: data.phone || "",
          schoolId: data.schoolId,
          schoolName: data.schoolName || "Default School",
          accessMode: "default-school",
          planId: plan.id,
          planName: plan.name,
          planMaxClasses: plan.maxClasses,
        })
      );

      setStatus("success");
      setMessage("Payment verified. Opening your dashboard...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 800);
    } catch (err) {
      setStatus("error");
      setMessage("Unable to verify payment: " + err.message);
    }
  };

  useEffect(() => {
    checkPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStudentId]);

  return (
    <div className="payment-success-page">
      <div className="payment-success-card">
        <h1>{status === "success" ? "Payment Successful" : "Payment Verification"}</h1>
        <p>{message}</p>
        {status !== "success" && (
          <div className="payment-success-actions">
            <button onClick={checkPayment} disabled={status === "checking"}>
              {status === "checking" ? "Checking..." : "Check Again"}
            </button>
            <button className="secondary" onClick={() => navigate("/", { replace: true })}>
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;
