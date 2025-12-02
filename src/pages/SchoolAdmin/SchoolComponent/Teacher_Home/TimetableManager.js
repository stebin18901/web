import React, { useState, useEffect } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  CalendarDays,
  Save,
  Loader2,
  Clock,
  RefreshCcw,
} from "lucide-react";
import "./TimetableManager.css";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

// 🔹 Default general structure generator
const generateDefaultTimetable = (subjects, teachers) => {
  const data = {};
  const subArray = subjects.length ? subjects : ["Math", "English", "Science", "Social", "Hindi"];
  const teacherArray = teachers.length ? teachers.map((t) => t.name) : ["T1", "T2", "T3"];

  DAYS.forEach((day) => {
    data[day] = {};
    for (let p = 1; p <= 8; p++) {
      const sub = subArray[(p - 1) % subArray.length];
      const tch = teacherArray[(p - 1) % teacherArray.length];
      data[day][p] = { subject: sub, teacher: tch };
    }
  });
  return data;
};

export default function TimetableManager({ schoolId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState({});
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingClass, setLoadingClass] = useState(false);

  // 🔹 Fetch all classes under school
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", schoolId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setClasses(data);
    });
    return () => unsub();
  }, [schoolId]);

  // 🔹 Fetch all teachers
  useEffect(() => {
    if (!schoolId) return;
    const q = query(collection(db, "users"), where("schoolId", "==", schoolId));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTeachers(data);
    });
    return () => unsub();
  }, [schoolId]);

  // 🔹 Load class data & timetable (instant partial rendering)
  useEffect(() => {
    if (!selectedClass) return;
    setLoadingClass(true);

    const classRef = doc(db, "classes", selectedClass.id);
    const ttRef = doc(db, "timetables", `${schoolId}_${selectedClass.className}`);

    let unsubTT;

    const loadClassData = async () => {
      try {
        const classSnap = await getDoc(classRef);
        const classData = classSnap.data() || {};
        const teamSubjects = new Set();
        (classData.team || []).forEach((t) => (t.subjects || []).forEach((s) => teamSubjects.add(s)));
        setSubjects([...teamSubjects]);

        unsubTT = onSnapshot(ttRef, async (snap) => {
          if (snap.exists()) {
            setTimetable((prev) => ({ ...generateDefaultTimetable([...teamSubjects], teachers), ...snap.data().table }));
          } else {
            // if no data → create general default
            const defaultData = generateDefaultTimetable([...teamSubjects], teachers);
            await setDoc(ttRef, {
              schoolId,
              className: selectedClass.className,
              table: defaultData,
              updatedAt: new Date(),
            });
            setTimetable(defaultData);
          }
          setLoadingClass(false);
        });
      } catch (err) {
        console.error("Error loading timetable:", err);
        setLoadingClass(false);
      }
    };

    loadClassData();
    return () => unsubTT && unsubTT();
  }, [selectedClass, schoolId, teachers]);

  // 🔹 Update cell instantly
  const updateCell = (day, period, field, value) => {
    setTimetable((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [period]: { ...(prev[day]?.[period] || {}), [field]: value },
      },
    }));
  };

  // 🔹 Save timetable to Firestore
  const saveTimetable = async () => {
    if (!selectedClass) return;
    setSaving(true);
    const ref = doc(db, "timetables", `${schoolId}_${selectedClass.className}`);
    await updateDoc(ref, {
      table: timetable,
      updatedAt: new Date(),
    });
    setSaving(false);
    setStatus("✅ Timetable saved successfully");
    setTimeout(() => setStatus(""), 2000);
  };

  // 🔹 Auto-refresh timetable
  const refreshTimetable = () => {
    if (!selectedClass) return;
    const defaultData = generateDefaultTimetable(subjects, teachers);
    setTimetable(defaultData);
    setStatus("♻ Default timetable reloaded");
    setTimeout(() => setStatus(""), 2000);
  };

  return (
    <div className="timetable-container">
      <div className="tt-header">
        <h2>
          <CalendarDays size={20} /> Class Timetable
        </h2>

        <div className="tt-actions">
          <select
            className="class-selector"
            value={selectedClass?.id || ""}
            onChange={(e) =>
              setSelectedClass(classes.find((c) => c.id === e.target.value))
            }
          >
            <option value="">Select Class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.className}
              </option>
            ))}
          </select>

          {selectedClass && (
            <>
              <button className="refresh-btn" onClick={refreshTimetable}>
                <RefreshCcw size={15} /> Reset
              </button>
              <button className="save-btn" onClick={saveTimetable} disabled={saving}>
                {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />} Save
              </button>
            </>
          )}
        </div>
      </div>

      {status && <div className="status-banner">{status}</div>}

      {!selectedClass ? (
        <div className="timetable-empty">Please select a class to view timetable.</div>
      ) : loadingClass ? (
        <div className="timetable-loader">
          <Loader2 className="spin" /> Loading timetable for {selectedClass.className}...
        </div>
      ) : (
        <div className="timetable-grid">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                {PERIODS.map((p) => (
                  <th key={p}>
                    <Clock size={14} /> {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day}>
                  <td className="day-col">{day}</td>
                  {PERIODS.map((p) => (
                    <td key={`${day}-${p}`}>
                      <select
                        className="tt-subject"
                        value={timetable?.[day]?.[p]?.subject || ""}
                        onChange={(e) => updateCell(day, p, "subject", e.target.value)}
                      >
                        <option value="">—</option>
                        {subjects.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        className="tt-teacher"
                        value={timetable?.[day]?.[p]?.teacher || ""}
                        onChange={(e) => updateCell(day, p, "teacher", e.target.value)}
                      >
                        <option value="">Teacher</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
