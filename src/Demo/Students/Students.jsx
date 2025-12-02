import React, { useState } from "react";
import { students, reports } from "../data/dummyData";
import {
  Search,
  User,
  BarChart3,
  CalendarCheck,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function Students() {
  const [query, setQuery] = useState("");

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase())
  );

  const avgScore = Math.round(
    students.reduce((acc, s) => acc + s.score, 0) / students.length
  );
  const avgAttendance = reports.overallAttendance;
  const topStudents = students
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const performanceData = [
    { name: "Class 6", value: 82 },
    { name: "Class 7", value: 87 },
    { name: "Class 8", value: 91 },
    { name: "Class 9", value: 85 },
  ];

  return (
    <div className="crm-students">
      <style>{studentsStyles}</style>

      <h1 className="page-title">🎓 Students</h1>
      <p className="page-subtitle">
        Manage student data, analyze performance, and track attendance.
      </p>

      {/* --- TOP CARDS --- */}
      <div className="student-grid top">
        <Card
          title="Total Students"
          value={students.length}
          icon={<User size={20} />}
          color="#6366F1"
        />
        <Card
          title="Average Score"
          value={`${avgScore}%`}
          icon={<BarChart3 size={20} />}
          color="#10B981"
        />
        <Card
          title="Attendance Rate"
          value={`${avgAttendance}%`}
          icon={<CalendarCheck size={20} />}
          color="#F59E0B"
        />
        <Card
          title="Top Performers"
          value={topStudents.length}
          icon={<Award size={20} />}
          color="#8B5CF6"
        />
      </div>

      {/* --- CHART --- */}
      <div className="crm-panel chart">
        <h3>📊 Academic Performance by Class</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={performanceData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#6366F1" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* --- SEARCH BAR --- */}
      <div className="search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search students by name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* --- STUDENT TABLE --- */}
      <div className="crm-panel table">
        <h3>🧑‍🏫 Student List</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Class</th>
              <th>Score</th>
              <th>Attendance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredStudents.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.class}</td>
                <td>{s.score}%</td>
                <td>{s.attendance}%</td>
                <td>
                  <span
                    className={`badge ${
                      s.score >= 90
                        ? "top"
                        : s.score >= 70
                        ? "avg"
                        : "low"
                    }`}
                  >
                    {s.score >= 90
                      ? "Top"
                      : s.score >= 70
                      ? "Good"
                      : "Needs Improvement"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- RECOGNITION PANEL --- */}
      <div className="crm-panel recognition">
        <h3>🏅 Student Achievers</h3>
        <div className="achievers-grid">
          {topStudents.map((s, i) => (
            <div key={i} className="achiever-card">
              <div className="rank">#{i + 1}</div>
              <p className="name">{s.name}</p>
              <p className="class">{s.class}</p>
              <p className="score">{s.score}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ----- CARD SUBCOMPONENT ----- */
const Card = ({ title, value, icon, color }) => (
  <div className="student-card" style={{ borderTop: `5px solid ${color}` }}>
    <div className="icon" style={{ background: color }}>{icon}</div>
    <div>
      <h4>{title}</h4>
      <p>{value}</p>
    </div>
  </div>
);

/* ----- INLINE STYLES ----- */
const studentsStyles = `
.crm-students {
  font-family: 'Inter', 'Poppins', sans-serif;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 10px 4px 40px;
}
.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111827;
}
.page-subtitle {
  color: #6b7280;
  margin-bottom: 14px;
}
.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 20px;
}
.student-card {
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  transition: transform 0.25s ease;
}
.student-card:hover {
  transform: translateY(-3px);
}
.student-card .icon {
  width: 42px;
  height: 42px;
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.student-card h4 {
  font-size: 0.95rem;
  color: #374151;
  margin: 0;
}
.student-card p {
  font-weight: 700;
  font-size: 1.4rem;
  color: #1e293b;
  margin: 2px 0;
}

/* PANELS */
.crm-panel {
  background: white;
  border-radius: 18px;
  box-shadow: 0 8px 22px rgba(0,0,0,0.05);
  border: 1px solid rgba(0,0,0,0.04);
  padding: 24px 26px;
}
.crm-panel h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 16px;
}

/* CHART */
.crm-panel.chart {
  padding-bottom: 30px;
}

/* SEARCH */
.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f9fafb;
  padding: 12px 16px;
  border-radius: 14px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.04);
}
.search-bar input {
  border: none;
  outline: none;
  background: transparent;
  width: 100%;
  font-size: 0.95rem;
}

/* TABLE */
.crm-panel.table table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.crm-panel.table th {
  text-align: left;
  padding: 12px;
  background: #f3f4f6;
  color: #374151;
  font-weight: 600;
}
.crm-panel.table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.crm-panel.table tr:hover {
  background: #f9fafb;
}
.badge {
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}
.badge.top { background: #10b981; }
.badge.avg { background: #3b82f6; }
.badge.low { background: #ef4444; }

/* RECOGNITION */
.crm-panel.recognition {
  text-align: center;
}
.achievers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-top: 20px;
}
.achiever-card {
  background: linear-gradient(135deg, #f9fafb, #ffffff);
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.05);
  transition: transform 0.3s ease;
}
.achiever-card:hover {
  transform: translateY(-4px);
}
.achiever-card .rank {
  background: #6366f1;
  color: white;
  font-weight: 700;
  display: inline-block;
  padding: 4px 10px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.achiever-card .name {
  font-weight: 600;
  color: #1e293b;
}
.achiever-card .class {
  color: #64748b;
  font-size: 0.85rem;
}
.achiever-card .score {
  color: #16a34a;
  font-weight: 700;
  font-size: 1.2rem;
  margin-top: 6px;
}
`;

