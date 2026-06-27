import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { collection, doc, getDoc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
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

  const resolveSchool = async (linkData) => {
    const normalizedSchoolId = String(linkData.schoolId || "").trim().toLowerCase();
    const candidates = [
      String(linkData.schoolDocId || "").trim(),
      normalizedSchoolId,
    ].filter(Boolean);

    for (const candidate of [...new Set(candidates)]) {
      const snap = await getDoc(doc(db, "schools", candidate));
      if (snap.exists()) {
        return {
          id: normalizedSchoolId || String(snap.data().schoolId || snap.id).trim().toLowerCase(),
          docId: candidate,
          data: snap.data(),
        };
      }
    }

    if (normalizedSchoolId) {
      const matches = await getDocs(
        query(collection(db, "schools"), where("schoolId", "==", normalizedSchoolId), limit(1))
      );
      if (!matches.empty) {
        const match = matches.docs[0];
        return {
          id: normalizedSchoolId,
          docId: match.id,
          data: match.data(),
        };
      }

      const allSchools = await getDocs(collection(db, "schools"));
      const normalizedMatch = allSchools.docs.find((schoolDoc) => {
        const data = schoolDoc.data();
        return [schoolDoc.id, data.schoolId]
          .filter(Boolean)
          .some((value) => String(value).trim().toLowerCase() === normalizedSchoolId);
      });
      if (normalizedMatch) {
        return {
          id: normalizedSchoolId,
          docId: normalizedMatch.id,
          data: normalizedMatch.data(),
        };
      }
    }

    return null;
  };

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

      const schoolId = String(linkData.schoolId || "").trim().toLowerCase();
      if (!schoolId) {
        setError("School ID missing in auth link.");
        return;
      }

      const school = await resolveSchool(linkData);
      if (!school) {
        setError(`School not found for this ${isLogout ? "logout" : "auth"} link.`);
        return;
      }

      const schoolData = school.data;
      const resolvedSchoolId = school.id || schoolId;
      if (isLogout) {
        let active = null;
        try {
          const activeRaw = localStorage.getItem("studentSchoolAccess");
          active = activeRaw ? JSON.parse(activeRaw) : null;
        } catch {
          active = null;
        }
        if (!active?.schoolId || String(active.schoolId).trim().toLowerCase() === resolvedSchoolId) {
          localStorage.removeItem("studentSchoolAccess");
          localStorage.removeItem("schoolStudentSession");
        }
      } else {
        localStorage.setItem(
          "studentSchoolAccess",
          JSON.stringify({
            schoolId: resolvedSchoolId,
            schoolDocId: school.docId || linkData.schoolDocId || resolvedSchoolId,
            schoolName: schoolData.schoolName || linkData.schoolName || resolvedSchoolId,
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
          ? `Student access logged out for ${schoolData.schoolName || linkData.schoolName || resolvedSchoolId}. Redirecting to login...`
          : `Student access enabled for ${schoolData.schoolName || linkData.schoolName || resolvedSchoolId}. Redirecting to login...`
      );
      setTimeout(() => navigate("/login"), 900);
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
