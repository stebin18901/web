import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./CreatorLoginPage.css";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;
const CREATOR_VISUAL = `${process.env.PUBLIC_URL || ""}/images/career.webp`;

export default function CreatorLoginPage() {
  const auth = getAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const next = params.get("next") || "/creator";
  const accessMode = params.get("mode") || "";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && String(snap.data().role || "").toLowerCase() === "creator") {
          navigate(next, { replace: true });
        }
      } catch {
        // ignore
      }
    });

    return () => unsubscribe();
  }, [auth, navigate, next]);

  useEffect(() => {
    if (accessMode === "unauthorized") {
      setError("This account is not a creator account. Sign in with a creator profile or register one.");
    }
  }, [accessMode]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        if (!name.trim() || !email.trim() || !password.trim()) {
          throw new Error("Name, email, and password are required.");
        }

        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = credential.user;

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: "creator",
          creatorProfile: {
            focusArea: focusArea.trim(),
            status: "active",
            createdOn: new Date().toISOString(),
          },
          membership: "creator",
          createdAt: new Date().toISOString(),
        });

        navigate(next, { replace: true });
        return;
      }

      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = credential.user;
      const snap = await getDoc(doc(db, "users", user.uid));

      if (!snap.exists()) {
        await signOut(auth);
        throw new Error("No creator profile found for this account.");
      }

      if (String(snap.data().role || "").toLowerCase() !== "creator") {
        await signOut(auth);
        throw new Error("This login is reserved for creator accounts.");
      }

      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || "Unable to continue with creator access.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="creator-login-shell">
      <div className="creator-login-panel creator-login-visual">
        <div
          className="creator-login-visual-image"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(5, 9, 20, 0.12), rgba(5, 9, 20, 0.76)), url(${CREATOR_VISUAL})`,
          }}
        />
        <div className="creator-login-visual-copy">
          <span>Creator Access</span>
          <h1>Build journeys, publish learning assets, and contribute with a dedicated creator account.</h1>
          <p>
            Creator access is separate from the normal student flow so publishing, drafts, and contribution rights stay properly controlled.
          </p>
          <div className="creator-login-pills">
            <span>Creator-only role</span>
            <span>Studio + library</span>
            <span>Live preview workflow</span>
          </div>
        </div>
      </div>

      <div className="creator-login-panel creator-login-form-shell">
        <Link className="creator-login-brand" to="/">
          <img src={HEPSY_LOGO} alt="Hepsy logo" />
          <span>
            <strong>HEPSY</strong>
            <small>Creator Login</small>
          </span>
        </Link>

        <div className="creator-login-toggle">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Creator Login
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Create Account
          </button>
        </div>

        <form className="creator-login-form" onSubmit={handleSubmit}>
          <h2>{mode === "register" ? "Register as Creator" : "Sign in as Creator"}</h2>
          <p>
            {mode === "register"
              ? "Create a dedicated creator account for publishing learning journeys."
              : "Use your creator account to open the studio, saved content, and live preview tools."}
          </p>

          {mode === "register" ? (
            <label>
              <span>Full Name</span>
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>

          {mode === "register" ? (
            <label>
              <span>Focus Area</span>
              <input
                type="text"
                value={focusArea}
                onChange={(event) => setFocusArea(event.target.value)}
                placeholder="Exam / subject speciality"
              />
            </label>
          ) : null}

          {error ? <div className="creator-login-error">{error}</div> : null}

          <button type="submit" className="creator-login-submit" disabled={loading}>
            {loading ? "Please wait..." : mode === "register" ? "Create Creator Account" : "Open Creator Workspace"}
          </button>
        </form>

        <div className="creator-login-links">
          <Link to="/login">Student Login</Link>
          <Link to="/">Back Home</Link>
        </div>
      </div>
    </div>
  );
}
