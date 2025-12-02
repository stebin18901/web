import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import "./Login.css";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const { login, signUp } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    schoolId: "",
    selectedClass: "6",
    userType: "school",
  });
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      if (isSignUp) {
        await signUp(
          formData.email,
          formData.password,
          formData.name,
          formData.schoolId,
          formData.selectedClass,
          formData.userType
        );
        alert("Account created successfully!");
        // 🔹 Redirect new user to pricing for premium upgrade
        navigate("/dashboard");
      } else {
        await login(formData.email, formData.password);
        navigate("/dashboard");
      }
    } catch (error) {
      setError(error.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">{isSignUp ? "Sign Up" : "Login"}</h1>

        {error && <div className="login-error">{error}</div>}

        {isSignUp && (
          <>
            <input
              type="text"
              name="name"
              placeholder="Name"
              className="login-input"
              value={formData.name}
              onChange={handleChange}
              required
            />

            <select
              className="login-input"
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              required
            >
              <option value="school">School Student</option>
              <option value="individual">Individual</option>
            </select>
          </>
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          className="login-input"
          value={formData.email}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          className="login-input"
          value={formData.password}
          onChange={handleChange}
          required
        />

        {isSignUp && formData.userType === "school" && (
          <input
            type="text"
            name="schoolId"
            placeholder="School ID"
            className="login-input"
            value={formData.schoolId}
            onChange={handleChange}
            required
          />
        )}

        {isSignUp && (
          <select
            className="login-input"
            name="selectedClass"
            value={formData.selectedClass}
            onChange={handleChange}
            required
          >
            <option value="6">Grade 6</option>
            <option value="7">Grade 7</option>
            <option value="8">Grade 8</option>
            <option value="9">Grade 9</option>
          </select>
        )}

        <button className="login-button" type="submit" disabled={isLoading}>
          {isLoading ? "Processing..." : isSignUp ? "Sign Up" : "Login"}
        </button>

        <p className="login-toggle-text">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <span
            className="login-toggle-link"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
          >
            {isSignUp ? "Login" : "Sign Up"}
          </span>
        </p>
      </form>
    </div>
  );
};

export default Login;
