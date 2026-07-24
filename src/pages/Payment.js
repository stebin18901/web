import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const Payment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Complete your payment to continue to the dashboard.");
  const [loading, setLoading] = useState(true);

  const enrollmentId = useMemo(() => searchParams.get("enrollmentId") || "", [searchParams]);

  useEffect(() => {
    const loadPaymentState = async () => {
      try {
        const rawSession = localStorage.getItem("schoolStudentSession");
        if (rawSession) {
          const session = JSON.parse(rawSession);
          if (session?.accessMode === "school-auth" && session?.isPaid) {
            navigate("/dashboard", { replace: true });
            return;
          }
        }

        if (enrollmentId) {
          const snap = await getDoc(doc(db, "defaultSchoolEnrollments", enrollmentId));
          if (snap.exists()) {
            const data = snap.data() || {};
            if (data.paymentUrl) {
              window.location.assign(data.paymentUrl);
              return;
            }
          }
        }

        setMessage("Payment is required for this school login path. Please contact support to continue.");
      } catch {
        setMessage("Payment is required for this school login path. Please contact support to continue.");
      } finally {
        setLoading(false);
      }
    };

    loadPaymentState();
  }, [enrollmentId, navigate]);

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f8fafc" }}>
      <div style={{ maxWidth: "520px", width: "100%", padding: "32px", borderRadius: "24px", background: "#ffffff", boxShadow: "0 18px 36px rgba(15, 23, 42, 0.08)" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "1.7rem", color: "#111827" }}>Payment Required</h1>
        <p style={{ margin: 0, lineHeight: 1.6, color: "#4b5563" }}>{loading ? "Preparing your payment flow..." : message}</p>
      </div>
    </div>
  );
};

export default Payment;
