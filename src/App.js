import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { QuizProvider } from "./context/QuizContext";
import { LeaderboardProvider } from "./context/LeaderboardContext";
import { TeacherAuthProvider } from "./context/TeacherAuthContext";
import { TeacherDataProvider } from "./context/TeacherDataContext";

import Login from "./pages/Login";
import "./App.css";
import AdminProtect from "./pages/Admin/AdminProtect";
import MainHome from "./pages/MainHome";
import DemoApp from "./Demo/DemoApp";
import TeacherLogin from "./pages/Teacher/TeacherLogin";
import TeacherProtect from "./pages/Teacher/TeacherProtect";
import TeacherPublicRoute from "./routes/TeacherPublicRoute";
import NotFound from "./pages/NotFound";
import CreatorProtectRoute from "./components/CreatorProtectRoute";

// --- STEP 3 IMPORTS: Compliance Components ---
import Footer from "./components/Footer";

const QuizPage = lazy(() => import("./pages/QuizPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const StudentNotePage = lazy(() => import("./pages/StudentNotePage"));
const LeaguePage = lazy(() => import("./pages/LeaguePage"));
const LeagueCreateQuizPage = lazy(() => import("./pages/LeagueCreateQuizPage"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ManageLeagueAdmin = lazy(() => import("./pages/ManageLeagueAdmin"));
const TeacherDashboard = lazy(() => import("./pages/Teacher/TeacherDashboard"));
const StudentProfile = lazy(() => import("./pages/students/[id]"));
const SchoolAdmin = lazy(() => import("./pages/SchoolAdmin/SchoolAdmin"));
const SchoolMagicAuth = lazy(() => import("./pages/SchoolAdmin/SchoolMagicAuth"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PricingNew = lazy(() => import("./components/PricingNew"));
const SubscriptionCheckout = lazy(() => import("./components/SubscriptionCheckout"));
const SubscriptionStatus = lazy(() => import("./pages/SubscriptionStatus"));
const NotesViewer = lazy(() => import("./pages/NotesViewer"));
const ClassIntakeForm = lazy(() => import("./pages/SchoolAdmin/SchoolComponent/ClassIntakeForm"));
const QuizAttemptReport = lazy(() => import("./pages/QuizAttemptReport"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PlanSelection = lazy(() => import("./pages/PlanSelection"));
const SchoolRegistrationSuccess = lazy(() => import("./pages/SchoolRegistrationSuccess"));
const QuizDemoSharePage = lazy(() => import("./pages/QuizDemoSharePage"));
const Downloads = lazy(() => import("./pages/Downloads"));
const DemoViewer = lazy(() => import("./pages/DemoViewer"));
const AdminSchoolDetails = lazy(() => import("./pages/Admin/AdminSchoolDetails"));
const BlogListPage = lazy(() => import("./pages/BlogListPage"));
const BlogDetailPage = lazy(() => import("./pages/BlogDetailPage"));
const FantasyLeaguePage = lazy(() => import("./pages/FantasyLeaguePage"));
const CreatorProgramPage = lazy(() => import("./pages/CreatorProgramPage"));
const CreatorLoginPage = lazy(() => import("./pages/CreatorLoginPage"));
const ContactUs = lazy(() => import("./pages/policies/ContactUs"));
const TermsAndConditions = lazy(() => import("./pages/policies/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/policies/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/policies/RefundPolicy"));

const PrivateRoute = ({ element }) => {
  const { user } = useAuth();
  const rawStudentSession = localStorage.getItem("schoolStudentSession");

  if (rawStudentSession) {
    try {
      const studentSession = JSON.parse(rawStudentSession);
      if (["school-auth", "school-plan"].includes(studentSession?.accessMode)) {
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

const FirebaseSubscriptionRoute = ({ element }) => {
  const { user } = useAuth();
  const rawStudentSession = localStorage.getItem("schoolStudentSession");

  if (user) {
    return element;
  }

  if (rawStudentSession) {
    try {
      const studentSession = JSON.parse(rawStudentSession);
      const enrollmentId = String(studentSession?.id || "").trim();
      if (enrollmentId) {
        return <Navigate to={`/plan-selection?enrollmentId=${encodeURIComponent(enrollmentId)}`} replace />;
      }
    } catch {
      localStorage.removeItem("schoolStudentSession");
    }
  }

  return <Navigate to="/login" replace />;
};

const RouteLoader = ({ children }) => (
  <Suspense
    fallback={
      <div
        style={{
          minHeight: "40vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          color: "#475569",
          fontSize: "0.95rem",
          fontWeight: 600,
        }}
      >
        Loading...
      </div>
    }
  >
    {children}
  </Suspense>
);

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
          <Route path="/demo-view" element={<RouteLoader><DemoViewer /></RouteLoader>} />
          <Route path="/quiz/:quizId" element={<RouteLoader><PrivateRoute element={<QuizPage />} /></RouteLoader>} />
          <Route path="/quiz-report" element={<RouteLoader><PrivateRoute element={<QuizAttemptReport />} /></RouteLoader>} />
          <Route path="/dashboard" element={<RouteLoader><PrivateRoute element={<Dashboard />} /></RouteLoader>} />
          <Route path="/notes-view" element={<RouteLoader><PrivateRoute element={<StudentNotePage />} /></RouteLoader>} />
          <Route path="/leaderboard" element={<RouteLoader><PrivateRoute element={<LeaderboardPage />} /></RouteLoader>} />
          <Route path="/league" element={<RouteLoader><PrivateRoute element={<LeaguePage />} /></RouteLoader>} />
          <Route path="/league/fantasy" element={<RouteLoader><PrivateRoute element={<FantasyLeaguePage />} /></RouteLoader>} />
          <Route path="/league/create-quiz" element={<RouteLoader><PrivateRoute element={<LeagueCreateQuizPage />} /></RouteLoader>} />
          <Route path="/league/create-quiz/:quizId" element={<RouteLoader><PrivateRoute element={<LeagueCreateQuizPage />} /></RouteLoader>} />
          <Route path="/admin189201" element={<RouteLoader><AdminProtect element={<AdminPanel />} /></RouteLoader>} />
          <Route path="/admin1899201" element={<RouteLoader><AdminProtect element={<AdminPanel />} /></RouteLoader>} />
          <Route path="/admin189201/schools/:schoolId" element={<RouteLoader><AdminProtect element={<AdminSchoolDetails />} /></RouteLoader>} />
          <Route path="/admin1899201/schools/:schoolId" element={<RouteLoader><AdminProtect element={<AdminSchoolDetails />} /></RouteLoader>} />
          <Route path="/manage-league-admin" element={<RouteLoader><AdminProtect element={<ManageLeagueAdmin />} /></RouteLoader>} />
          <Route path="/students/:id" element={<RouteLoader><StudentProfile /></RouteLoader>} />
          <Route path="/school-admin/login" element={<RouteLoader><SchoolAdmin /></RouteLoader>} />
          <Route path="/school-admin/*" element={<RouteLoader><SchoolAdmin /></RouteLoader>} />
          <Route path="/school-auth/:token" element={<RouteLoader><SchoolMagicAuth /></RouteLoader>} />
          <Route path="/sa/:token" element={<RouteLoader><SchoolMagicAuth /></RouteLoader>} />
          <Route path="/sl/:token" element={<RouteLoader><SchoolMagicAuth mode="logout" /></RouteLoader>} />
          <Route path="/school-form/:schoolId/:type" element={<RouteLoader><ClassIntakeForm /></RouteLoader>} />
          <Route path="/class-form/:schoolId/:className/:type" element={<RouteLoader><ClassIntakeForm /></RouteLoader>} />
          <Route path="/about" element={<RouteLoader><AboutPage /></RouteLoader>} />
          <Route path="/blogs" element={<RouteLoader><BlogListPage /></RouteLoader>} />
          <Route path="/blogs/:slug" element={<RouteLoader><BlogDetailPage /></RouteLoader>} />
          <Route path="/creator-login" element={<RouteLoader><CreatorLoginPage /></RouteLoader>} />
          <Route path="/creator" element={<RouteLoader><CreatorProtectRoute element={<CreatorProgramPage />} /></RouteLoader>} />
          <Route path="/programmes/creator" element={<RouteLoader><CreatorProtectRoute element={<CreatorProgramPage />} /></RouteLoader>} />
          <Route path="/pricing" element={<RouteLoader><PricingNew /></RouteLoader>} />
          <Route path="/subscribe" element={<RouteLoader><FirebaseSubscriptionRoute element={<SubscriptionCheckout />} /></RouteLoader>} />
          <Route path="/subscription-status" element={<RouteLoader><FirebaseSubscriptionRoute element={<SubscriptionStatus />} /></RouteLoader>} />
          <Route path="/plan-selection" element={<RouteLoader><PlanSelection /></RouteLoader>} />
          <Route path="/payment-success" element={<RouteLoader><PaymentSuccess /></RouteLoader>} />
          <Route path="/school-registration-success" element={<RouteLoader><SchoolRegistrationSuccess /></RouteLoader>} />
          <Route path="/quiz-demo-share" element={<RouteLoader><QuizDemoSharePage /></RouteLoader>} />
          <Route path="/downloads" element={<RouteLoader><Downloads /></RouteLoader>} />
          <Route path="/test" element={<RouteLoader><NotesViewer /></RouteLoader>} />
          
          {/* --- STEP 3 ROUTES: Public Policy Routes --- */}
          <Route path="/contact" element={<RouteLoader><ContactUs /></RouteLoader>} />
          <Route path="/terms-and-conditions" element={<RouteLoader><TermsAndConditions /></RouteLoader>} />
          <Route path="/privacy-policy" element={<RouteLoader><PrivacyPolicy /></RouteLoader>} />
          <Route path="/refund-policy" element={<RouteLoader><RefundPolicy /></RouteLoader>} />

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
                <RouteLoader>
                  <TeacherProtect
                    element={
                      <TeacherDataProvider>
                        <TeacherDashboard />
                      </TeacherDataProvider>
                    }
                  />
                </RouteLoader>
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
