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
  { id: "schoolQuiz", label: "School Quiz", group: "Schools", note: "Manage school quiz flows" },
  { id: "schools", label: "Schools", group: "Schools", note: "Manage schools and access links" },
  { id: "subscriptions", label: "Subscriptions", group: "Schools", note: "Control plan pricing and visibility" },
  { id: "createquiz", label: "Chapter Mgt", group: "Content", note: "Switch and manage chapter quiz content" },
  { id: "createchapter", label: "Create chapter", group: "Content", note: "Create and review chapters" },
  { id: "quizdemopdf", label: "Quiz Demo PDF", group: "Content", note: "Maintain demo kit PDF" },
  { id: "demo", label: "Demo", group: "Content", note: "Upload and preview HTML demo content" },
  { id: "report", label: "Report card", group: "Analytics", note: "Review student report summaries" },
  { id: "feature", label: "Feature", group: "Operations", note: "Manage feature announcements" },
  { id: "calender", label: "Calender", group: "Operations", note: "Plan school calendar items" },
  { id: "news", label: "News template", group: "Operations", note: "Edit reusable news templates" },
  { id: "premiumchapter", label: "Premium chapter", group: "Operations", note: "Manage premium chapter access" },
  { id: "league", label: "League", group: "Operations", note: "Run league events and schedules" },
  { id: "apk", label: "APK Management", group: "Operations", note: "Publish Android app releases" },
];

const AdminPanel = () => {
  const [activeTab, setActiveTab] = useState("schoolQuiz");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleTabClick = (tabName) => {
    setActiveTab(tabName);
    setIsSidebarOpen(false);
  };

  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || "Admin Workspace";
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab);
  const groupedTabs = tabs.reduce((acc, tab) => {
    const key = tab.group || "Workspace";
    if (!acc[key]) acc[key] = [];
    acc[key].push(tab);
    return acc;
  }, {});

  return (
    <div className="admin-layout">
      {isSidebarOpen && <div className="admin-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`admin-sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-head">
          <div>
            <p className="admin-kicker">Control Center</p>
            <h1 className="admin-title">Admin 189201</h1>
            <p className="admin-sidebar-copy">Responsive workspace for schools, content, reports, and releases.</p>
          </div>
          <button className="icon-btn close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close menu">
            &times;
          </button>
        </div>

        <nav className="sidebar-tabs">
          {Object.entries(groupedTabs).map(([groupName, groupTabs]) => (
            <div key={groupName} className="sidebar-group">
              <p className="sidebar-group-title">{groupName}</p>
              <div className="sidebar-group-list">
                {groupTabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => handleTabClick(tab.id)}
                  >
                    <span className="tab-button-label">{tab.label}</span>
                    <small className="tab-button-note">{tab.note}</small>
                  </button>
                ))}
              </div>
            </div>
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
            <p className="admin-subtitle">
              {activeTabMeta?.note || "Manage schools, quizzes, reports, templates, league operations, and APK releases."}
            </p>
          </div>
          <div className="admin-topbar-badge">{tabs.length} modules</div>
        </header>

        <section className="admin-overview-strip">
          <article className="admin-overview-card focus">
            <span>Active module</span>
            <strong>{activeTabLabel}</strong>
            <p>{activeTabMeta?.group || "Workspace"} operations ready to manage.</p>
          </article>
          <article className="admin-overview-card">
            <span>Navigation</span>
            <strong>{Object.keys(groupedTabs).length} groups</strong>
            <p>Organized for faster access on desktop and mobile.</p>
          </article>
          <article className="admin-overview-card">
            <span>Workspace</span>
            <strong>Responsive</strong>
            <p>Sidebar, topbar, and content panels adapt across screen sizes.</p>
          </article>
        </section>

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
