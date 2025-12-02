import React, { useState } from "react";
import "./AdminPanel.css"; // Optional: For styling
import SchoolQuiz from "./Admin/SchoolQuiz";
import Schools from "./Admin/Schools";
import CreateQuiz from "./Admin/createQuiz";
import SchoolQuizSwitch from "./Admin/SchoolQuizSwitch";
import CreateChapterQuiz from "./Admin/CreateChapterQuiz";
import AdminSubjects from "./Admin/AdminSubjects";
import AdminQCreate from "./Admin/AdminQCreate";
import ReportAdmin from "./Admin/reportAdmin";
import AdminAddFeature from "./Admin/AdminAddFeature";
import AdminCalendar from "./Admin/AdminCalendar";
import AdminTemplates from "./Admin/AdminTemplates";
import CreateTutor from "./Admin/CreateTutor";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("schoolQuiz"); // Default active tab

  // Function to handle tab clicks
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
  };

  return (
    <div className="admin-panel">
      {/* Tab Navigation */}
      <div className="tabs-nav">
        <button
          className={`tab-button ${activeTab === "schoolQuiz" ? "active" : ""}`}
          onClick={() => handleTabClick("schoolQuiz")}
        >
          School Quiz
        </button>
        <button
          className={`tab-button ${activeTab === "schools" ? "active" : ""}`}
          onClick={() => handleTabClick("schools")}
        >
          Schools
        </button>
        <button
          className={`tab-button ${activeTab === "createquiz" ? "active" : ""}`}
          onClick={() => handleTabClick("createquiz")}
        >
          Chapter Mgt
        </button>
        <button
          className={`tab-button ${activeTab === "createchapterquiz" ? "active" : ""}`}
          onClick={() => handleTabClick("createchapterquiz")}
        >
          Chapterquiz create
        </button>
        <button
          className={`tab-button ${activeTab === "createchapter" ? "active" : ""}`}
          onClick={() => handleTabClick("createchapter")}
        >
          Create chapter
        </button>
        <button
          className={`tab-button ${activeTab === "report" ? "active" : ""}`}
          onClick={() => handleTabClick("report")}
        >
          Report card
        </button>
        <button
          className={`tab-button ${activeTab === "feature" ? "active" : ""}`}
          onClick={() => handleTabClick("feature")}
        >
          Feature
        </button>
        <button
          className={`tab-button ${activeTab === "calender" ? "active" : ""}`}
          onClick={() => handleTabClick("calender")}
        >
          Calender
        </button>
        <button
          className={`tab-button ${activeTab === "news" ? "active" : ""}`}
          onClick={() => handleTabClick("news")}
        >
          news template
        </button>
        <button
          className={`tab-button ${activeTab === "premiumchapter" ? "active" : ""}`}
          onClick={() => handleTabClick("premiumchapter")}
        >
          Premium chapter
        </button>
        {/* Add more tabs as needed */}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "schoolQuiz" && <SchoolQuiz />}
        {activeTab === "schools" && <Schools />}
        {activeTab === "createquiz" && <SchoolQuizSwitch />}
        {activeTab === "createchapterquiz" && <CreateChapterQuiz />}
        {activeTab === "createchapter" && <AdminQCreate />}
        {activeTab === "report" && <ReportAdmin />}
        {activeTab === "premiumchapter" && <CreateTutor />}
        {activeTab === "feature" && <AdminAddFeature />}
        {activeTab === "calender" && <AdminCalendar />}
        {activeTab === "news" && <AdminTemplates />}
        {/* Add more tab content as needed */}
      </div>
    </div>
  );
};

export default AdminPanel;