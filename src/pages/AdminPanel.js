import React, { useState } from "react";
import "./AdminPanel.css";
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
import AdminQuizDemoPdf from "./Admin/AdminQuizDemoPdf";
import AdminApkManagement from "./Admin/AdminApkManagement";
import AdminHtmlDemoManager from "./Admin/AdminHtmlDemoManager";

const tabs = [
  { id: "schoolQuiz", label: "School Quiz" },
  { id: "schools", label: "Schools" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "createquiz", label: "Chapter Mgt" },
  { id: "createchapter", label: "Create chapter" },
  { id: "quizdemopdf", label: "Quiz Demo PDF" },
  { id: "demo", label: "Demo" },
  { id: "report", label: "Report card" },
  { id: "feature", label: "Feature" },
  { id: "calender", label: "Calender" },
  { id: "news", label: "News template" },
  { id: "premiumchapter", label: "Premium chapter" },
  { id: "league", label: "League" },
  { id: "apk", label: "APK Management" },
];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("schoolQuiz");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setIsSidebarOpen(false);
  };

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Admin Workspace";

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
            &times;
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
            &#9776;
          </button>
          <div className="admin-topbar-copy">
            <p className="admin-topbar-eyebrow">Workspace</p>
            <h2 className="topbar-title">{activeTabLabel}</h2>
            <p className="admin-subtitle">Manage schools, quizzes, reports, templates, league operations, and APK releases.</p>
          </div>
          <div className="admin-topbar-badge">{tabs.length} modules</div>
        </header>

        <div className="tab-content">
          {activeTab === "schoolQuiz" && <SchoolQuiz />}
          {activeTab === "schools" && <Schools />}
          {activeTab === "subscriptions" && <AdminSubscriptionSettings />}
          {activeTab === "createquiz" && <SchoolQuizSwitch />}
          {activeTab === "createchapter" && <AdminQCreate />}
          {activeTab === "quizdemopdf" && <AdminQuizDemoPdf />}
          {activeTab === "demo" && <AdminHtmlDemoManager />}
          {activeTab === "report" && <ReportAdmin />}
          {activeTab === "premiumchapter" && <CreateTutor />}
          {activeTab === "feature" && <AdminAddFeature />}
          {activeTab === "calender" && <AdminCalendar />}
          {activeTab === "news" && <AdminTemplates />}
          {activeTab === "league" && <AdminCreateLeague />}
          {activeTab === "apk" && <AdminApkManagement />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
