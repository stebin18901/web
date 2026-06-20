import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebaseConfig";
import { buildSchoolPlanOptions } from "../../config/defaultSchool";
import "./SchoolLogin.css";

const SCHOOL_PLANS = buildSchoolPlanOptions();

const SchoolLogin = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("register");
  const [schoolName, setSchoolName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("yearly");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlan = useMemo(
    () => SCHOOL_PLANS.find((plan) => plan.id === selectedPlanId) || SCHOOL_PLANS[0],
    [selectedPlanId]
  );

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
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      if (!cleanName || !cleanEmail || !cleanPassword) {
        throw new Error("Please fill school name, email, password, and plan.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = userCredential.user;

      const schoolData = {
        schoolId: user.uid,
        schoolName: cleanName,
        email: cleanEmail,
        ownerUid: user.uid,
        selectedPlanId: selectedPlan.id,
        selectedPlanName: selectedPlan.name,
        planAmount: selectedPlan.amount,
        planDurationLabel: selectedPlan.durationLabel,
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
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const user = userCredential.user;

      const schoolSnap = await getDoc(doc(db, "schools", user.uid));
      if (!schoolSnap.exists()) {
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
            Create the school account first. The plan you choose is used later for student payment links.
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
              <label>Email</label>
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

            <div className="form-group">
              <label>Plan</label>
              <div className="plan-grid">
                {SCHOOL_PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={`plan-card ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      <strong>{plan.name}</strong>
                      <span>{plan.durationLabel}</span>
                      <div className="plan-price">
                        <span className="currency">₹</span>
                        <span>{plan.amount}</span>
                      </div>
                      <small>Used for student payment forms</small>
                    </button>
                  );
                })}
              </div>
              <div className="plan-helper-card">
                <strong>{selectedPlan.name}</strong>
                <p>{selectedPlan.description}</p>
                <small>
                  After registration, class forms will use this plan to generate the student payment link.
                </small>
              </div>
            </div>

            <button className="login-button" type="submit" disabled={submitting}>
              {submitting ? "Creating school..." : "Register School"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Email</label>
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
