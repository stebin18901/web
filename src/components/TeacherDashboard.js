// src/components/TeacherDashboard.js
import { auth } from "../firebase/firebaseConfig";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const TeacherDashboard = () => {
  const navigate = useNavigate();

  const logout = async () => {
    await signOut(auth);
    navigate("/");
  };

  return (
    <div style={{ textAlign: "center" }}>
      <h1>👩‍🏫 Teacher Dashboard</h1>
      <p>Welcome! You are logged in as a teacher.</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

export default TeacherDashboard;
