import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import "./SchoolMagicAuth.css";

const SchoolMagicAuth = ({ mode = "auth" }) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const maskedToken = useMemo(() => {
    if (!token) return "";
    if (token.length < 12) return token;
    return `${token.slice(0, 6)}...${token.slice(-4)}`;
  }, [token]);

  const handleAuthenticate = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const isLogout = mode === "logout";
      const linkRef = doc(db, isLogout ? "schoolLogoutLinks" : "schoolAuthLinks", token);
      const linkSnap = await getDoc(linkRef);

      if (!linkSnap.exists()) {
        setError(`This ${isLogout ? "logout" : "auth"} link is invalid.`);
        return;
      }

      const linkData = linkSnap.data();
      if (linkData.used) {
        setError("This auth link has already been used.");
        return;
      }

      if (!linkData.expiresAt || Date.now() > Number(linkData.expiresAt)) {
        setError("This auth link has expired.");
        return;
      }

      const schoolId = String(linkData.schoolId || "").trim();
      if (!schoolId) {
        setError("School ID missing in auth link.");
        return;
      }

      const schoolSnap = await getDoc(doc(db, "schools", schoolId));
      if (!schoolSnap.exists()) {
        setError(`School not found for this ${isLogout ? "logout" : "auth"} link.`);
        return;
      }

      const schoolData = schoolSnap.data();
      if (isLogout) {
        let active = null;
        try {
          const activeRaw = localStorage.getItem("studentSchoolAccess");
          active = activeRaw ? JSON.parse(activeRaw) : null;
        } catch {
          active = null;
        }
        if (!active?.schoolId || String(active.schoolId).trim().toLowerCase() === schoolId) {
          localStorage.removeItem("studentSchoolAccess");
          localStorage.removeItem("schoolStudentSession");
        }
      } else {
        localStorage.setItem(
          "studentSchoolAccess",
          JSON.stringify({
            schoolId,
            schoolName: schoolData.schoolName || schoolId,
            authenticatedAt: new Date().toISOString(),
            source: "magic-link",
          })
        );
      }

      await updateDoc(linkRef, {
        used: true,
        usedAt: new Date().toISOString(),
      });

      setMessage(
        isLogout
          ? `Student access logged out for ${schoolData.schoolName || schoolId}. Redirecting to login...`
          : `Student access enabled for ${schoolData.schoolName || schoolId}. Redirecting to login...`
      );
      setTimeout(() => navigate("/"), 900);
    } catch (err) {
      setError("Auth failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="school-magic-auth-page">
      <div className="school-magic-auth-card">
        <h1>{mode === "logout" ? "School Quick Logout" : "School Quick Auth"}</h1>
        <p className="token-label">Link Token: {maskedToken}</p>
        <p>
          {mode === "logout"
            ? "Use this link to remove school student access from this browser."
            : "Use this link to enable student login for the school. School-admin PIN login is still required separately."}
        </p>
        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}
        <button onClick={handleAuthenticate} disabled={loading || !token}>
          {loading ? (mode === "logout" ? "Logging out..." : "Authenticating...") : mode === "logout" ? "Logout School" : "Authenticate School"}
        </button>
      </div>
    </div>
  );
};

export default SchoolMagicAuth;
