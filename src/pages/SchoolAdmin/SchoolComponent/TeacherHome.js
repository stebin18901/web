import React, { useState } from "react";
import StatsOverview from "./Teacher_Home/StatsOverview";
import TopPerformers from "./Teacher_Home/TopPerformers";
import "./TeacherHome.css";
import ClassTeacherManager from "./Teacher_Home/ClassTeacherManager";
import TimetableManager from "./Teacher_Home/TimetableManager";

export default function TeacherHome({ schoolId, school }) {
  const mockStudents = [
    { name: "Aarav", class: "8A", score: 94 },
    { name: "Diya", class: "7B", score: 91 },
  ];

  const tabs = [
    { id: "overview", label: "Overview", component: <StatsOverview /> },
    { id: "classes", label: "Class", component: <ClassTeacherManager schoolId={schoolId} school={school} /> },
    { id: "timetable", label: "Table", component: <TimetableManager schoolId={schoolId} school={school} /> },
    { id: "performers", label: "Toppers", component: <TopPerformers students={mockStudents} /> },
  ];

  const [activeTab, setActiveTab] = useState("classes");

  return (
    <div className="teacher-dashboard">
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

      <div className="tag-content">
        {tabs.find((tab) => tab.id === activeTab)?.component}
      </div>
    </div>
  );
}
