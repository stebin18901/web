import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { QuizProvider } from "./context/QuizContext";
import { LeaderboardProvider } from "./context/LeaderboardContext";
import { TeacherAuthProvider } from "./context/TeacherAuthContext"; 
import { TeacherDataProvider } from "./context/TeacherDataContext";

import Home from "./pages/Home";
import Login from "./pages/Login";
import QuizPage from "./pages/QuizPage";
import Dashboard from "./pages/Dashboard";
import AdminPanel from "./pages/AdminPanel";
import "./App.css";
import SubjectQuizPage from "./pages/SubjectQuizPage";
import SubDetail from "./pages/SubDetail";
import ConceptList from "./pages/new/ConceptList";
import Quiz from "./pages/new/Quiz";
import AdminQCreate from "./pages/Admin/AdminQCreate";
import ReportCard from "./pages/new/ReportCard";
import SchoolAdmin from "./pages/SchoolAdmin/SchoolAdmin";
import FeatureDetails from "./pages/FeatureDetails";
import NotFound from "./pages/NotFound";
import AboutPage from "./pages/AboutPage";
import TutorView from "./pages/new/TutorView";
import ChapterList from "./pages/new/ChapterList";
import PremiumWrapper from "./PremiumWrapper/PremiumWrapper";
import Pricing from "./components/Pricing";
import NotesViewer from "./pages/NotesViewer";
import AdminProtect from "./pages/Admin/AdminProtect";

import MainHome from "./pages/MainHome";
import DemoApp from "./Demo/DemoApp";

// ✅ Teacher-specific imports
import TeacherLogin from "./pages/Teacher/TeacherLogin";
import TeacherDashboard from "./pages/Teacher/TeacherDashboard";
import TeacherProtect from "./pages/Teacher/TeacherProtect";
import TeacherPublicRoute from "./routes/TeacherPublicRoute"; // ✅ NEW
import StudentProfile from "./pages/students/[id]";

// ✅ Private route for student dashboard
const PrivateRoute = ({ element }) => {
  const { user } = useAuth();
  return user ? element : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <QuizProvider>
        <LeaderboardProvider>
          <Router>
            <Routes>
              {/* ===================================== */}
              {/* 🔹 STUDENT & GENERAL ROUTES */}
              {/* ===================================== */}
              <Route path="/" element={<MainHome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/demo" element={<DemoApp />} />
              <Route
                path="/quiz/:quizId"
                element={<PrivateRoute element={<QuizPage />} />}
              />
              <Route
                path="/dashboard"
                element={<PrivateRoute element={<Dashboard />} />}
              />
              <Route
                path="/admin189201"
                element={<AdminProtect element={<AdminPanel />} />}
              />
              <Route path="/students/:id" element={<StudentProfile />} />
              <Route path="/school-admin/*" element={<SchoolAdmin />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/test" element={<NotesViewer />} />

              {/* ===================================== */}
              {/* 🔹 TEACHER ROUTES */}
              {/* ===================================== */}

              {/* 🟢 Public route (login/register) */}
              <Route
                path="/teacher-login"
                element={
                  <TeacherAuthProvider>
                    <TeacherPublicRoute element={<TeacherLogin />} />
                  </TeacherAuthProvider>
                }
              />

              {/* 🔒 Protected route (dashboard) */}
              <Route
                path="/teacher-dashboard/*"
                element={
                  <TeacherAuthProvider>
                    <TeacherProtect
                      element={
                        <TeacherDataProvider>
                          <TeacherDashboard />
                        </TeacherDataProvider>
                      }
                    />
                  </TeacherAuthProvider>
                }
              />

              {/* ===================================== */}
              {/* ❌ 404 PAGE */}
              {/* ===================================== */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </LeaderboardProvider>
      </QuizProvider>
    </AuthProvider>
  );
};

export default App;
