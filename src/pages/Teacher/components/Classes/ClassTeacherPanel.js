import React, { useState } from "react";
import StudentsListForClass from "./StudentsListForClass";
import ClassAttendance from "../Attendance/ClassAttendance";
import ClassAnnouncements from "../Communication/ClassAnnouncements";
import TeacherAssignments from "../Assignments/TeacherAssignments";
import TeacherPerformance from "../Performance/TeacherPerformance";

const tabs = [
  { id: "students", label: "Students" },
  { id: "attendance", label: "Attendance" },
  { id: "assignments", label: "Assignments" },
  { id: "performance", label: "Performance" },
  { id: "announcements", label: "Announcements" },
];

const ClassTeacherPanel = ({ teacher, classData, schoolId }) => {
  const [activeTab, setActiveTab] = useState("students");

  if (!teacher || !classData) return <p>Loading class details...</p>;

  return (
    <div className="class-teacher-panel">
      <div className="panel-header">
        <h2 className="gradient-text">Class {classData.className}</h2>
        <p>
          Grade {classData.grade} - Division {classData.division}
        </p>
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="panel-content">
        {activeTab === "students" && (
          <StudentsListForClass
            classData={classData}
            schoolId={schoolId}
            teacher={teacher}
          />
        )}
        {activeTab === "attendance" && (
          <ClassAttendance
            classData={classData}
            schoolId={schoolId}
            teacher={teacher}
          />
        )}
        {activeTab === "assignments" && (
          <TeacherAssignments
            classData={classData}
            schoolId={schoolId}
            teacher={teacher}
            classMode={true}
          />
        )}
        {activeTab === "performance" && (
          <TeacherPerformance
            classData={classData}
            schoolId={schoolId}
            teacher={teacher}
            classMode={true}
          />
        )}
        {activeTab === "announcements" && (
          <ClassAnnouncements
            classData={classData}
            schoolId={schoolId}
            teacher={teacher}
          />
        )}
      </div>
    </div>
  );
};

export default ClassTeacherPanel;
