import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./QuizAnalytics.css";
import { Bar } from "react-chartjs-2";
import { Chart, registerables } from "chart.js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
Chart.register(...registerables);



const QuizAnalytics = ({ schoolId }) => {
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const handleDownloadPDF = () => {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("Quiz Analytics Report", 14, 15);

  const tableData = filteredReports.map((r) => {
    const student = students.find((s) => s.id === r.userId);
    return [
      student?.name || "N/A",
      student?.class || "N/A",
      r.concept,
      `${r.score}/${r.total}`,
      `${r.percentage}%`,
      r.percentage < 40 ? "Weak" : r.percentage < 70 ? "Average" : "Strong",
    ];
  });

  autoTable(doc, {
    startY: 25,
    head: [["Name", "Class", "Concept", "Score", "%", "Status"]],
    body: tableData,
    theme: "grid",
    styles: { fontSize: 10 },
    headStyles: { fillColor: [22, 160, 133] },
  });

  doc.save(`QuizAnalytics_${selectedClass || "All"}.pdf`);
};


  // Fetch students by school
  useEffect(() => {
    const fetchStudents = async () => {
      const q = query(collection(db, "users"), where("schoolId", "==", schoolId));
      const snap = await getDocs(q);
      const studentList = [];
      snap.forEach((doc) => studentList.push({ id: doc.id, ...doc.data() }));
      setStudents(studentList);
    };
    fetchStudents();
  }, [schoolId]);

  // Fetch reports by student ids
  useEffect(() => {
    const fetchReports = async () => {
      if (students.length === 0) return;
      const allReports = await getDocs(collection(db, "reports"));
      const studentIds = students.map((s) => s.id);
      const schoolReports = [];
      allReports.forEach((doc) => {
        const data = doc.data();
        if (studentIds.includes(data.userId)) {
          schoolReports.push({ id: doc.id, ...data });
        }
      });
      setReports(schoolReports);
    };
    fetchReports();
  }, [students]);

  const filteredStudents = selectedClass
    ? students.filter((s) => s.class === selectedClass)
    : students;

  const filteredReports = reports.filter((r) =>
    selectedStudentId
      ? r.userId === selectedStudentId
      : filteredStudents.some((s) => s.id === r.userId)
  );

  const getClasses = () => {
    const setCls = new Set(students.map((s) => s.class));
    return Array.from(setCls).sort();
  };

  const getStudentListByClass = () => {
    return filteredStudents.map((s) => ({ id: s.id, name: s.name || "Unnamed" }));
  };

  const getLevelStats = () => {
    let weak = 0, avg = 0, strong = 0;
    filteredReports.forEach((r) => {
      if (r.percentage < 40) weak++;
      else if (r.percentage < 70) avg++;
      else strong++;
    });
    return { weak, avg, strong };
  };

  const getChartData = () => {
    const map = {};
    filteredReports.forEach((r) => {
      const student = students.find((s) => s.id === r.userId);
      if (!student) return;
      const cls = student.class;
      if (!map[cls]) map[cls] = [];
      map[cls].push(r.percentage);
    });
    const labels = Object.keys(map);
    const data = labels.map((cls) => {
      const scores = map[cls];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      return parseFloat(avg.toFixed(2));
    });
    return {
      labels,
      datasets: [
        {
          label: "Average %",
          data,
          backgroundColor: "#36A2EB",
        },
      ],
    };
  };

  return (
    <div className="analytics-container">
      <h2>📊 Quiz Analytics</h2>

      <div className="filters">
        <div className="filter-group">
          <label>Filter by Class:</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
            <option value="">All</option>
            {getClasses().map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
        </div>
        {selectedClass && (
          <div className="filter-group">
            <label>Filter by Student:</label>
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
              <option value="">All</option>
              {getStudentListByClass().map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", marginBottom: "10px" }}>
  <button onClick={handleDownloadPDF} className="pdf-button">
    📄 Download PDF
  </button>
</div>


      <div className="level-summary">
        {(() => {
          const { weak, avg, strong } = getLevelStats();
          return (
            <>
              <div className="summary-card weak">Weak: {weak}</div>
              <div className="summary-card average">Average: {avg}</div>
              <div className="summary-card strong">Strong: {strong}</div>
            </>
          );
        })()}
      </div>

      <div className="chart-section">
        <h3>📈 Average Score by Class</h3>
        <Bar data={getChartData()} />
      </div>

      <div className="student-table-section">
        <h3>🧑‍🎓 Student Report Table</h3>
        <table className="student-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Concept</th>
              <th>Score</th>
              <th>%</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((r, i) => {
              const stu = students.find((s) => s.id === r.userId);
              return (
                <tr key={i}>
                  <td>{stu?.name || "N/A"}</td>
                  <td>{stu?.class}</td>
                  <td>{r.concept}</td>
                  <td>{r.score}/{r.total}</td>
                  <td>{r.percentage}%</td>
                  <td className={r.percentage < 40 ? "status weak" : r.percentage < 70 ? "status average" : "status strong"}>
                    {r.percentage < 40 ? "Weak" : r.percentage < 70 ? "Average" : "Strong"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default QuizAnalytics;