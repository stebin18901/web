import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

const normalize = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalize(value).toLowerCase();
const normalizeClassName = (value) => normalize(value).toUpperCase();
const normalizeSection = (value) => normalize(value).toUpperCase();
const sanitizeToken = (value) =>
  normalize(value).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();

const buildNotificationId = (...parts) => parts.map(sanitizeToken).filter(Boolean).join("_");

const buildStudentAccountId = ({ schoolId, className, section, rollNumber }) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  const normalizedClassName = normalizeClassName(className);
  const normalizedSection = normalizeSection(section);
  const normalizedRoll = normalize(rollNumber);
  if (!normalizedSchoolId || !normalizedRoll) return "";

  const classWithSection =
    normalizedClassName && normalizedSection && !normalizedClassName.endsWith(normalizedSection)
      ? `${normalizedClassName}${normalizedSection}`
      : normalizedClassName;

  return classWithSection
    ? `${normalizedSchoolId}_${classWithSection}_${normalizedRoll}`.toLowerCase()
    : `${normalizedSchoolId}_${normalizedRoll}`.toLowerCase();
};

export const syncAttendanceNotifications = async ({ schoolId, className, section, date, rows = [] }) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  const normalizedClassName = normalizeClassName(className);
  const normalizedSection = normalizeSection(section);
  const batch = writeBatch(db);

  rows.forEach((row) => {
    const studentKey = row.studentId || row.rollNumber || row.fullName || "student";
    const notificationId = buildNotificationId(
      "attendance",
      normalizedSchoolId,
      date,
      normalizedClassName,
      normalizedSection || "general",
      studentKey
    );
    const isActionable = String(row.status || "present").toLowerCase() !== "present" || Boolean(normalize(row.note));

    batch.set(
      doc(db, "parentNotifications", notificationId),
      {
        active: isActionable,
        schoolId: normalizedSchoolId,
        studentId:
          buildStudentAccountId({
            schoolId: normalizedSchoolId,
            className: row.className || normalizedClassName,
            section: row.section || normalizedSection,
            rollNumber: row.rollNumber,
          }) || row.studentId || "",
        rollNumber: normalize(row.rollNumber),
        fullName: normalize(row.fullName),
        className: normalizedClassName,
        section: normalizedSection,
        type: "attendance",
        title: `Attendance update: ${normalize(row.fullName || "Student")}`,
        summary: `${normalize(row.fullName || "Student")} was marked ${String(row.status || "present").replace("_", " ")}.`,
        message:
          String(row.status || "present").toLowerCase() === "present"
            ? `${normalize(row.fullName || "Student")} is marked present for ${date}.`
            : `${normalize(row.fullName || "Student")} was marked ${String(row.status || "present").replace("_", " ")} on ${date}${normalize(row.note) ? ` (${normalize(row.note)})` : ""}.`,
        tone:
          String(row.status || "present").toLowerCase() === "absent"
            ? "danger"
            : String(row.status || "present").toLowerCase() === "late"
              ? "warning"
              : "general",
        status: String(row.status || "present").toLowerCase(),
        note: normalize(row.note),
        relatedDate: date,
        audience: "parent",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
};

export const syncExamNotifications = async ({
  schoolId,
  examId,
  examName,
  academicYear,
  className,
  section,
  records = [],
}) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  const normalizedClassName = normalizeClassName(className);
  const normalizedSection = normalizeSection(section);
  const batch = writeBatch(db);

  records.forEach((record) => {
    const studentKey = record.studentId || record.rollNumber || record.fullName || "student";
    const notificationId = buildNotificationId(
      "marks",
      normalizedSchoolId,
      examId,
      studentKey
    );
    const percentage = Number(record.percentage || 0);

    batch.set(
      doc(db, "parentNotifications", notificationId),
      {
        active: true,
        schoolId: normalizedSchoolId,
        studentId:
          buildStudentAccountId({
            schoolId: normalizedSchoolId,
            className: normalizedClassName,
            section: normalizedSection,
            rollNumber: record.rollNumber,
          }) || record.studentId || "",
        rollNumber: normalize(record.rollNumber),
        fullName: normalize(record.fullName),
        className: normalizedClassName,
        section: normalizedSection,
        type: "marks",
        title: `Marks uploaded: ${normalize(record.fullName || "Student")}`,
        summary: `${normalize(record.fullName || "Student")} scored ${percentage}% in ${normalize(examName || "Exam")}.`,
        message: `${normalize(record.fullName || "Student")}'s marks for ${normalize(examName || "Exam")} (${normalize(academicYear)}) are now available.`,
        tone: percentage < 40 ? "danger" : percentage < 75 ? "warning" : "success",
        examId,
        examName: normalize(examName || "Exam"),
        academicYear: normalize(academicYear),
        percentage,
        total: Number(record.total || 0),
        grade: normalize(record.grade),
        audience: "parent",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
};
