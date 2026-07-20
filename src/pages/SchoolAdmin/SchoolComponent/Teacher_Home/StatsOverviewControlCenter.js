import React from "react";
import {
  AlertCircle,
  BadgeIndianRupee,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Megaphone,
  NotebookPen,
  ShieldCheck,
  Users,
} from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { loadYearScopedEnrollments, normalizeSchoolId } from "../academicUtils";
import { normalizeAcademicYear } from "../schoolYearUtils";
import styles from "./StatsOverviewControlCenter.module.css";

const normalize = (value) => String(value || "").trim();
const formatAmount = (value) => `Rs ${Number(value || 0).toLocaleString("en-IN")}`;

export default function StatsOverviewControlCenter({ schoolId = "", school = null, academicYear = "" }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [metrics, setMetrics] = React.useState({
    students: 0,
    classes: 0,
    outstanding: 0,
    unpaidStudents: 0,
    attendanceDrafts: 0,
    marksDrafts: 0,
    finalizedAttendance: 0,
    finalizedMarks: 0,
    homeworks: 0,
    announcements: 0,
    pendingActions: [],
  });

  const normalizedSchool = React.useMemo(() => normalizeSchoolId(schoolId), [schoolId]);
  const normalizedYear = React.useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  React.useEffect(() => {
    const loadDashboardMetrics = async () => {
      if (!normalizedSchool) return;
      setLoading(true);
      setError("");
      try {
        const [enrollments, attendanceSnap, marksSnap, homeworkSnap, announcementSnap] = await Promise.all([
          loadYearScopedEnrollments({
            schoolId: normalizedSchool,
            academicYear: normalizedYear,
            includeLegacyWithoutYear: true,
          }),
          getDocs(collection(db, "schools", normalizedSchool, "attendance")),
          getDocs(collection(db, "schools", normalizedSchool, "examMarks")),
          getDocs(collection(db, "schools", normalizedSchool, "homeworks")),
          getDocs(collection(db, "schools", normalizedSchool, "notifications")),
        ]);

        const attendanceDocs = attendanceSnap.docs
          .map((entry) => entry.data() || {})
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear);
        const marksDocs = marksSnap.docs
          .map((entry) => entry.data() || {})
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear);
        const homeworkDocs = homeworkSnap.docs
          .map((entry) => entry.data() || {})
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear);
        const announcementDocs = announcementSnap.docs
          .map((entry) => entry.data() || {})
          .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear);

        const classSet = new Set(enrollments.map((entry) => normalize(entry.className)).filter(Boolean));
        const outstanding = enrollments.reduce(
          (sum, entry) => sum + Number(entry.currentOutstandingBalance || entry.feePendingAmount || 0),
          0
        );
        const unpaidStudents = enrollments.filter(
          (entry) => Number(entry.currentOutstandingBalance || entry.feePendingAmount || 0) > 0
        ).length;
        const attendanceDrafts = attendanceDocs.filter(
          (entry) => String(entry.workflowStatus || "draft").toLowerCase() === "draft"
        ).length;
        const finalizedAttendance = attendanceDocs.filter((entry) =>
          ["finalized", "locked"].includes(String(entry.workflowStatus || "").toLowerCase())
        ).length;
        const marksDrafts = marksDocs.filter(
          (entry) => String(entry.workflowStatus || "draft").toLowerCase() === "draft"
        ).length;
        const finalizedMarks = marksDocs.filter((entry) =>
          ["finalized", "locked"].includes(String(entry.workflowStatus || "").toLowerCase())
        ).length;

        const pendingActions = [
          attendanceDrafts ? `${attendanceDrafts} attendance sheet${attendanceDrafts > 1 ? "s are" : " is"} still in draft` : "",
          marksDrafts ? `${marksDrafts} exam mark set${marksDrafts > 1 ? "s are" : " is"} waiting for finalization` : "",
          unpaidStudents ? `${unpaidStudents} student${unpaidStudents > 1 ? "s have" : " has"} fees pending` : "",
          homeworkDocs.length ? `${homeworkDocs.length} homework item${homeworkDocs.length > 1 ? "s" : ""} assigned this year` : "",
        ].filter(Boolean);

        setMetrics({
          students: enrollments.length,
          classes: classSet.size,
          outstanding,
          unpaidStudents,
          attendanceDrafts,
          marksDrafts,
          finalizedAttendance,
          finalizedMarks,
          homeworks: homeworkDocs.length,
          announcements: announcementDocs.length,
          pendingActions,
        });
      } catch (loadError) {
        console.error("Unable to load dashboard metrics", loadError);
        setError("Unable to load the latest school operations summary.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboardMetrics();
  }, [normalizedSchool, normalizedYear]);

  const heroCards = [
    { label: "Active Enrollments", value: metrics.students, icon: Users },
    { label: "Classes In Year", value: metrics.classes, icon: ClipboardList },
    { label: "Outstanding Fees", value: formatAmount(metrics.outstanding), icon: BadgeIndianRupee },
    { label: "Pending Actions", value: metrics.pendingActions.length, icon: AlertCircle },
  ];

  const workflowCards = [
    {
      title: "Attendance workflow",
      icon: CalendarCheck2,
      toneClass: styles.toneBlue,
      items: [
        `${metrics.attendanceDrafts} draft sheet${metrics.attendanceDrafts === 1 ? "" : "s"}`,
        `${metrics.finalizedAttendance} finalized or locked`,
      ],
    },
    {
      title: "Marks workflow",
      icon: NotebookPen,
      toneClass: styles.toneGreen,
      items: [
        `${metrics.marksDrafts} draft exam set${metrics.marksDrafts === 1 ? "" : "s"}`,
        `${metrics.finalizedMarks} finalized result set${metrics.finalizedMarks === 1 ? "" : "s"}`,
      ],
    },
    {
      title: "Communication",
      icon: Megaphone,
      toneClass: styles.toneAmber,
      items: [
        `${metrics.announcements} announcement${metrics.announcements === 1 ? "" : "s"} shared`,
        `${metrics.homeworks} homework item${metrics.homeworks === 1 ? "" : "s"} assigned`,
      ],
    },
    {
      title: "Finance health",
      icon: ShieldCheck,
      toneClass: styles.toneSlate,
      items: [
        `${metrics.unpaidStudents} unpaid student${metrics.unpaidStudents === 1 ? "" : "s"}`,
        `${formatAmount(metrics.outstanding)} still outstanding`,
      ],
    },
  ];

  return (
    <div className={styles.controlCenter}>
      <section className={styles.heroPanel}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Pending-actions control center</p>
          <h1>{normalize(school?.schoolName || "School Admin")} operations</h1>
          <p>
            Review year-scoped enrollments, draft academic work, pending fee collections, and communication flow from
            one operational dashboard.
          </p>
          <div className={styles.heroMeta}>
            <span>Academic year {normalizedYear || "Not selected"}</span>
            <span>{metrics.pendingActions.length} live follow-up item{metrics.pendingActions.length === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className={styles.heroStats}>
          {heroCards.map(({ label, value, icon: Icon }) => (
            <article key={label} className={styles.metricCard}>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <Icon size={18} />
            </article>
          ))}
        </div>
      </section>

      {loading ? (
        <div className={styles.stateCard}>
          <Loader2 className={styles.spin} size={18} />
          Loading school operations...
        </div>
      ) : error ? (
        <div className={styles.stateCard}>{error}</div>
      ) : (
        <>
          <section className={styles.actionsPanel}>
            <div className={styles.panelHead}>
              <div>
                <p>What needs attention</p>
                <h2>Priority actions for this year</h2>
              </div>
              <span className={styles.panelBadge}>
                <CheckCircle2 size={14} />
                Live workflow
              </span>
            </div>

            {metrics.pendingActions.length ? (
              <div className={styles.actionList}>
                {metrics.pendingActions.map((item) => (
                  <div key={item} className={styles.actionRow}>
                    <AlertCircle size={16} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>No urgent pending actions right now. Current year workflows look clean.</div>
            )}
          </section>

          <section className={styles.workflowGrid}>
            {workflowCards.map(({ title, icon: Icon, toneClass, items }) => (
              <article key={title} className={`${styles.workflowCard} ${toneClass}`}>
                <div className={styles.workflowHead}>
                  <div className={styles.workflowIcon}>
                    <Icon size={16} />
                  </div>
                  <strong>{title}</strong>
                </div>
                <div className={styles.workflowItems}>
                  {items.map((item) => (
                    <div key={item}>{item}</div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
