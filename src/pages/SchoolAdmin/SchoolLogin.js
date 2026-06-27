import { useCallback, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword,
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
import "./SchoolLogin.css";

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

  const openSchoolAdmin = useCallback((schoolData) => {
    const payload = {
      ...schoolData,
      schoolId: schoolData.schoolId || schoolData.id || "",
      schoolName: schoolData.schoolName || schoolData.name || "School",
    };

    localStorage.setItem("schoolData", JSON.stringify(payload));
    onLoginSuccess?.(payload);
    navigate("/school-admin/home", { replace: true });
  }, [navigate, onLoginSuccess]);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (cancelled) return;

      try {
        if (!user) {
          setLoading(false);
          return;
        }

        const schoolSnap = await getDoc(doc(db, "schools", user.uid));
        if (!schoolSnap.exists()) {
          setLoading(false);
          return;
        }

        openSchoolAdmin(schoolSnap.data());
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
      const cleanSchoolId = schoolIdInput.trim().toLowerCase();
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (!cleanName || !cleanSchoolId || !cleanEmail || !cleanPassword) {
        throw new Error("Please fill school name, school ID, email, and password.");
      }

      const schoolQuery = query(
        collection(db, "schools"),
        where("schoolId", "==", cleanSchoolId),
        limit(1)
      );
      const existingSchool = await getDocs(schoolQuery);
      if (!existingSchool.empty) {
        throw new Error("This school ID is already in use.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = userCredential.user;

      const schoolData = {
        schoolId: cleanSchoolId,
        schoolName: cleanName,
        email: cleanEmail,
        loginEmail: cleanEmail,
        ownerUid: user.uid,
        registrationMode: "school-account",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "schools", user.uid), schoolData, { merge: true });
      openSchoolAdmin(schoolData);
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
      const cleanIdentifier = loginId.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (!cleanIdentifier || !cleanPassword) {
        throw new Error("Please enter school ID or email and password.");
      }

      let resolvedEmail = cleanIdentifier;
      if (!cleanIdentifier.includes("@")) {
        const schoolQuery = query(
          collection(db, "schools"),
          where("schoolId", "==", cleanIdentifier),
          limit(1)
        );
        const schoolSnap = await getDocs(schoolQuery);
        if (schoolSnap.empty) {
          throw new Error("No school found for this school ID.");
        }

        const schoolData = schoolSnap.docs[0].data();
        resolvedEmail = String(
          schoolData.loginEmail || schoolData.email || ""
        ).trim().toLowerCase();

        if (!resolvedEmail) {
          throw new Error("This school account is missing a login email.");
        }
      }

      const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, cleanPassword);
      const user = userCredential.user;

      const schoolSnap = await getDoc(doc(db, "schools", user.uid));
      if (!schoolSnap.exists()) {
        await signOut(auth).catch(() => {});
        throw new Error("No school profile found. Please register first.");
      }

      openSchoolAdmin(schoolSnap.data());
    } catch (err) {
      setError(err.message || "Login failed");
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
            Create a school account with a permanent school ID. Login supports both school ID and email.
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
