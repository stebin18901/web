import { createContext, useContext, useState, useEffect } from "react";
import { auth, login, signUp, logout } from "../firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const updateUserData = async (uid, data) => {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);
  };

  return (
    <AuthContext.Provider value={{ user, login, signUp, logout, updateUserData }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
