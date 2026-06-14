import React, { useState } from "react";
import "./AdminPanel.css"; // Optional: For styling
import SchoolQuiz from "./Admin/SchoolQuiz";
import Schools from "./Admin/Schools";
import SchoolQuizSwitch from "./Admin/SchoolQuizSwitch";
import AdminQCreate from "./Admin/AdminQCreate";
import ReportAdmin from "./Admin/reportAdmin";
import AdminAddFeature from "./Admin/AdminAddFeature";
import AdminCalendar from "./Admin/AdminCalendar";
import AdminTemplates from "./Admin/AdminTemplates";
import CreateTutor from "./Admin/CreateTutor";
import AdminCreateLeague from "./Admin/AdminCreateLeague";
import AdminSubscriptionSettings from "./Admin/AdminSubscriptionSettings";

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("schoolQuiz"); // Default active tab
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const tabs = [
    { id: "schoolQuiz", label: "School Quiz" },
    { id: "schools", label: "Schools" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "createquiz", label: "Chapter Mgt" },
    { id: "createchapter", label: "Create chapter" },
    { id: "report", label: "Report card" },
    { id: "feature", label: "Feature" },
    { id: "calender", label: "Calender" },
    { id: "news", label: "news template" },
    { id: "premiumchapter", label: "Premium chapter" },
    { id: "league", label: "League" },
  ];

  // Function to handle tab clicks
  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setIsSidebarOpen(false);
  };

  return (
    <div className="admin-layout">
      {isSidebarOpen && <div className="admin-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <div>
            <p className="admin-kicker">Control Center</p>
            <h1 className="admin-title">Admin</h1>
          </div>
          <button className="icon-btn close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu">
            ×
          </button>
        </div>

        <nav className="sidebar-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="admin-panel">
        <header className="admin-topbar">
          <button className="icon-btn menu-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div>
            <h2 className="topbar-title">{tabs.find((t) => t.id === activeTab)?.label || "Admin Workspace"}</h2>
            <p className="admin-subtitle">Manage schools, quizzes, reports, templates, and league operations.</p>
          </div>
        </header>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === "schoolQuiz" && <SchoolQuiz />}
          {activeTab === "schools" && <Schools />}
          {activeTab === "subscriptions" && <AdminSubscriptionSettings />}
          {activeTab === "createquiz" && <SchoolQuizSwitch />}
          {activeTab === "createchapter" && <AdminQCreate />}
          {activeTab === "report" && <ReportAdmin />}
          {activeTab === "premiumchapter" && <CreateTutor />}
          {activeTab === "feature" && <AdminAddFeature />}
          {activeTab === "calender" && <AdminCalendar />}
          {activeTab === "news" && <AdminTemplates />}
          {activeTab === "league" && <AdminCreateLeague />}
          {/* Add more tab content as needed AdminUploadJourney*/}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
