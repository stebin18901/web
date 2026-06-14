import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { QuizProvider } from "./context/QuizContext";
import { LeaderboardProvider } from "./context/LeaderboardContext";
import { TeacherAuthProvider } from "./context/TeacherAuthContext";
import { TeacherDataProvider } from "./context/TeacherDataContext";

import Login from "./pages/Login";
import QuizPage from "./pages/QuizPage";
import Dashboard from "./pages/Dashboard";
import LeaderboardPage from "./pages/LeaderboardPage";
import StudentNotePage from "./pages/StudentNotePage";
import LeaguePage from "./pages/LeaguePage";
import LeagueCreateQuizPage from "./pages/LeagueCreateQuizPage";
import AdminPanel from "./pages/AdminPanel";
import ManageLeagueAdmin from "./pages/ManageLeagueAdmin";
import "./App.css";
import AdminProtect from "./pages/Admin/AdminProtect";
import MainHome from "./pages/MainHome";
import DemoApp from "./Demo/DemoApp";
import TeacherLogin from "./pages/Teacher/TeacherLogin";
import TeacherDashboard from "./pages/Teacher/TeacherDashboard";
import TeacherProtect from "./pages/Teacher/TeacherProtect";
import TeacherPublicRoute from "./routes/TeacherPublicRoute";
import StudentProfile from "./pages/students/[id]";
import SchoolAdmin from "./pages/SchoolAdmin/SchoolAdmin";
import SchoolMagicAuth from "./pages/SchoolAdmin/SchoolMagicAuth";
import AboutPage from "./pages/AboutPage";
import Pricing from "./components/Pricing";
import PricingNew from "./components/PricingNew";
import SubscriptionCheckout from "./components/SubscriptionCheckout";
import SubscriptionStatus from "./pages/SubscriptionStatus";
import NotesViewer from "./pages/NotesViewer";
import NotFound from "./pages/NotFound";
import ClassIntakeForm from "./pages/SchoolAdmin/SchoolComponent/ClassIntakeForm";
import QuizAttemptReport from "./pages/QuizAttemptReport";
import PaymentSuccess from "./pages/PaymentSuccess";
import PlanSelection from "./pages/PlanSelection";

const PrivateRoute = ({ element }) => {
  const { user } = useAuth();
  const studentSession = localStorage.getItem("schoolStudentSession");
  return user || studentSession ? element : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <AuthProvider>
      <QuizProvider>
        <LeaderboardProvider>
          <Router>
            <Routes>
              <Route path="/home" element={<MainHome />} />
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/demo" element={<DemoApp />} />
              <Route path="/quiz/:quizId" element={<PrivateRoute element={<QuizPage />} />} />
              <Route path="/quiz-report" element={<PrivateRoute element={<QuizAttemptReport />} />} />
              <Route path="/dashboard" element={<PrivateRoute element={<Dashboard />} />} />
              <Route path="/notes-view" element={<PrivateRoute element={<StudentNotePage />} />} />
              <Route path="/leaderboard" element={<PrivateRoute element={<LeaderboardPage />} />} />
              <Route path="/league" element={<PrivateRoute element={<LeaguePage />} />} />
              <Route path="/league/create-quiz" element={<PrivateRoute element={<LeagueCreateQuizPage />} />} />
              <Route path="/league/create-quiz/:quizId" element={<PrivateRoute element={<LeagueCreateQuizPage />} />} />
              <Route path="/admin189201" element={<AdminProtect element={<AdminPanel />} />} />
              <Route path="/manage-league-admin" element={<AdminProtect element={<ManageLeagueAdmin />} />} />
              <Route path="/students/:id" element={<StudentProfile />} />
              <Route path="/school-admin/*" element={<SchoolAdmin />} />
              <Route path="/school-auth/:token" element={<SchoolMagicAuth />} />
              <Route path="/sa/:token" element={<SchoolMagicAuth />} />
              <Route path="/sl/:token" element={<SchoolMagicAuth mode="logout" />} />
              <Route path="/class-form/:schoolId/:className/:type" element={<ClassIntakeForm />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<PricingNew />} />
              <Route path="/subscribe" element={<PrivateRoute element={<SubscriptionCheckout />} />} />
              <Route path="/subscription-status" element={<PrivateRoute element={<SubscriptionStatus />} />} />
              <Route path="/plan-selection" element={<PlanSelection />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="/test" element={<NotesViewer />} />
              <Route
                path="/teacher-login"
                element={
                  <TeacherAuthProvider>
                    <TeacherPublicRoute element={<TeacherLogin />} />
                  </TeacherAuthProvider>
                }
              />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </LeaderboardProvider>
      </QuizProvider>
    </AuthProvider>
  );
};

export default App;
