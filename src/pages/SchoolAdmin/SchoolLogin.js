import { useCallback, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebaseConfig";
import { normalizeSchoolId } from "../../config/defaultSchool";
import "./SchoolLogin.css";

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const SCHOOL_SESSION_KEY = "schoolData";
const SCHOOL_SESSION_TIMESTAMP_KEY = "schoolAdminSessionAt";
const SCHOOL_SESSION_DOC_ID_KEY = "schoolAdminSessionDocId";
const SCHOOL_SESSION_AUTH_MODE_KEY = "schoolAdminAuthMode";

const readStoredSchoolSession = () => {
  try {
    const raw = localStorage.getItem(SCHOOL_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
};

const resolveSchoolById = async (rawIdentifier) => {
  const cleanIdentifier = String(rawIdentifier || "").trim();
  const normalizedIdentifier = normalizeSchoolId(cleanIdentifier);

  if (!normalizedIdentifier) return null;

  const directCandidates = [cleanIdentifier, normalizedIdentifier].filter(Boolean);
  for (const candidate of directCandidates) {
    const snap = await getDoc(doc(db, "schools", candidate));
    if (snap.exists()) {
      return { docId: snap.id, data: snap.data() };
    }
  }

  const bySchoolId = await getDocs(
    query(collection(db, "schools"), where("schoolId", "==", normalizedIdentifier), limit(1))
  );
  if (!bySchoolId.empty) {
    const first = bySchoolId.docs[0];
    return { docId: first.id, data: first.data() };
  }

  const allSchools = await getDocs(collection(db, "schools"));
  const matched = allSchools.docs.find((entry) => {
    const data = entry.data() || {};
    return normalizeSchoolId(data.schoolId || entry.id) === normalizedIdentifier;
  });

  return matched ? { docId: matched.id, data: matched.data() } : null;
};

const resolveSchoolByEmail = async (rawEmail) => {
  const cleanEmail = normalizeEmail(rawEmail);
  if (!cleanEmail) return null;

  const emailFields = ["loginEmail", "email"];
  for (const fieldName of emailFields) {
    const snap = await getDocs(
      query(collection(db, "schools"), where(fieldName, "==", cleanEmail), limit(1))
    );
    if (!snap.empty) {
      const first = snap.docs[0];
      return { docId: first.id, data: first.data() };
    }
  }

  const allSchools = await getDocs(collection(db, "schools"));
  const matched = allSchools.docs.find((entry) => {
    const data = entry.data() || {};
    return [data.loginEmail, data.email].some((value) => normalizeEmail(value) === cleanEmail);
  });

  return matched ? { docId: matched.id, data: matched.data() } : null;
};

const resolveSchoolRecord = async (identifier) => {
  const cleanIdentifier = String(identifier || "").trim();
  if (!cleanIdentifier) return null;

  if (cleanIdentifier.includes("@")) {
    return resolveSchoolByEmail(cleanIdentifier);
  }

  return resolveSchoolById(cleanIdentifier);
};

const resolveSchoolForUser = async (user) => {
  if (!user) return null;

  const direct = await getDoc(doc(db, "schools", user.uid));
  if (direct.exists()) {
    return { docId: direct.id, data: direct.data() };
  }

  const byEmail = await resolveSchoolByEmail(user.email || "");
  if (byEmail) return byEmail;

  const allSchools = await getDocs(collection(db, "schools"));
  const matched = allSchools.docs.find((entry) => {
    const data = entry.data() || {};
    return String(data.ownerUid || "") === user.uid;
  });

  return matched ? { docId: matched.id, data: matched.data() } : null;
};

const buildSchoolPayload = (schoolData, fallbackDocId = "") => {
  const resolvedSchoolId = normalizeSchoolId(
    schoolData.schoolId || fallbackDocId || schoolData.id || ""
  );

  return {
    ...schoolData,
    id: fallbackDocId || schoolData.id || resolvedSchoolId,
    schoolDocId: fallbackDocId || schoolData.schoolDocId || schoolData.id || resolvedSchoolId,
    schoolId: resolvedSchoolId,
    schoolName: schoolData.schoolName || schoolData.name || "School",
    email: normalizeEmail(schoolData.loginEmail || schoolData.email || ""),
    loginEmail: normalizeEmail(schoolData.loginEmail || schoolData.email || ""),
  };
};

const SchoolLogin = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("register");
  const [schoolName, setSchoolName] = useState("");
  const [schoolIdInput, setSchoolIdInput] = useState("");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const openSchoolAdmin = useCallback((schoolData, fallbackDocId = "", authMode = "local") => {
    const payload = buildSchoolPayload(schoolData, fallbackDocId);
    localStorage.setItem(SCHOOL_SESSION_KEY, JSON.stringify({ ...payload, authMode }));
    localStorage.setItem(SCHOOL_SESSION_TIMESTAMP_KEY, String(Date.now()));
    localStorage.setItem(
      SCHOOL_SESSION_DOC_ID_KEY,
      String(payload.schoolDocId || payload.id || payload.schoolId || "").trim()
    );
    localStorage.setItem(SCHOOL_SESSION_AUTH_MODE_KEY, String(authMode).trim().toLowerCase());
    onLoginSuccess?.({ ...payload, authMode });
    navigate("/school-admin/home", { replace: true });
  }, [navigate, onLoginSuccess]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      try {
        const storedSchool = readStoredSchoolSession();
        const storedAuthMode = String(
          localStorage.getItem(SCHOOL_SESSION_AUTH_MODE_KEY) || storedSchool?.authMode || ""
        )
          .trim()
          .toLowerCase();
        const storedDocId = String(
          localStorage.getItem(SCHOOL_SESSION_DOC_ID_KEY)
          || storedSchool?.schoolDocId
          || storedSchool?.id
          || storedSchool?.schoolId
          || ""
        ).trim();

        if (storedSchool?.schoolId) {
          setLoading(false);
          return;
        }

        if (!user) {
          setLoading(false);
          return;
        }

        if (storedAuthMode !== "firebase" || !storedDocId) {
          setLoading(false);
          return;
        }

        const schoolRecord = await resolveSchoolForUser(user);
        if (!schoolRecord) {
          setLoading(false);
          return;
        }

        const resolvedDocId = String(
          schoolRecord.docId || schoolRecord.data?.schoolDocId || schoolRecord.data?.schoolId || ""
        ).trim();
        const matchesStoredDoc =
          resolvedDocId &&
          normalizeSchoolId(resolvedDocId) === normalizeSchoolId(storedDocId);

        if (!matchesStoredDoc) {
          setLoading(false);
          return;
        }

        openSchoolAdmin(schoolRecord.data, schoolRecord.docId, "firebase");
      } catch (err) {
        setError(err.message || "Unable to load school account");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [openSchoolAdmin]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const cleanName = schoolName.trim();
      const cleanSchoolId = normalizeSchoolId(schoolIdInput);
      const cleanEmail = normalizeEmail(email);
      const cleanPassword = password.trim();

      if (!cleanName || !cleanSchoolId || !cleanPassword) {
        throw new Error("Please fill school name, school ID, and password.");
      }

      const existingById = await resolveSchoolById(cleanSchoolId);
      if (existingById) {
        throw new Error("This school ID is already in use.");
      }

      if (cleanEmail) {
        const existingByEmail = await resolveSchoolByEmail(cleanEmail);
        if (existingByEmail) {
          throw new Error("This email is already linked to another school.");
        }
      }

      const schoolData = {
        schoolId: cleanSchoolId,
        schoolName: cleanName,
        email: cleanEmail,
        loginEmail: cleanEmail,
        password: cleanPassword,
        registrationMode: "school-account",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "schools", cleanSchoolId), schoolData, { merge: true });
      openSchoolAdmin(schoolData, cleanSchoolId, "local");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const cleanIdentifier = String(loginId || "").trim();
      const cleanPassword = password.trim();

      if (!cleanIdentifier || !cleanPassword) {
        throw new Error("Please enter school ID or email and password.");
      }

      const schoolRecord = await resolveSchoolRecord(cleanIdentifier);
      if (schoolRecord) {
        const storedPassword = String(schoolRecord.data?.password || "").trim();
        if (storedPassword && storedPassword === cleanPassword) {
          openSchoolAdmin(schoolRecord.data, schoolRecord.docId, "local");
          return;
        }
      }

      const fallbackEmail = cleanIdentifier.includes("@")
        ? normalizeEmail(cleanIdentifier)
        : normalizeEmail(
            schoolRecord?.data?.loginEmail || schoolRecord?.data?.email || ""
          );

      if (!fallbackEmail) {
        throw new Error("Invalid school ID or password.");
      }

      const userCredential = await signInWithEmailAndPassword(auth, fallbackEmail, cleanPassword);
      const resolvedSchool = await resolveSchoolForUser(userCredential.user);

      if (!resolvedSchool) {
        await signOut(auth).catch(() => {});
        throw new Error("No school profile found for this account.");
      }

      openSchoolAdmin(resolvedSchool.data, resolvedSchool.docId, "firebase");
    } catch (err) {
      const messageText = err?.code === "auth/invalid-credential"
        ? "Invalid school email or password."
        : err.message || "Login failed";
      setError(messageText);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="school-login-container">
        <div className="school-login-card">
          <p>Loading school access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="school-login-container">
      <div className="school-login-card">
        <div className="school-auth-top">
          <p className="school-auth-kicker">School onboarding</p>
          <h2>{mode === "register" ? "Register Your School" : "School Login"}</h2>
          <p className="school-auth-subtitle">
            School login supports both school ID and email. This now matches the school records managed from admin.
          </p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError("");
              setMessage("");
            }}
          >
            Register
          </button>
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
          >
            Login
          </button>
        </div>

        {mode === "register" ? (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label>School Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Enter school name"
              />
            </div>

            <div className="form-group">
              <label>School ID</label>
              <input
                type="text"
                value={schoolIdInput}
                onChange={(e) => setSchoolIdInput(e.target.value)}
                placeholder="greenwood-public"
              />
            </div>

            <div className="form-group">
              <label>Login Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="school@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a secure password"
              />
            </div>

            <button className="login-button" type="submit" disabled={submitting}>
              {submitting ? "Creating school..." : "Register School"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>School ID or Email</label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="greenwood-public or school@example.com"
              />
            </div>

            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>

            <button className="login-button" type="submit" disabled={submitting}>
              {submitting ? "Signing in..." : "Login"}
            </button>
          </form>
        )}

        {message && <p className="plan-helper-card" style={{ marginTop: 20 }}>{message}</p>}
        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default SchoolLogin;
