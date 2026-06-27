import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
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
import PricingNew from "./components/PricingNew";
import SubscriptionCheckout from "./components/SubscriptionCheckout";
import SubscriptionStatus from "./pages/SubscriptionStatus";
import NotesViewer from "./pages/NotesViewer";
import NotFound from "./pages/NotFound";
import ClassIntakeForm from "./pages/SchoolAdmin/SchoolComponent/ClassIntakeForm";
import QuizAttemptReport from "./pages/QuizAttemptReport";
import PaymentSuccess from "./pages/PaymentSuccess";
import PlanSelection from "./pages/PlanSelection";
import SchoolRegistrationSuccess from "./pages/SchoolRegistrationSuccess";
import QuizDemoSharePage from "./pages/QuizDemoSharePage";
import Downloads from "./pages/Downloads";

// --- STEP 3 IMPORTS: Compliance Components ---
import Footer from "./components/Footer";
import ContactUs from "./pages/policies/ContactUs";
import TermsAndConditions from "./pages/policies/TermsAndConditions";
import PrivacyPolicy from "./pages/policies/PrivacyPolicy";
import RefundPolicy from "./pages/policies/RefundPolicy";

const PrivateRoute = ({ element }) => {
  const { user } = useAuth();
  const rawStudentSession = localStorage.getItem("schoolStudentSession");

  if (rawStudentSession) {
    try {
      const studentSession = JSON.parse(rawStudentSession);
      if (studentSession?.accessMode === "school-auth") {
        const paymentStatus = String(studentSession.paymentStatus || "").toLowerCase();
        const registrationStatus = String(studentSession.registrationStatus || "").toLowerCase();
        const paid =
          studentSession.isPaid === true ||
          paymentStatus === "paid" ||
          registrationStatus === "active";

        if (!paid) {
          localStorage.removeItem("schoolStudentSession");
          return <Navigate to="/login" replace />;
        }
      }
    } catch {
      localStorage.removeItem("schoolStudentSession");
      return <Navigate to="/login" replace />;
    }
  }

  return user || rawStudentSession ? element : <Navigate to="/login" replace />;
};

const AppContent = () => {
  const location = useLocation();
  const hideGlobalFooter = location.pathname === "/" || location.pathname === "/home";

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/home" element={<MainHome />} />
          <Route path="/" element={<MainHome />} />
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
          <Route path="/school-admin/login" element={<SchoolAdmin />} />
          <Route path="/school-admin/*" element={<SchoolAdmin />} />
          <Route path="/school-auth/:token" element={<SchoolMagicAuth />} />
          <Route path="/sa/:token" element={<SchoolMagicAuth />} />
          <Route path="/sl/:token" element={<SchoolMagicAuth mode="logout" />} />
          <Route path="/school-form/:schoolId/:type" element={<ClassIntakeForm />} />
          <Route path="/class-form/:schoolId/:className/:type" element={<ClassIntakeForm />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/pricing" element={<PricingNew />} />
          <Route path="/subscribe" element={<PrivateRoute element={<SubscriptionCheckout />} />} />
          <Route path="/subscription-status" element={<PrivateRoute element={<SubscriptionStatus />} />} />
          <Route path="/plan-selection" element={<PlanSelection />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/school-registration-success" element={<SchoolRegistrationSuccess />} />
          <Route path="/quiz-demo-share" element={<QuizDemoSharePage />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/test" element={<NotesViewer />} />
          
          {/* --- STEP 3 ROUTES: Public Policy Routes --- */}
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />

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
      </div>

      {!hideGlobalFooter && <Footer />}
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <QuizProvider>
        <LeaderboardProvider>
          <Router>
            <AppContent />
          </Router>
        </LeaderboardProvider>
      </QuizProvider>
    </AuthProvider>
  );
};

export default App;
