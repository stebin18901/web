// src/components/TeacherAuth.js
import { useState, useEffect } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const TeacherAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [schoolId, setSchoolId] = useState(""); // only needed during signup
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 🔹 Persist login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "teacher") {
          // Store schoolId globally
          localStorage.setItem("schoolId", userDoc.data().schoolId);
          navigate("/dashboard-teacher");
        } else {
          await signOut(auth);
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  // 🔹 Signup Teacher
  const handleSignup = async () => {
    try {
      const schoolRef = doc(db, "schools", schoolId);
      const schoolSnap = await getDoc(schoolRef);
      if (!schoolSnap.exists()) {
        alert("Invalid School ID.");
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        role: "teacher",
        schoolId,
        schoolName: schoolSnap.data().schoolName,
        createdAt: new Date(),
      });

      localStorage.setItem("schoolId", schoolId);
      navigate("/dashboard-teacher");
    } catch (error) {
      alert(error.message);
    }
  };

  // 🔹 Login Teacher
  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.role === "teacher") {
          localStorage.setItem("schoolId", data.schoolId);
          navigate("/dashboard-teacher");
        } else {
          await signOut(auth);
          alert("Access Denied: Not a teacher account.");
        }
      } else {
        alert("User record not found.");
      }
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: "400px", margin: "auto", textAlign: "center" }}>
      <h2>{isLogin ? "Teacher Login" : "Teacher Signup"}</h2>

      <input
        type="email"
        placeholder="Teacher Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      /><br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      /><br />

      {!isLogin && (
        <input
          type="text"
          placeholder="School ID"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          required
        />
      )}
      <br />

      {isLogin ? (
        <button onClick={handleLogin}>Login</button>
      ) : (
        <button onClick={handleSignup}>Sign Up</button>
      )}

      <p style={{ marginTop: "10px" }}>
        {isLogin ? "New Teacher?" : "Already have an account?"}{" "}
        <span
          style={{ color: "blue", cursor: "pointer" }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "Sign Up" : "Login"}
        </span>
      </p>
    </div>
  );
};

export default TeacherAuth;
