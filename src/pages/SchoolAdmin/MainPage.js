// src/pages/SchoolAdmin/MainPage.js
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import Sidebar from "./SchoolComponent/Sidebar";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarCheck,
  FileSpreadsheet,
  BadgeIndianRupee,
  Settings,
  CalendarRange,
  ShieldCheck,
} from "lucide-react";
import "./MainPage.css";
import { getDefaultAcademicYear } from "./SchoolComponent/schoolYearUtils";

const UploadStudents = lazy(() => import("./SchoolComponent/UploadStudents"));
const QuizAnalytics = lazy(() => import("./SchoolComponent/QuizAnalytics"));
const TeacherHome = lazy(() => import("./SchoolComponent/TeacherHome"));
const AttendancePage = lazy(() => import("./SchoolComponent/AttendancePage"));
const ExamMarksPage = lazy(() => import("./SchoolComponent/ExamMarksPage"));
const HomeworksPage = lazy(() => import("./SchoolComponent/HomeworksPage"));
const AcademicReportsPage = lazy(() => import("./SchoolComponent/AcademicReportsPage"));
const StudentReportPage = lazy(() => import("./SchoolComponent/StudentReportPage"));
const FeeManagement = lazy(() => import("./SchoolComponent/FeeManagement"));
const Announcement = lazy(() => import("./SchoolComponent/Announcement"));
const SchoolSettingsHub = lazy(() => import("./SchoolComponent/SchoolSettingsHub"));
const SchoolAdminHelpBot = lazy(() => import("./SchoolComponent/SchoolAdminHelpBot"));

const SectionShell = ({ title, description, tabs = [], activeAcademicYear = "" }) => (
  <div className="school-admin-section-shell">
    {(title || description || activeAcademicYear) ? (
      <div className="school-admin-section-head">
        <div>
          {title ? <h1>{title}</h1> : null}
          {description ? <p>{description}</p> : null}
        </div>
        {activeAcademicYear ? <span className="school-admin-year-chip">Year {activeAcademicYear}</span> : null}
      </div>
    ) : null}
    <div className="school-admin-top-tabs">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `school-admin-top-tab ${isActive ? "active" : ""}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </div>

    <div className="school-admin-section-content">
      <Outlet />
    </div>
  </div>
);

const SectionLoader = ({ children }) => (
  <Suspense
    fallback={
      <div
        style={{
          minHeight: "32vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
          color: "#64748b",
          fontSize: "0.92rem",
          fontWeight: 600,
        }}
      >
        Loading section...
      </div>
    }
  >
    {children}
  </Suspense>
);

const hasPaidSchoolAccess = (schoolData) => {
  const explicitPaid = schoolData?.isPaidSchool === true || schoolData?.isPaid === true;
  const paymentStatus = String(schoolData?.paymentStatus || "").trim().toLowerCase();
  const status = String(schoolData?.status || "").trim().toLowerCase();
  return explicitPaid || ["paid", "active", "true", "yes"].includes(paymentStatus) || ["paid", "active", "true", "yes"].includes(status);
};

const MainPage = ({ school, onLogout }) => {
  const location = useLocation();
  const [currentSchool, setCurrentSchool] = React.useState(school);
  const [activeAcademicYear, setActiveAcademicYear] = React.useState(
    () => window.localStorage.getItem(`school-admin-year:${String(school?.schoolId || "").trim().toLowerCase()}`) || getDefaultAcademicYear()
  );

  React.useEffect(() => {
    setCurrentSchool(school);
  }, [school]);

  React.useEffect(() => {
    const normalizedSchoolId = String(school?.schoolId || "").trim().toLowerCase();
    if (!normalizedSchoolId) return;
    window.localStorage.setItem(`school-admin-year:${normalizedSchoolId}`, activeAcademicYear);
  }, [activeAcademicYear, school]);

  React.useEffect(() => {
    const loadLatestSchool = async () => {
      const exactDocId = String(school?.schoolDocId || school?.id || "").trim();
      const schoolId = String(school?.schoolId || "").trim();
      if (!exactDocId && !schoolId) return;

      if (exactDocId) {
        const exactSnap = await getDoc(doc(db, "schools", exactDocId));
        if (exactSnap.exists()) {
          setCurrentSchool((prev) => ({
            ...(prev || {}),
            ...exactSnap.data(),
            id: exactSnap.id,
            schoolDocId: exactSnap.id,
          }));
          return;
        }
      }

      const directSnap = schoolId ? await getDoc(doc(db, "schools", schoolId)) : null;
      if (directSnap.exists()) {
        setCurrentSchool((prev) => ({
          ...(prev || {}),
          ...directSnap.data(),
          id: directSnap.id,
          schoolDocId: directSnap.id,
        }));
        return;
      }

      const normalizedId = schoolId.toLowerCase();
      if (normalizedId && normalizedId !== schoolId) {
        const normalizedSnap = await getDoc(doc(db, "schools", normalizedId));
        if (normalizedSnap.exists()) {
          setCurrentSchool((prev) => ({
            ...(prev || {}),
            ...normalizedSnap.data(),
            id: normalizedSnap.id,
            schoolDocId: normalizedSnap.id,
          }));
          return;
        }
      }

      const bySchoolId = await getDocs(
        query(collection(db, "schools"), where("schoolId", "==", normalizedId), limit(1))
      );
      if (!bySchoolId.empty) {
        const match = bySchoolId.docs[0];
        setCurrentSchool((prev) => ({
          ...(prev || {}),
          ...match.data(),
          id: match.id,
          schoolDocId: match.id,
        }));
        return;
      }

      const allSchools = await getDocs(collection(db, "schools"));
      const matchedSchool = allSchools.docs.find((entry) => {
        const data = entry.data() || {};
        return [entry.id, data.schoolId]
          .filter(Boolean)
          .some((value) => String(value).trim().toLowerCase() === normalizedId);
      });
      if (matchedSchool) {
        setCurrentSchool((prev) => ({
          ...(prev || {}),
          ...matchedSchool.data(),
          id: matchedSchool.id,
          schoolDocId: matchedSchool.id,
        }));
      }
    };

    loadLatestSchool();
  }, [school]);

  const sidebarLinks = [
    { name: "Dashboard", path: "/school-admin/home", icon: LayoutDashboard },
    { name: "Students", path: "/school-admin/students", icon: Users },
    { name: "Attendance", path: "/school-admin/attendance", icon: CalendarCheck },
    { name: "Academics", path: "/school-admin/academics", icon: FileSpreadsheet },
    { name: "Announcements", path: "/school-admin/announcements", icon: Megaphone },
    { divider: true, name: "divider-settings" },
    { name: "Settings", path: "/school-admin/settings", icon: Settings },
  ];
  const isPaidSchool = hasPaidSchoolAccess(currentSchool);
  if (isPaidSchool) {
    sidebarLinks.splice(2, 0, {
      name: "Fee Management",
      path: "/school-admin/fees",
      icon: BadgeIndianRupee,
    });
  }
  const commonFormLink = currentSchool?.schoolId
    ? `${window.location.origin}/school-form/${currentSchool.schoolId}/student`
    : "";
  const teacherFormLink = currentSchool?.schoolId
    ? `${window.location.origin}/school-form/${currentSchool.schoolId}/teacher`
    : "";
  const currentSectionLabel = React.useMemo(() => {
    if (location.pathname.includes("/students")) return "Students";
    if (location.pathname.includes("/fees")) return "Fees";
    if (location.pathname.includes("/attendance")) return "Attendance";
    if (location.pathname.includes("/academics")) return "Academics";
    if (location.pathname.includes("/announcements")) return "Announcements";
    if (location.pathname.includes("/settings")) return "Settings";
    return "Dashboard";
  }, [location.pathname]);

  return (
    <div className="main-layout">
      <Sidebar
        sidebarTitle={currentSchool?.schoolName || "School Admin"}
        sidebarLogo={currentSchool?.schoolLogo}
        links={sidebarLinks}
        commonFormLink={commonFormLink}
        teacherFormLink={teacherFormLink}
        onLogout={onLogout}
      />

      <main className="content-area">
        <div className="content-container">
          <div className="school-admin-active-year-bar">
            <div className="school-admin-active-year-copy">
              <div className="school-admin-active-year-icon">
                <CalendarRange size={16} />
              </div>
              <div>
                <strong>{currentSchool?.schoolName || "School Admin"}</strong>
                <span>{currentSectionLabel} workspace is using academic year {activeAcademicYear || "Not selected"}.</span>
              </div>
            </div>
            <div className="school-admin-active-year-actions">
              <span className="school-admin-active-year-pill">
                <ShieldCheck size={14} />
                Year scoped workflow
              </span>
              <Link to="/school-admin/settings" className="school-admin-active-year-link">
                Change year in Settings
              </Link>
            </div>
          </div>
          <Routes>
            <Route path="/" element={<Navigate to="home" />} />
            <Route
              path="home"
              element={
                <SectionLoader>
                  <TeacherHome
                    school={currentSchool}
                    schoolId={currentSchool?.schoolId || ""}
                    academicYear={activeAcademicYear}
                    commonFormLink={commonFormLink}
                    teacherFormLink={teacherFormLink}
                  />
                </SectionLoader>
              }
            />
            <Route
              path="students"
              element={
                <SectionShell
                  title="Students"
                  description="Manage student uploads and review student records from one shared workspace."
                  activeAcademicYear={activeAcademicYear}
                  tabs={[
                    ...(isPaidSchool ? [{ label: "Upload Students", to: "upload" }] : []),
                    { label: "Student Report", to: "student-report" },
                  ]}
                />
              }
            >
              <Route index element={<Navigate to={isPaidSchool ? "upload" : "student-report"} replace />} />
              {isPaidSchool ? (
                <Route
                  path="upload"
                  element={<SectionLoader><UploadStudents school={currentSchool} schoolId={currentSchool?.schoolId || ""} forcePaidAccess={isPaidSchool} academicYear={activeAcademicYear} /></SectionLoader>}
                />
              ) : null}
              <Route path="student-report" element={<SectionLoader><StudentReportPage schoolId={currentSchool?.schoolId || ""} academicYear={activeAcademicYear} /></SectionLoader>} />
              <Route path="student-report/:studentId" element={<SectionLoader><StudentReportPage schoolId={currentSchool?.schoolId || ""} academicYear={activeAcademicYear} /></SectionLoader>} />
            </Route>
            <Route
              path="fees"
              element={<SectionLoader><FeeManagement schoolId={currentSchool?.schoolId || ""} schoolName={currentSchool?.schoolName || ""} academicYear={activeAcademicYear} /></SectionLoader>}
            />
            <Route
              path="attendance"
              element={
                <SectionLoader>
                  <AttendancePage
                    schoolId={currentSchool?.schoolId || ""}
                    academicYear={activeAcademicYear}
                    actorName={currentSchool?.schoolName || "School Admin"}
                  />
                </SectionLoader>
              }
            />
            <Route
              path="academics"
              element={
                <SectionShell
                  title="Academics"
                  description="Work across exam marks, academic reports, and quiz analytics from one academic command center."
                  activeAcademicYear={activeAcademicYear}
                  tabs={[
                    { label: "Exam Marks", to: "exam-marks" },
                    { label: "Homeworks", to: "homeworks" },
                    { label: "Academic Reports", to: "reports" },
                    { label: "Quiz Analytics", to: "analytics" },
                  ]}
                />
              }
            >
              <Route index element={<Navigate to="exam-marks" replace />} />
              <Route
                path="exam-marks"
                element={
                  <SectionLoader>
                    <ExamMarksPage
                      schoolId={currentSchool?.schoolId || ""}
                      academicYear={activeAcademicYear}
                      actorName={currentSchool?.schoolName || "School Admin"}
                    />
                  </SectionLoader>
                }
              />
              <Route
                path="homeworks"
                element={
                  <SectionLoader>
                    <HomeworksPage
                      schoolId={currentSchool?.schoolId || ""}
                      academicYear={activeAcademicYear}
                      actorName={currentSchool?.schoolName || "School Admin"}
                    />
                  </SectionLoader>
                }
              />
              <Route path="reports" element={<SectionLoader><AcademicReportsPage schoolId={currentSchool?.schoolId || ""} academicYear={activeAcademicYear} /></SectionLoader>} />
              <Route path="analytics" element={<SectionLoader><QuizAnalytics schoolId={currentSchool?.schoolId || ""} academicYear={activeAcademicYear} /></SectionLoader>} />
            </Route>
            <Route path="upload" element={<Navigate to={isPaidSchool ? "/school-admin/students/upload" : "/school-admin/students/student-report"} replace />} />
            <Route path="student-report" element={<Navigate to="/school-admin/students/student-report" replace />} />
            <Route path="exam-marks" element={<Navigate to="/school-admin/academics/exam-marks" replace />} />
            <Route path="homeworks" element={<Navigate to="/school-admin/academics/homeworks" replace />} />
            <Route path="academic-reports" element={<Navigate to="/school-admin/academics/reports" replace />} />
            <Route path="analytics" element={<Navigate to="/school-admin/academics/analytics" replace />} />
            <Route path="announcements" element={<SectionLoader><Announcement schoolId={currentSchool?.schoolId || ""} academicYear={activeAcademicYear} /></SectionLoader>} />
            <Route
              path="settings"
              element={
                <SectionLoader>
                  <SchoolSettingsHub
                    school={currentSchool}
                    schoolId={currentSchool?.schoolId || ""}
                    schoolName={currentSchool?.schoolName || ""}
                    activeAcademicYear={activeAcademicYear}
                    onAcademicYearChange={setActiveAcademicYear}
                    commonFormLink={commonFormLink}
                    teacherFormLink={teacherFormLink}
                    onPlanUpdated={setCurrentSchool}
                  />
                </SectionLoader>
              }
            />
            <Route path="*" element={<h2>Page Not Found</h2>} />
          </Routes>
          <SectionLoader>
            <SchoolAdminHelpBot
              schoolId={currentSchool?.schoolId || ""}
              academicYear={activeAcademicYear}
            />
          </SectionLoader>
        </div>
      </main>
    </div>
  );
};

export default MainPage;
