import React, { createContext, useContext, useEffect, useState } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const TeacherAuthContext = createContext();
export const useTeacherAuth = () => useContext(TeacherAuthContext);

export const TeacherAuthProvider = ({ children }) => {
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const userRef = doc(db, "users", user.uid);
        unsubscribeUserDoc = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (["teacher", "class_teacher"].includes(data.role)) {
              setTeacher({
                uid: user.uid,
                ...data,
                assignedClasses: data.assignedClasses || (data.assignedClass ? [data.assignedClass] : []),
              });
            } else {
              setTeacher(null);
            }
          } else {
            setTeacher(null);
          }
          setLoading(false);
        });
      } else {
        setTeacher(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, [auth]);

  const logout = async () => {
    try {
      await signOut(auth);
      setTeacher(null);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <TeacherAuthContext.Provider value={{ teacher, loading, logout }}>
      {children}
    </TeacherAuthContext.Provider>
  );
};
