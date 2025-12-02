import React, { useState } from "react";
import StatsOverview from "./Teacher_Home/StatsOverview";
import TopPerformers from "./Teacher_Home/TopPerformers";
import "./TeacherHome.css";
import ClassTeacherManager from "./Teacher_Home/ClassTeacherManager";
import TimetableManager from "./Teacher_Home/TimetableManager";

export default function TeacherHome({ schoolId }) {
  // === Mock Data (replace later with Firebase) ===
  const mockQuizzes = [
    { title: "Math Quiz 1", avg: 78, date: "Oct 15" },
    { title: "Science Test", avg: 82, date: "Oct 10" },
  ];

  const mockStudents = [
    { name: "Aarav", class: "8A", score: 94 },
    { name: "Diya", class: "7B", score: 91 },
  ];

  const mockAnnouncements = [
    { title: "Next Quiz Scheduled for Monday", date: "Oct 17" },
  ];

  // === Tabs ===
  const tabs = [
    { id: "overview", label: "Overview", component: <StatsOverview /> },
    { id: "teachers", label: "Teachers", component: <ClassTeacherManager schoolId={schoolId} /> },
    { id: "timetable", label: "Table", component: <TimetableManager /> },
    { id: "performers", label: "Toppers", component: <TopPerformers students={mockStudents} /> },
  ];

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="teacher-dashboard">

      {/* === Tag Navigation === */}
      <div className="tag-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`tag-btn ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* === Active Section === */}
      <div className="tag-content">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}
