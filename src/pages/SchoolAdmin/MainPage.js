// src/pages/SchoolAdmin/MainPage.js
import React from "react";
import { Routes, Route, Navigate, NavLink, Outlet } from "react-router-dom";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import UploadStudents from "./SchoolComponent/UploadStudents";
import StudentDetails from "./SchoolComponent/StudentDetails";
import QuizAnalytics from "./SchoolComponent/QuizAnalytics";
import TeacherHome from "./SchoolComponent/TeacherHome";
import Sidebar from "./SchoolComponent/Sidebar";
import AttendancePage from "./SchoolComponent/AttendancePage";
import ExamMarksPage from "./SchoolComponent/ExamMarksPage";
import AcademicReportsPage from "./SchoolComponent/AcademicReportsPage";
import FeeManagement from "./SchoolComponent/FeeManagement";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  CalendarCheck,
  FileSpreadsheet,
  BadgeIndianRupee,
} from "lucide-react";
import "./MainPage.css";
import Announcement from "./SchoolComponent/Announcement";

const SectionShell = ({ title, description, tabs = [] }) => (
  <div className="school-admin-section-shell">
    <div className="school-admin-section-head">
      <div>
        <p className="school-admin-section-kicker">{title}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>

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

const hasPaidSchoolAccess = (schoolData) => {
  const explicitPaid = schoolData?.isPaidSchool === true || schoolData?.isPaid === true;
  const paymentStatus = String(schoolData?.paymentStatus || "").trim().toLowerCase();
  const status = String(schoolData?.status || "").trim().toLowerCase();
  return explicitPaid || ["paid", "active", "true", "yes"].includes(paymentStatus) || ["paid", "active", "true", "yes"].includes(status);
};

const MainPage = ({ school, onLogout }) => {
  const [currentSchool, setCurrentSchool] = React.useState(school);

  React.useEffect(() => {
    setCurrentSchool(school);
  }, [school]);

  React.useEffect(() => {
    const loadLatestSchool = async () => {
      const schoolId = String(school?.schoolId || "").trim();
      if (!schoolId) return;

      const directSnap = await getDoc(doc(db, "schools", schoolId));
      if (directSnap.exists()) {
        setCurrentSchool((prev) => ({ ...(prev || {}), id: directSnap.id, ...directSnap.data() }));
        return;
      }

      const normalizedId = schoolId.toLowerCase();
      if (normalizedId && normalizedId !== schoolId) {
        const normalizedSnap = await getDoc(doc(db, "schools", normalizedId));
        if (normalizedSnap.exists()) {
          setCurrentSchool((prev) => ({ ...(prev || {}), id: normalizedSnap.id, ...normalizedSnap.data() }));
          return;
        }
      }

      const bySchoolId = await getDocs(
        query(collection(db, "schools"), where("schoolId", "==", normalizedId), limit(1))
      );
      if (!bySchoolId.empty) {
        const match = bySchoolId.docs[0];
        setCurrentSchool((prev) => ({ ...(prev || {}), id: match.id, ...match.data() }));
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
        setCurrentSchool((prev) => ({ ...(prev || {}), id: matchedSchool.id, ...matchedSchool.data() }));
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
          <Routes>
            <Route path="/" element={<Navigate to="home" />} />
            <Route path="home" element={<TeacherHome school={currentSchool} schoolId={currentSchool.schoolId} />} />
            <Route
              path="students"
              element={
                <SectionShell
                  title="Students"
                  description="Manage student uploads and review student records from one shared workspace."
                  tabs={[
                    ...(isPaidSchool ? [{ label: "Upload Students", to: "upload" }] : []),
                    { label: "Student Details", to: "details" },
                  ]}
                />
              }
            >
              <Route index element={<Navigate to={isPaidSchool ? "upload" : "details"} replace />} />
              {isPaidSchool ? (
                <Route
                  path="upload"
                  element={<UploadStudents school={currentSchool} schoolId={currentSchool.schoolId} forcePaidAccess={isPaidSchool} />}
                />
              ) : null}
              <Route path="details" element={<StudentDetails schoolId={currentSchool.schoolId} />} />
            </Route>
            <Route
              path="fees"
              element={<FeeManagement schoolId={currentSchool.schoolId} schoolName={currentSchool?.schoolName || ""} />}
            />
            <Route
              path="attendance"
              element={
                <AttendancePage
                  schoolId={currentSchool.schoolId}
                  actorName={currentSchool?.schoolName || "School Admin"}
                />
              }
            />
            <Route
              path="academics"
              element={
                <SectionShell
                  title="Academics"
                  description="Work across exam marks, academic reports, and quiz analytics from one academic command center."
                  tabs={[
                    { label: "Exam Marks", to: "exam-marks" },
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
                  <ExamMarksPage
                    schoolId={currentSchool.schoolId}
                    actorName={currentSchool?.schoolName || "School Admin"}
                  />
                }
              />
              <Route path="reports" element={<AcademicReportsPage schoolId={currentSchool.schoolId} />} />
              <Route path="analytics" element={<QuizAnalytics schoolId={currentSchool.schoolId} />} />
            </Route>
            <Route path="upload" element={<Navigate to={isPaidSchool ? "/school-admin/students/upload" : "/school-admin/students/details"} replace />} />
            <Route path="exam-marks" element={<Navigate to="/school-admin/academics/exam-marks" replace />} />
            <Route path="academic-reports" element={<Navigate to="/school-admin/academics/reports" replace />} />
            <Route path="analytics" element={<Navigate to="/school-admin/academics/analytics" replace />} />
            <Route path="announcements" element={<Announcement schoolId={currentSchool.schoolId} />} />
            <Route path="*" element={<h2>Page Not Found</h2>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default MainPage;
