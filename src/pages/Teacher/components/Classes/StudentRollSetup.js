import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import "./StudentRollSetup.css";

const StudentRollSetup = ({ schoolId, className }) => {
  const classId = `${schoolId}_${className}`;

  const [rollSetup, setRollSetup] = useState(null);
  const [studentCount, setStudentCount] = useState(0);
  const [format, setFormat] = useState("numeric");
  const [prefix, setPrefix] = useState("");
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(30);
  const [preview, setPreview] = useState([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // 🔹 Fetch roll setup + student count
  useEffect(() => {
    if (!classId) return;
    const loadData = async () => {
      try {
        const setupRef = doc(db, "classes", classId, "meta", "rollSetup");
        const snap = await getDoc(setupRef);
        if (snap.exists()) {
          const data = snap.data();
          setRollSetup(data);
          setStudentCount(data.studentCount || 30);
          setFormat(data.format || "numeric");
          setPrefix(data.prefix || "");
          setStart(data.range?.start || 1);
          setEnd(data.range?.end || 30);
        } else {
          // Fallback defaults if not found
          setRollSetup({
            studentCount: 30,
            format: "numeric",
            range: { start: 1, end: 30 },
          });
        }

        const studentsSnap = await getDocs(collection(db, "classes", classId, "students"));
        setStudentCount(studentsSnap.size);
      } catch (err) {
        console.error("Failed to load roll setup:", err);
      }
    };
    loadData();
  }, [classId]);

  // 🔹 Generate preview rolls
  useEffect(() => {
    const total = Math.min(end - start + 1, 6);
    const rolls = [];
    for (let i = 0; i < total; i++) {
      const num = start + i;
      let roll = "";
      switch (format) {
        case "numeric":
          roll = num.toString();
          break;
        case "prefixed":
          roll = `${prefix}${num}`;
          break;
        case "zeroPad":
          roll = `${prefix}${num.toString().padStart(2, "0")}`;
          break;
        default:
          roll = num.toString();
      }
      rolls.push(roll);
    }
    setPreview(rolls);
  }, [format, prefix, start, end]);

  // 🔹 Save setup
  const handleSave = async () => {
  if (!classId) return;
  setSaving(true);
  setStatus("Saving...");

  const total = end - start + 1;
  const rolls = [];
  for (let i = 0; i < total; i++) {
    const num = start + i;
    let roll = "";
    switch (format) {
      case "numeric":
        roll = num.toString();
        break;
      case "prefixed":
        roll = `${prefix}${num}`;
        break;
      case "zeroPad":
        roll = `${prefix}${num.toString().padStart(2, "0")}`;
        break;
    }
    rolls.push(roll);
  }

  try {
    // ✅ Ensure parent class doc exists
    const classRef = doc(db, "classes", classId);
    const classSnap = await getDoc(classRef);
    if (!classSnap.exists()) {
      await setDoc(classRef, { schoolId, className, createdAt: new Date() });
    }

    const rollSetupRef = doc(db, "classes", classId, "meta", "rollSetup");
    await setDoc(rollSetupRef, {
      studentCount: total,
      format,
      prefix,
      range: { start, end },
      updatedAt: new Date(),
    });

    const studentsRef = collection(db, "classes", classId, "students");
    const existingSnap = await getDocs(studentsRef);
    const existingRolls = new Set(existingSnap.docs.map((d) => d.id));

    // Create missing students
    await Promise.all(
      rolls.map((roll) =>
        existingRolls.has(roll)
          ? Promise.resolve()
          : setDoc(doc(studentsRef, roll), {
              rollNumber: roll,
              name: `Student ${roll}`,
              createdAt: new Date(),
            })
      )
    );

    setStudentCount(total);
    setStatus("✅ Setup updated!");
  } catch (err) {
    console.error("Error saving setup:", err);
    setStatus("❌ Failed to save");
  } finally {
    setSaving(false);
    setTimeout(() => setStatus(""), 3000);
  }
};


  return (
    <div className="roll-setup-card glass-card">
      <h4 className="roll-header">🎓 Student Roll Setup</h4>

      {rollSetup ? (
        <>
          <div className="roll-grid">
            <div className="field">
              <label>Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="numeric">Numeric (1,2,3...)</option>
                <option value="prefixed">Prefixed (A1,A2...)</option>
                <option value="zeroPad">Zero-Pad (A01,A02...)</option>
              </select>
            </div>

            {(format === "prefixed" || format === "zeroPad") && (
              <div className="field">
                <label>Prefix</label>
                <input
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="e.g. C6_"
                />
              </div>
            )}

            <div className="field range">
              <label>Roll Range</label>
              <div className="range-inputs">
                <input
                  type="number"
                  min="1"
                  value={start}
                  onChange={(e) => setStart(Number(e.target.value))}
                />
                <span>to</span>
                <input
                  type="number"
                  value={end}
                  onChange={(e) => setEnd(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="preview">
            <label>Preview:</label>
            <div className="preview-box">
              {preview.map((r, i) => (
                <span key={i} className="roll-chip">
                  {r}
                </span>
              ))}
              {end - start + 1 > preview.length && <span>...</span>}
            </div>
          </div>

          <div className="roll-actions">
            <button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Setup"}
            </button>
          </div>

          <div className="status-line">
            {status && <p className="status">{status}</p>}
            <p className="student-count">
              Total Students: <strong>{studentCount}</strong>
            </p>
          </div>
        </>
      ) : (
        <p>Loading roll setup...</p>
      )}
    </div>
  );
};

export default StudentRollSetup;
