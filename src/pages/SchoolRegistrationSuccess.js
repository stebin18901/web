import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./SchoolRegistrationSuccess.css";

const MAX_ATTEMPTS = 12;

const SchoolRegistrationSuccess = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const schoolId = useMemo(() => searchParams.get("schoolId") || "", [searchParams]);
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Verifying school payment...");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let timer = null;

    const verify = async () => {
      if (!schoolId) {
        setStatus("error");
        setMessage("School reference is missing.");
        return;
      }

      try {
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (!snap.exists()) {
          throw new Error("School record not found.");
        }

        const data = snap.data();
        if (data.paymentStatus === "paid" || data.isPaid === true) {
          const payload = {
            ...data,
            schoolId: data.schoolId || schoolId,
            schoolName: data.schoolName || "School",
          };
          localStorage.setItem("schoolData", JSON.stringify(payload));
          setStatus("success");
          setMessage("Payment confirmed. Opening your school dashboard...");
          timer = setTimeout(() => navigate("/school-admin", { replace: true }), 900);
          return;
        }

        setAttempts((current) => {
          const next = current + 1;
          if (next >= MAX_ATTEMPTS) {
            setStatus("error");
            setMessage("We could not confirm payment yet. Please try again in a moment.");
            return next;
          }

          setStatus("pending");
          setMessage("Payment is still being confirmed. We will check again shortly.");
          timer = setTimeout(verify, 2500);
          return next;
        });
      } catch (err) {
        setStatus("error");
        setMessage(err.message || "Unable to verify payment.");
      }
    };

    verify();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [navigate, schoolId]);

  return (
    <div className="school-success-page">
      <div className="school-success-card">
        <div className="school-success-icon">
          {status === "success" ? "✓" : status === "error" ? "!" : "…"}
        </div>
        <h1>
          {status === "success"
            ? "Registration Complete"
            : status === "error"
            ? "Verification Delayed"
            : "Checking Payment"}
        </h1>
        <p>{message}</p>
        {status === "error" && (
          <button type="button" onClick={() => navigate("/school-admin", { replace: true })}>
            Back to School Login
          </button>
        )}
        {status !== "success" && <small>Attempt {attempts + 1} of {MAX_ATTEMPTS}</small>}
      </div>
    </div>
  );
};

export default SchoolRegistrationSuccess;
