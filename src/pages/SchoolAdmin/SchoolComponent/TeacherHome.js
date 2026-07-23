import React from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import StatsOverview from "./Teacher_Home/StatsOverviewControlCenter";
import TopPerformers from "./Teacher_Home/TopPerformers";
import "./TeacherHome.css";
import ClassTeacherManager from "./Teacher_Home/ClassTeacherManager";
import TimetableManager from "./Teacher_Home/TimetableManager";
import SchoolTeachersManager from "./Teacher_Home/SchoolTeachersManager";
import YearlySummary from "./Teacher_Home/YearlySummary";

const MOCK_STUDENTS = [
  { name: "Aarav", class: "8A", score: 94 },
  { name: "Diya", class: "7B", score: 91 },
];

const TeacherHome = (props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const schoolId = props?.schoolId || "";
  const school = props?.school || null;
  const academicYear = props?.academicYear || "";
  const commonFormLink = typeof props?.commonFormLink === "string" ? props.commonFormLink : "";
  const teacherFormLink = typeof props?.teacherFormLink === "string" ? props.teacherFormLink : "";

  const [activeTab, setActiveTab] = React.useState("overview");
  const [copyMessage, setCopyMessage] = React.useState("");

  const schoolTitle =
    school && typeof school === "object" && school.schoolName
      ? school.schoolName
      : "School Admin";

  const tabs = React.useMemo(
    () => [
      {
        id: "overview",
        label: "Overview",
        component: <StatsOverview schoolId={schoolId} school={school} academicYear={academicYear} />,
      },
      {
        id: "classes",
        label: "Class",
        component: <ClassTeacherManager schoolId={schoolId} school={school} academicYear={academicYear} />,
      },
      {
        id: "teachers",
        label: "Teachers",
        component: <SchoolTeachersManager schoolId={schoolId} school={school} academicYear={academicYear} />,
      },
      {
        id: "timetable",
        label: "Table",
        component: <TimetableManager schoolId={schoolId} school={school} academicYear={academicYear} />,
      },
      {
        id: "yearly",
        label: "Yearly",
        component: <YearlySummary schoolId={schoolId} school={school} academicYear={academicYear} />,
      },
      {
        id: "performers",
        label: "Toppers",
        component: <TopPerformers students={MOCK_STUDENTS} />,
      },
    ],
    [academicYear, school, schoolId]
  );

  const activeComponent = React.useMemo(
    () => tabs.find((tab) => tab.id === activeTab)?.component || null,
    [activeTab, tabs]
  );

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search || "");
    const requestedTab = String(searchParams.get("tab") || "").trim().toLowerCase();
    if (!requestedTab) return;
    if (tabs.some((tab) => tab.id === requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [location.search, tabs]);

  const flashCopyMessage = React.useCallback((message) => {
    setCopyMessage(message);
    window.setTimeout(() => setCopyMessage(""), 2200);
  }, []);

  const handleCopyLink = React.useCallback(
    async (value, label) => {
      if (!value) return;
      try {
        if (!navigator || !navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
          flashCopyMessage("Clipboard copy is not available on this device");
          return;
        }
        await navigator.clipboard.writeText(value);
        flashCopyMessage(`${label} copied`);
      } catch (error) {
        console.error("Failed to copy dashboard link", error);
        flashCopyMessage("Unable to copy link");
      }
    },
    [flashCopyMessage]
  );

  return (
    <div className="teacher-dashboard">
      <div className="teacher-dashboard-topbar">
        <div className="teacher-dashboard-topbar-copy">
          <span className="teacher-dashboard-kicker">Dashboard</span>
          <h2>{schoolTitle}</h2>
        </div>

        {teacherFormLink || commonFormLink ? (
          <div className="teacher-dashboard-link-actions">
            {teacherFormLink ? (
              <div className="teacher-dashboard-link-card">
                <strong>Teacher Form</strong>
                <div className="teacher-dashboard-link-row">
                  <button type="button" onClick={() => handleCopyLink(teacherFormLink, "Teacher form link")}>
                    <Link2 size={15} />
                    <span>Copy</span>
                  </button>
                  <a href={teacherFormLink} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    <span>Open</span>
                  </a>
                </div>
              </div>
            ) : null}

            {commonFormLink ? (
              <div className="teacher-dashboard-link-card">
                <strong>Student Form</strong>
                <div className="teacher-dashboard-link-row">
                  <button type="button" onClick={() => handleCopyLink(commonFormLink, "Student form link")}>
                    <Link2 size={15} />
                    <span>Copy</span>
                  </button>
                  <a href={commonFormLink} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    <span>Open</span>
                  </a>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {copyMessage ? <div className="teacher-dashboard-copy-status">{copyMessage}</div> : null}

      <div className="tag-nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              navigate(`/school-admin/home?tab=${tab.id}`, { replace: true });
            }}
            className={`tag-btn ${activeTab === tab.id ? "active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tag-content">{activeComponent}</div>
    </div>
  );
};

export default TeacherHome;
