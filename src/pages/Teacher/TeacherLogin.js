import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import "./TeacherLogin.css";

const TeacherLogin = () => {
  const auth = getAuth();
  const navigate = useNavigate();
  const [isRegistering, setIsRegistering] = useState(false);
  const [schoolId, setSchoolId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists() && snap.data().role === "teacher") {
          navigate("/teacher-dashboard", { replace: true });
        }
      }
    });
    return () => unsub();
  }, [auth, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name || !email || !password || !schoolId) {
          setError("All fields required");
          setLoading(false);
          return;
        }

        const schoolRef = doc(db, "schools", schoolId);
        const schoolSnap = await getDoc(schoolRef);
        if (!schoolSnap.exists()) throw new Error("Invalid School ID");

        const schoolData = schoolSnap.data();

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name,
          email,
          schoolId,
          schoolName: schoolData.schoolName,
          role: "teacher",
          createdAt: new Date(),
        });

        navigate("/teacher-dashboard", { replace: true });
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const snap = await getDoc(doc(db, "users", user.uid));

        if (!snap.exists()) throw new Error("No teacher record found");
        if (snap.data().role !== "teacher") throw new Error("Unauthorized role");

        navigate("/teacher-dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-login-container">
      <div className="login-card glass-card">
        <h2 className="gradient-text">{isRegistering ? "Register as Teacher" : "Teacher Login"}</h2>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div className="form-group">
                <label>School ID</label>
                <input type="text" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} />
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <p className="error-text">{error}</p>}

          <button className="btn-primary" disabled={loading}>
            {loading ? "Please wait..." : isRegistering ? "Register" : "Login"}
          </button>
        </form>

        <p className="toggle-text">
          {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
          <button type="button" className="toggle-btn" onClick={() => setIsRegistering(!isRegistering)}>
            {isRegistering ? "Login" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default TeacherLogin;
