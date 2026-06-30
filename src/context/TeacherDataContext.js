import { createContext, useContext, useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useTeacherAuth } from "./TeacherAuthContext";

const TeacherDataContext = createContext();
export const useTeacherData = () => useContext(TeacherDataContext);

export const TeacherDataProvider = ({ children }) => {
  const { teacher } = useTeacherAuth();
  const [classes, setClasses] = useState([]);
  const [students] = useState([]);
  const [assignments] = useState([]);

  useEffect(() => {
    if (!teacher?.schoolId) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", teacher.schoolId));
    const unsub = onSnapshot(q, (snap) => {
      setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [teacher]);

  return (
    <TeacherDataContext.Provider value={{ classes, students, assignments }}>
      {children}
    </TeacherDataContext.Provider>
  );
};
