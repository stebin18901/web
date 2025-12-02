// AdminProtect.jsx
import React, { useState, useEffect } from "react";

/**
 * Simple AdminProtect wrapper
 * Usage:
 *   <AdminProtect element={<YourComponent />} />
 *
 * Behavior:
 * - Reads credentials from environment variables
 *   REACT_APP_ADMIN_USER and REACT_APP_ADMIN_PASS
 * - Shows a small login modal if not authenticated
 * - Stores a session key in localStorage so refreshing keeps the login
 *
 * NOTE: Client-side env vars are bundled into the app at build time and are
 * visible to anyone who inspects the frontend. This wrapper is fine for
 * simple internal demos or prototypes but NOT secure for production. For
 * production use a server-side auth flow (JWT/OAuth) or Firebase Auth.
 */

const AUTH_KEY = "hepsy_admin_authenticated";

export default function AdminProtect({ element }) {
  const envUser = process.env.REACT_APP_ADMIN_USER || "user";
  const envPass = process.env.REACT_APP_ADMIN_PASS || "pass";

  const [authed, setAuthed] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored === "1") setAuthed(true);
  }, []);

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (username === envUser && password === envPass) {
      localStorage.setItem(AUTH_KEY, "1");
      setAuthed(true);
      setShowLogin(false);
    } else {
      setError("Invalid credentials");
    }
  }

  function handleLogout() {
    localStorage.removeItem(AUTH_KEY);
    setAuthed(false);
  }

  if (!authed) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <strong>Admin access required</strong>
        </div>
        <button onClick={() => setShowLogin(true)}>Login as admin</button>

        {showLogin && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modal}>
              <h3>Admin login</h3>
              <form onSubmit={handleSubmit}>
                <div style={styles.field}>
                  <label>Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div style={styles.field}>
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {error && <div style={styles.error}>{error}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button type="submit">Login</button>
                  <button type="button" onClick={() => setShowLogin(false)}>
                    Cancel
                  </button>
                </div>
              </form>
              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Env username: <code>REACT_APP_ADMIN_USER</code>
                <br />
                Env password: <code>REACT_APP_ADMIN_PASS</code>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Authed — render the element and show a small logout button
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 8 }}>
        <button onClick={handleLogout}>Logout admin</button>
      </div>
      <div>{element}</div>
    </div>
  );
}

const styles = {
  modalBackdrop: {
    position: "fixed",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.4)",
    zIndex: 9999,
  },
  modal: {
    background: "#fff",
    padding: 20,
    borderRadius: 8,
    minWidth: 320,
    boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
  },
  field: { marginTop: 8, display: "flex", flexDirection: "column" },
  error: { color: "#b00020", marginTop: 8 },
};


/*
.env example (create file at project root)

REACT_APP_ADMIN_USER=user
REACT_APP_ADMIN_PASS=pass

Remember: in Create React App you need to restart the dev server after changing .env.
Also these REACT_APP_ env variables are embedded during build and are visible to anyone
who inspects the built frontend. For production, use a proper auth system.
*/

/*
Usage example (App.jsx):

import React from 'react';
import AdminProtect from './components/AdminProtect';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  return (
    <AdminProtect element={<AdminDashboard />} />
  );
}

export default App;
*/
