import React, { useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import "./SchoolLogin.css"; // Import the CSS file

const SchoolLogin = ({ onLoginSuccess }) => {
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const docRef = doc(db, "schools", schoolId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists() && docSnap.data().password === password) {
        onLoginSuccess(docSnap.data());
      } else {
        setError("Invalid School ID or Password");
      }
    } catch (err) {
      setError("Error: " + err.message);
    }
  };

  return (
    <div className="school-login-container"> {/* Changed class name for better specificity */}
      <div className="school-login-card"> {/* Added a card-like container */}
        <h2>School Admin Login</h2>
        <form onSubmit={handleLogin}>
          <div className="form-group"> {/* Group for label and input */}
            <label htmlFor="schoolId">School ID</label>
            <input
              type="text"
              id="schoolId" // Added ID for label association
              placeholder="Enter your School ID" // More descriptive placeholder
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password" // Added ID for label association
              placeholder="Enter your Password" // More descriptive placeholder
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="login-button">Login</button>
          {error && <p className="error-message">{error}</p>} {/* Changed class name */}
        </form>
      </div>
    </div>
  );
};

export default SchoolLogin;