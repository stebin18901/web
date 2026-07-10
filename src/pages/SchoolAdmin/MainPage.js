// src/pages/SchoolAdmin/MainPage.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
  Upload,
  Users,
  BarChart3,
  Megaphone,
  CalendarCheck,
  FileSpreadsheet,
  LineChart,
  BadgeIndianRupee,
} from "lucide-react";
import "./MainPage.css";
import Announcement from "./SchoolComponent/Announcement";

const hasPaidSchoolAccess = (schoolData) => {
  const rawStatus = schoolData?.isPaidSchool ?? schoolData?.isPaid ?? schoolData?.paymentStatus ?? schoolData?.status;
  if (typeof rawStatus === "boolean") return rawStatus;
  const normalizedStatus = String(rawStatus || "").trim().toLowerCase();
  return ["paid", "active", "true", "yes"].includes(normalizedStatus);
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
    { name: "Student Details", path: "/school-admin/students", icon: Users },
    { name: "Attendance", path: "/school-admin/attendance", icon: CalendarCheck },
    { name: "Exam Marks", path: "/school-admin/exam-marks", icon: FileSpreadsheet },
    { name: "Academic Reports", path: "/school-admin/academic-reports", icon: LineChart },
    { name: "Quiz Analytics", path: "/school-admin/analytics", icon: BarChart3 },
    { name: "Announcements", path: "/school-admin/announcements", icon: Megaphone },
  ];
  if (hasPaidSchoolAccess(currentSchool)) {
    sidebarLinks.splice(1, 0, { name: "Upload Students", path: "/school-admin/upload", icon: Upload });
    sidebarLinks.splice(3, 0, {
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
            <Route path="upload" element={<UploadStudents school={currentSchool} schoolId={currentSchool.schoolId} />} />
            <Route path="students" element={<StudentDetails schoolId={currentSchool.schoolId} />} />
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
              path="exam-marks"
              element={
                <ExamMarksPage
                  schoolId={currentSchool.schoolId}
                  actorName={currentSchool?.schoolName || "School Admin"}
                />
              }
            />
            <Route path="academic-reports" element={<AcademicReportsPage schoolId={currentSchool.schoolId} />} />
            <Route path="analytics" element={<QuizAnalytics schoolId={currentSchool.schoolId} />} />
            <Route path="announcements" element={<Announcement schoolId={currentSchool.schoolId} />} />
            <Route path="*" element={<h2>Page Not Found</h2>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default MainPage;
