import React, { useState } from "react";
import "./TeacherClassManager.css";
import TeacherClasses from "./TeacherClasses";
import TeacherStudentManager from "./TeacherStudentManager";

const TeacherClassManager = ({ teacher }) => {
  const [activeTab, setActiveTab] = useState("assign");

  return (
    <div className="teacher-class-manager">
      <div className="tab-switch-header glass-card">
        <button
          className={`tab-btn ${activeTab === "assign" ? "active" : ""}`}
          onClick={() => setActiveTab("assign")}
        >
          👩‍🏫 Assign Teachers
        </button>
        <button
          className={`tab-btn ${activeTab === "students" ? "active" : ""}`}
          onClick={() => setActiveTab("students")}
        >
          🎓 Student Management
        </button>
      </div>

      <div className="tab-content">
        {activeTab === "assign" ? (
          <TeacherClasses teacher={teacher} />
        ) : (
          <TeacherStudentManager teacher={teacher} />
        )}
      </div>
    </div>
  );
};

export default TeacherClassManager;
