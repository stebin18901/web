import React, { useState, useEffect } from "react";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import "./CreateClassManager.css";

// ==============================
// DIVISION FORMAT OPTIONS
// ==============================
const DIVISION_FORMATS = [
  { id: "alpha", label: "A, B, C, D ..." },
  { id: "alphaNum", label: "A1, A2, A3 ..." },
  { id: "numeric", label: "1, 2, 3 ..." },
  { id: "custom", label: "Custom Prefix (ex: X1, X2 ...)" },
];

// ==============================
// HELPERS
// ==============================
const generateDivisions = (format, count, customPrefix) => {
  const list = [];

  for (let i = 1; i <= count; i++) {
    if (format === "alpha") {
      list.push(String.fromCharCode(64 + i)); // A, B, C...
    } else if (format === "alphaNum") {
      list.push(`A${i}`);
    } else if (format === "numeric") {
      list.push(i.toString());
    } else if (format === "custom") {
      list.push(`${customPrefix}${i}`);
    }
  }

  return list;
};

// ==============================
// MAIN COMPONENT
// ==============================
export default function CreateClassManager({ schoolId }) {
  const [divisionFormat, setDivisionFormat] = useState("alpha");
  const [customPrefix, setCustomPrefix] = useState("A");
  const [divisionCounts, setDivisionCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);

  // ==============================
  // AUTO-FILL INPUTS FROM EXISTING CLASSES
  // ==============================
  useEffect(() => {
    if (!schoolId) return;

    const q = query(collection(db, "classes"), where("schoolId", "==", schoolId));

    const unsub = onSnapshot(q, (snap) => {
      const map = {};

      snap.docs.forEach((d) => {
        const data = d.data();
        const grade = data.grade;

        if (!map[grade]) map[grade] = new Set();
        map[grade].add(data.division);
      });

      // Convert to counts
      const counts = {};
      Object.keys(map).forEach((g) => {
        counts[g] = map[g].size;
      });

      // 🔹 This is the key line – keeps inputs filled
      setDivisionCounts((prev) => ({ ...prev, ...counts }));
    });

    return () => unsub();
  }, [schoolId]);

  // ==============================
  // HANDLE INPUT CHANGE
  // ==============================
  const updateDivisionCount = (grade, value) => {
    const num = parseInt(value || "0", 10);
    setDivisionCounts((prev) => ({ ...prev, [grade]: num }));
  };

  // ==============================
  // CREATE CLASSES
  // ==============================
  const handleCreateClasses = async () => {
    if (!schoolId) return alert("School ID missing");

    setLoading(true);
    setLog([]);

    try {
      for (let grade = 1; grade <= 12; grade++) {
        const count = divisionCounts[grade];
        if (!count || count <= 0) continue;

        const divisions = generateDivisions(
          divisionFormat,
          count,
          customPrefix.trim().toUpperCase()
        );

        for (let div of divisions) {
          const className = `${grade}${div}`;
          const classId = `${schoolId}_${className}`;

          const ref = doc(db, "classes", classId);
          const snap = await getDoc(ref);

          if (snap.exists()) {
            setLog((p) => [...p, `⚠️ ${className} already exists (skipped)`]);
            continue;
          }

          await setDoc(ref, {
            schoolId,
            className,
            grade,
            division: div,
            totalDivisions: count,
            divisionFormat: divisionFormat,
            sectionId:
              grade <= 5 ? "1-5" : grade <= 9 ? "6-9" : "10-12",
            createdAt: new Date(),
          });

          setLog((p) => [...p, `✅ Created ${className}`]);
        }
      }

      alert("Classes created / updated successfully");

      // ❌ IMPORTANT: DO NOT CLEAR divisionCounts
      // So inputs remain visible and adjustable

    } catch (err) {
      console.error("Class creation failed:", err);
      alert("Error while creating classes. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // ==============================
  // UI
  // ==============================
  return (
    <div className="ccm-container">
      <h2 className="gradient-text">Create Classes</h2>

      {/* Division Format */}
      <div className="ccm-section">
        <label>Division Format</label>
        <select
          value={divisionFormat}
          onChange={(e) => setDivisionFormat(e.target.value)}
        >
          {DIVISION_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>

        {divisionFormat === "custom" && (
          <input
            type="text"
            placeholder="Enter prefix (ex: X)"
            value={customPrefix}
            onChange={(e) => setCustomPrefix(e.target.value.toUpperCase())}
            style={{ marginTop: 8 }}
          />
        )}
      </div>

      {/* Class Inputs */}
      <div className="ccm-section">
        <h4>Number of Divisions per Class</h4>

        <div className="ccm-grid">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((grade) => (
            <div key={grade} className="ccm-row">
              <span>Class {grade}</span>
              <input
                type="number"
                min="0"
                placeholder="Divisions"
                value={divisionCounts[grade] || ""}
                onChange={(e) =>
                  updateDivisionCount(grade, e.target.value)
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="ccm-actions">
        <button disabled={loading} onClick={handleCreateClasses}>
          {loading ? "Creating..." : "Create / Update Classes"}
        </button>
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="ccm-log">
          <h4>Creation Log</h4>
          {log.map((l, i) => (
            <div key={i} className="log-line">{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
