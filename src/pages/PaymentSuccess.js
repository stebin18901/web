import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getUniqueClasses } from "../config/defaultSchool";
import "./PaymentSuccess.css";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000; // 3 seconds between each retry

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the localStorage session object from a paid enrollment document.
 */
const buildSession = (studentId, data) => ({
  id: studentId,
  name: data.name || data.phone || "Student",
  className:
    getUniqueClasses(data.selectedClasses || [data.className])[0] ||
    data.className ||
    "Default",
  defaultClassName: data.className || "",
  selectedClasses: getUniqueClasses(
    data.selectedClasses || [data.className].filter(Boolean)
  ),
  classProfiles: data.classProfiles || {},
  section: "",
  rollNumber: "",
  phone: data.phone || "",
  schoolId: data.schoolId || "",
  schoolName: data.schoolName || "Default School",
  accessMode: "default-school",
  planId: data.planId || "",
  planName: data.planName || "",
  planMaxClasses: data.planMaxClasses || 1,
  razorpaySubscriptionId: data.razorpaySubscriptionId || "",
});

/**
 * Checks if an enrollment is fully paid and has an active subscription.
 *
 * Strategy (in order):
 *   1. Check enrollment.isPaid + enrollment.planId  — fast path, set by webhook
 *   2. If razorpaySubscriptionId exists, cross-check the subscriptions doc
 *      to confirm subscriptionActive is not explicitly false
 *
 * Returns: { paid: boolean, enrollment: object | null }
 */
const checkPaidStatus = async (studentId) => {
  const enrollmentSnap = await getDoc(
    doc(db, "defaultSchoolEnrollments", studentId)
  );

  if (!enrollmentSnap.exists()) {
    throw new Error("Enrollment record not found.");
  }

  const enrollment = enrollmentSnap.data();

  // Not marked paid yet
  if (!enrollment.isPaid || !enrollment.planId) {
    return { paid: false, enrollment };
  }

  // Paid flag is set — optionally verify subscription doc
  const subId = enrollment.razorpaySubscriptionId;
  if (subId) {
    try {
      const subSnap = await getDoc(doc(db, "subscriptions", subId));
      if (subSnap.exists() && subSnap.data().subscriptionActive === false) {
        // Webhook explicitly marked it inactive (cancelled before first charge?)
        return { paid: false, enrollment };
      }
      // Either doc doesn't exist yet (webhook lag) or it's active — trust isPaid
    } catch {
      // Firestore error reading subscriptions — trust isPaid flag
    }
  }

  return { paid: true, enrollment };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("checking"); // "checking" | "success" | "pending" | "error"
  const [message, setMessage] = useState("Verifying your payment...");
  const [pollCount, setPollCount] = useState(0);

  const pollTimerRef = useRef(null);

  // Pull params written by PlanSelection.jsx's Razorpay handler
  const defaultStudentId = useMemo(
    () =>
      searchParams.get("defaultStudentId") ||
      searchParams.get("uid") ||
      "",
    [searchParams]
  );

  // razorpay_subscription_id is set by PlanSelection on success
  // (kept for logging/debugging — the source of truth is Firestore)
  const razorpaySubscriptionId = useMemo(
    () =>
      searchParams.get("razorpay_subscription_id") ||
      searchParams.get("razorpay_payment_link_id") || // legacy fallback
      "",
    [searchParams]
  );

  const razorpayPaymentId = useMemo(
    () => searchParams.get("razorpay_payment_id") || "",
    [searchParams]
  );

  // -------------------------------------------------------------------------
  // Core verification logic
  // -------------------------------------------------------------------------
  const verifyPayment = async () => {
    if (!defaultStudentId) {
      setStatus("error");
      setMessage("Payment reference is missing. Please contact support.");
      return;
    }

    setStatus("checking");
    setMessage("Verifying your payment...");

    try {
      const { paid, enrollment } = await checkPaidStatus(defaultStudentId);

      if (paid) {
        // Write session and redirect
        localStorage.setItem(
          "schoolStudentSession",
          JSON.stringify(buildSession(defaultStudentId, enrollment))
        );
        setStatus("success");
        setMessage("Payment confirmed! Opening your dashboard...");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
        return;
      }

      // Not paid yet — could be webhook lag
      setPollCount((prev) => {
        const next = prev + 1;

        if (next >= MAX_POLL_ATTEMPTS) {
          setStatus("error");
          setMessage(
            "We couldn't confirm your payment automatically. " +
              "If you completed the payment, please wait a minute and try checking again, " +
              "or contact support with your payment ID: " +
              (razorpayPaymentId || razorpaySubscriptionId || "N/A")
          );
          return next;
        }

        // Schedule next poll
        const secondsLeft = Math.round(
          ((MAX_POLL_ATTEMPTS - next) * POLL_INTERVAL_MS) / 1000
        );
        setStatus("pending");
        setMessage(
          `Payment received — waiting for confirmation (${next}/${MAX_POLL_ATTEMPTS}). ` +
            `Checking again in ${POLL_INTERVAL_MS / 1000}s...`
        );

        pollTimerRef.current = setTimeout(verifyPayment, POLL_INTERVAL_MS);
        return next;
      });
    } catch (err) {
      console.error("Payment verification error:", err);
      setStatus("error");
      setMessage("Unable to verify payment: " + (err.message || "Unknown error."));
    }
  };

  // -------------------------------------------------------------------------
  // Start verification on mount; clean up any pending timer on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    verifyPayment();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStudentId]);

  // -------------------------------------------------------------------------
  // Manual retry (resets poll count)
  // -------------------------------------------------------------------------
  const handleRetry = () => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setPollCount(0);
    verifyPayment();
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  const statusIcon = {
    checking: "⏳",
    pending: "🔄",
    success: "✅",
    error: "❌",
  }[status];

  return (
    <div className="payment-success-page">
      <div className="payment-success-card">
        <div className="payment-success-icon" aria-hidden="true">
          {statusIcon}
        </div>

        <h1>
          {status === "success"
            ? "Payment Successful"
            : status === "error"
            ? "Verification Failed"
            : "Verifying Payment"}
        </h1>

        <p className="payment-success-message">{message}</p>

        {/* Progress dots while polling */}
        {(status === "checking" || status === "pending") && (
          <div className="payment-poll-progress" aria-label="Checking payment status">
            {Array.from({ length: MAX_POLL_ATTEMPTS }).map((_, i) => (
              <span
                key={i}
                className={`poll-dot ${i < pollCount ? "done" : i === pollCount ? "active" : ""}`}
              />
            ))}
          </div>
        )}

        {/* Actions for non-success states */}
        {status !== "success" && (
          <div className="payment-success-actions">
            {status === "error" ? (
              <>
                <button onClick={handleRetry}>Check Again</button>
                <button
                  className="secondary"
                  onClick={() => navigate("/", { replace: true })}
                >
                  Back to Login
                </button>
              </>
            ) : (
              <button
                className="secondary"
                onClick={() => navigate("/", { replace: true })}
                disabled={status === "checking"}
              >
                Back to Login
              </button>
            )}
          </div>
        )}

        {/* Show payment reference for support */}
        {(razorpayPaymentId || razorpaySubscriptionId) && status === "error" && (
          <p className="payment-ref-note">
            Reference:{" "}
            <code>{razorpayPaymentId || razorpaySubscriptionId}</code>
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentSuccess;