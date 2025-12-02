import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./StudentDetails.css";

const StudentDetails = ({ schoolId }) => {
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [filterClass, setFilterClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  // ------------------------
  // SAFE RENDERER
  // ------------------------
  const safe = (v) => {
    if (v === null || v === undefined) return "N/A";
    if (typeof v === "object") return "N/A"; // prevents React crash
    return String(v);
  };

  // ------------------------
  // FETCH STUDENTS
  // ------------------------
  useEffect(() => {
    const fetchStudents = async () => {
      if (!schoolId) return;

      try {
        setLoading(true);
        const normalizedId = schoolId.trim().toLowerCase();

        const q = query(
          collection(db, "studentAccounts"),
          where("schoolId", "==", normalizedId)
        );

        const snap = await getDocs(q);

        const accounts = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            name: data.fullName || "N/A",
            email: typeof data.email === "string" ? data.email : "N/A",
            createdAt: data.createdAt?.toDate?.()?.toLocaleString() || "N/A",
          };
        });

        // Merge class-level info (attendance, avg score)
        const enriched = [];

        for (let s of accounts) {
          const classId = `${normalizedId}_${s.className}`;
          const ref = doc(db, "classes", classId, "students", String(s.rollNumber));
          const snapExtra = await getDoc(ref);
          const extra = snapExtra.exists() ? snapExtra.data() : {};

          enriched.push({
            ...s,
            attendance: extra.attendance ?? 0,
            averageScore: extra.averageScore ?? 0,
            behavior: extra.behavior || "N/A",
          });
        }

        setStudents(enriched);
      } catch (err) {
        console.error("Student fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [schoolId]);

  // ------------------------
  // FETCH QUIZ REPORTS
  // ------------------------
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const snap = await getDocs(collection(db, "reports"));
        const ids = students.map((s) => s.id);

        const relevant = [];

        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (ids.includes(d.userId)) relevant.push({ id: docSnap.id, ...d });
        });

        setReports(relevant);
      } catch (err) {
        console.error("Report fetch error:", err);
      }
    };

    if (students.length > 0) fetchReports();
  }, [students]);

  // ------------------------
  // CLASS LIST
  // ------------------------
  const getClassList = () => {
    const list = new Set(students.map((s) => s.className));
    return Array.from(list).sort();
  };

  // ------------------------
  // GET STUDENT QUIZ STATS
  // ------------------------
  const getStudentStats = (id) => {
    const list = reports.filter((r) => r.userId === id);
    const total = list.length;

    const avg =
      total > 0
        ? (
            list.reduce((sum, r) => sum + (r.percentage || 0), 0) / total
          ).toFixed(1)
        : "N/A";

    let level = "N/A";
    if (avg !== "N/A") {
      const val = parseFloat(avg);
      if (val < 40) level = "Weak";
      else if (val < 70) level = "Average";
      else level = "Strong";
    }

    return { total, avg, level };
  };

  // ------------------------
  // FILTERED STUDENTS
  // ------------------------
  const filtered = students.filter((s) => {
    const matchesName = s.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass ? s.className === filterClass : true;
    return matchesName && matchesClass;
  });

  return (
    <div className="student-details-container">
      <h2>🎓 Student Details</h2>

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Filter by Class:</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
          >
            <option value="">All</option>
            {getClassList().map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Search Name:</label>
          <input
            type="text"
            placeholder="Enter student name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="loading-text">Loading student data...</p>
      ) : filtered.length === 0 ? (
        <p>No students found.</p>
      ) : (
        <table className="student-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Roll</th>
              <th>Email</th>
              <th>Attendance</th>
              <th>Avg %</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((student) => {
              const { avg, level } = getStudentStats(student.id);

              return (
                <tr
                  key={student.id}
                  className="clickable-row"
                  onClick={() => (window.location.href = `/students/${student.id}`)}
                >
                  <td>{safe(student.name)}</td>
                  <td>{safe(student.className)}</td>
                  <td>{safe(student.rollNumber)}</td>
                  <td>{safe(student.email)}</td>
                  <td>{safe(student.attendance)}%</td>
                  <td>{safe(avg)}</td>
                  <td className={`status ${level.toLowerCase()}`}>
                    {safe(level)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StudentDetails;
