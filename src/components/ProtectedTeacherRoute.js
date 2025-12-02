// src/components/ProtectedTeacherRoute.js
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const ProtectedTeacherRoute = ({ children }) => {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "teacher") {
          setAllowed(true);
        } else {
          setAllowed(false);
        }
      } else {
        setAllowed(false);
      }
    };
    checkAuth();
  }, []);

  if (allowed === null) return <p>Loading...</p>;
  return allowed ? children : <Navigate to="/teacher-login" />;
};

export default ProtectedTeacherRoute;
