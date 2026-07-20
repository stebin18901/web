import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { buildYearScopedClassId, normalizeAcademicYear } from "./schoolYearUtils";

export const ATTENDANCE_STATUS_CONFIG = [
  { key: "present", label: "Present", tone: "success" },
  { key: "absent", label: "Absent", tone: "danger" },
  { key: "late", label: "Late", tone: "warning" },
  { key: "half_day", label: "Half Day", tone: "info" },
  { key: "excused", label: "Excused", tone: "muted" },
];

export const EXAM_TYPES = ["Unit Test", "Mid Term", "Annual Exam", "Custom Exam"];
export const WORKFLOW_STATUS_CONFIG = [
  { key: "draft", label: "Draft", tone: "muted" },
  { key: "finalized", label: "Finalized", tone: "success" },
  { key: "locked", label: "Locked", tone: "info" },
];
export const normalizeValue = (value) => String(value || "").trim();
export const normalizeSchoolId = (value) => normalizeValue(value).toLowerCase();
export const normalizeClassName = (value) => normalizeValue(value).toUpperCase();
export const normalizeSection = (value) => normalizeValue(value).toUpperCase();
const matchesSchoolIdentity = (entry = {}, schoolId = "") =>
  normalizeSchoolId(entry.schoolId || entry.schoolIdRaw || entry.id) === normalizeSchoolId(schoolId);
export const sanitizeDocToken = (value) =>
  normalizeValue(value).replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
export const splitClassAndDivision = (value) => {
  const normalized = normalizeClassName(value);
  const grade = (normalized.match(/^\d+/)?.[0] || "").trim();
  const division = normalized.slice(grade.length).trim().toUpperCase();
  return { grade, division, combined: normalized };
};

export const formatDateInput = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};

export const formatMonthInput = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const buildAttendanceDocId = ({ date, className, section }) =>
  `${sanitizeDocToken(date)}_${sanitizeDocToken(className)}_${sanitizeDocToken(section || "general")}`;

export const buildExamDocId = ({ academicYear, examType, examName, className, section }) =>
  `${sanitizeDocToken(academicYear)}_${sanitizeDocToken(examType)}_${sanitizeDocToken(
    examName || className
  )}_${sanitizeDocToken(className)}_${sanitizeDocToken(section || "general")}`;

export const getAttendanceSummary = (records = []) => {
  const summary = {
    totalStudents: records.length,
    present: 0,
    absent: 0,
    late: 0,
    halfDay: 0,
    excused: 0,
    attendancePercentage: 0,
  };
  records.forEach((record) => {
    const status = String(record.status || "present").toLowerCase();
    if (status === "present") summary.present += 1;
    else if (status === "absent") summary.absent += 1;
    else if (status === "late") summary.late += 1;
    else if (status === "half_day") summary.halfDay += 1;
    else if (status === "excused") summary.excused += 1;
  });
  const activeCount = summary.present + summary.late + summary.halfDay + summary.excused;
  summary.attendancePercentage = summary.totalStudents
    ? Number(((activeCount / summary.totalStudents) * 100).toFixed(1))
    : 0;
  return summary;
};

export const calculateGrade = (percentage) => {
  const score = Number(percentage || 0);
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B+";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 40) return "D";
  return "F";
};

export const calculateMarksRecord = (record, subjects = [], maxMarks = {}) => {
  const marksBySubject = {};
  let total = 0;
  let maxTotal = 0;
  let hasError = false;
  subjects.forEach((subject) => {
    const rawValue = record?.marksBySubject?.[subject];
    const maxValue = Number(maxMarks?.[subject] || 0);
    const numericValue =
      rawValue === "" || rawValue === null || rawValue === undefined ? "" : Number(rawValue);
    if (numericValue !== "" && (!Number.isFinite(numericValue) || numericValue < 0)) hasError = true;
    if (numericValue !== "" && maxValue > 0 && numericValue > maxValue) hasError = true;
    marksBySubject[subject] = numericValue;
    if (numericValue !== "" && Number.isFinite(numericValue)) total += numericValue;
    maxTotal += maxValue;
  });
  const percentage = maxTotal > 0 ? Number(((total / maxTotal) * 100).toFixed(2)) : 0;
  return { ...record, marksBySubject, total, percentage, grade: calculateGrade(percentage), hasError };
};

export const getMarksSummary = (records = [], subjects = [], maxMarks = {}) => {
  const validRecords = records.filter((record) => !record.hasError);
  const totals = validRecords.map((record) => Number(record.total || 0));
  const percentages = validRecords.map((record) => Number(record.percentage || 0));
  const classAverage = percentages.length
    ? Number((percentages.reduce((sum, item) => sum + item, 0) / percentages.length).toFixed(2))
    : 0;
  const highestMark = totals.length ? Math.max(...totals) : 0;
  const lowestMark = totals.length ? Math.min(...totals) : 0;
  const passPercentage = validRecords.length
    ? Number(((validRecords.filter((record) => Number(record.percentage || 0) >= 40).length / validRecords.length) * 100).toFixed(1))
    : 0;
  const subjectAverages = subjects.map((subject) => {
    const values = validRecords
      .map((record) => Number(record.marksBySubject?.[subject]))
      .filter((value) => Number.isFinite(value));
    return {
      subject,
      average: values.length
        ? Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(2))
        : 0,
      maxMarks: Number(maxMarks?.[subject] || 0),
    };
  });
  return {
    classAverage,
    highestMark,
    lowestMark,
    passPercentage,
    subjectAverages,
    studentsNeedingAttention: validRecords.filter((record) => Number(record.percentage || 0) < 40).length,
  };
};

export const getAcademicYearOptions = () => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, index) => {
    const startYear = currentYear - 2 + index;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  });
};

export const getRoleLabel = (role) => {
  if (role === "class_teacher") return "Class Teacher";
  if (role === "teacher") return "Teacher";
  return "School Admin";
};

export const getAttendanceStatusMeta = (statusKey) =>
  ATTENDANCE_STATUS_CONFIG.find((item) => item.key === statusKey) || ATTENDANCE_STATUS_CONFIG[0];

export const getWorkflowStatusMeta = (statusKey) =>
  WORKFLOW_STATUS_CONFIG.find((item) => item.key === String(statusKey || "").toLowerCase()) ||
  WORKFLOW_STATUS_CONFIG[0];

export const isWorkflowLocked = (statusKey) => ["finalized", "locked"].includes(String(statusKey || "").toLowerCase());

export const buildMasterEnrollmentId = ({ schoolId, academicYear, className, rollNumber }) => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  const normalizedYear = normalizeAcademicYear(academicYear) || "general";
  const normalizedClass = normalizeClassName(className);
  const normalizedRoll = sanitizeDocToken(rollNumber || "0");
  return `${normalizedSchool}_${normalizedYear}_${normalizedClass}_${normalizedRoll}`;
};

export const mapEnrollmentToStudent = (entry = {}, fallback = {}) => ({
  studentId:
    normalizeValue(entry.studentId || entry.id) ||
    buildMasterEnrollmentId({
      schoolId: entry.schoolId || fallback.schoolId,
      academicYear: entry.academicYear || fallback.academicYear,
      className: entry.className || fallback.className,
      rollNumber: entry.rollNumber || fallback.rollNumber,
    }),
  fullName: normalizeValue(entry.fullName || entry.name || fallback.fullName),
  rollNumber: normalizeValue(entry.rollNumber || fallback.rollNumber),
  className: normalizeClassName(entry.className || entry.class || fallback.className),
  section: normalizeSection(entry.section || entry.classSection || entry.division || fallback.section),
  phone: normalizeValue(entry.phone || entry.parentPhone || fallback.phone),
  email: normalizeValue(entry.email || fallback.email).toLowerCase(),
  pin: normalizeValue(entry.pin || fallback.pin),
  parentPhone: normalizeValue(entry.parentPhone || entry.phone || fallback.parentPhone),
  customFields: entry.customFields && typeof entry.customFields === "object" ? entry.customFields : {},
  customFieldLabels:
    entry.customFieldLabels && typeof entry.customFieldLabels === "object" ? entry.customFieldLabels : {},
  feeAmount: Number(entry.feeAmount || 0),
  feePaidAmount: Number(entry.feePaidAmount || 0),
  feePendingAmount: Number(entry.feePendingAmount || entry.currentOutstandingBalance || 0),
  currentOutstandingBalance: Number(entry.currentOutstandingBalance || entry.feePendingAmount || 0),
  feeStatus: normalizeValue(entry.feeStatus || "pending").toLowerCase(),
  feeCollectionCycle: normalizeValue(entry.feeCollectionCycle || "monthly").toLowerCase(),
});

export const loadYearScopedEnrollments = async ({ schoolId, academicYear = "", includeLegacyWithoutYear = false }) => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  const normalizedYear = normalizeAcademicYear(academicYear);
  if (!normalizedSchool) return [];

  const enrollmentSnap = await getDocs(
    query(collection(db, "defaultSchoolEnrollments"), where("schoolId", "==", normalizedSchool))
  );

  return enrollmentSnap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => {
      const entryYear = normalizeAcademicYear(entry.academicYear);
      if (!normalizedYear) return true;
      if (entryYear === normalizedYear) return true;
      return includeLegacyWithoutYear && !entryYear;
    });
};

const deriveClassesFromStudentDocs = (docs = [], normalizedSchool = "", normalizedYear = "", options = {}) => {
  const { includeLegacyWithoutYear = false } = options;
  const derivedClassesMap = new Map();

  docs.forEach((entry) => {
    const data = entry?.data ? entry.data() || {} : entry || {};
    if (!matchesSchoolIdentity(data, normalizedSchool)) return;

    const entryYear = normalizeAcademicYear(data.academicYear);
    if (normalizedYear) {
      const yearMatches = entryYear === normalizedYear;
      const legacyMatches = includeLegacyWithoutYear && !entryYear;
      if (!yearMatches && !legacyMatches) return;
    }

    const className = normalizeClassName(data.className || data.class);
    if (!className) return;

    const section = normalizeSection(data.section || data.classSection || splitClassAndDivision(className).division);
    const derivedKey = `${className}__${section || "general"}`;
    if (!derivedClassesMap.has(derivedKey)) {
      derivedClassesMap.set(derivedKey, {
        id: `${normalizedSchool}_${normalizedYear || "derived"}_${className}_${section || "general"}`,
        schoolId: normalizedSchool,
        academicYear: normalizedYear || entryYear,
        className,
        section,
        division: section,
        source: "studentAccounts",
      });
    }
  });

  return Array.from(derivedClassesMap.values()).sort((a, b) =>
    a.className.localeCompare(b.className, undefined, { numeric: true }) ||
    a.section.localeCompare(b.section, undefined, { numeric: true })
  );
};

export const resolveSchoolClasses = async (schoolId, academicYear = "") => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  const normalizedYear = normalizeAcademicYear(academicYear);
  const enrollments = await loadYearScopedEnrollments({
    schoolId: normalizedSchool,
    academicYear: normalizedYear,
    includeLegacyWithoutYear: true,
  });
  if (enrollments.length) {
    const enrollmentClasses = deriveClassesFromStudentDocs(
      enrollments,
      normalizedSchool,
      normalizedYear,
      { includeLegacyWithoutYear: true }
    );
    if (enrollmentClasses.length) return enrollmentClasses;
  }

  const snap = await getDocs(collection(db, "classes"));
  const allClasses = snap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => matchesSchoolIdentity(entry, normalizedSchool))
    .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
    .map((entry) => ({
      ...entry,
      className: normalizeClassName(entry.className),
      section: normalizeSection(entry.section || entry.division || entry.className?.replace(/^\d+/, "")),
    }))
    .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

  if (allClasses.length || !normalizedYear) return allClasses;

  const legacyClasses = snap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => matchesSchoolIdentity(entry, normalizedSchool) && !normalizeAcademicYear(entry.academicYear))
    .map((entry) => ({
      ...entry,
      className: normalizeClassName(entry.className),
      section: normalizeSection(entry.section || entry.division || entry.className?.replace(/^\d+/, "")),
    }))
    .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }));

  if (legacyClasses.length) return legacyClasses;

  const studentSnap = await getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchool)));
  const derivedYearClasses = deriveClassesFromStudentDocs(studentSnap.docs, normalizedSchool, normalizedYear);
  if (derivedYearClasses.length) return derivedYearClasses;

  if (normalizedYear) {
    const derivedLegacyClasses = deriveClassesFromStudentDocs(studentSnap.docs, normalizedSchool, normalizedYear, {
      includeLegacyWithoutYear: true,
    });
    if (derivedLegacyClasses.length) return derivedLegacyClasses;
  }

  return deriveClassesFromStudentDocs(studentSnap.docs, normalizedSchool, normalizedYear);
};

export const resolveTeacherAcademicScope = async (teacher) => {
  const schoolId = normalizeSchoolId(teacher?.schoolId);
  const classes = await resolveSchoolClasses(schoolId, teacher?.academicYear);
  const assignedClasses = new Set((teacher?.assignedClasses || [teacher?.assignedClass]).filter(Boolean).map(normalizeClassName));
  const isClassTeacher = String(teacher?.role || "").toLowerCase() === "class_teacher";
  const scopedClasses = isClassTeacher
    ? classes.filter((entry) => assignedClasses.has(entry.className))
    : classes.filter((entry) => {
        const team = Array.isArray(entry.team) ? entry.team : [];
        return assignedClasses.has(entry.className) || team.some((member) => normalizeValue(member.email).toLowerCase() === normalizeValue(teacher?.email).toLowerCase());
      });
  const subjectSet = new Set();
  scopedClasses.forEach((entry) => {
    const team = Array.isArray(entry.team) ? entry.team : [];
    team.forEach((member) => {
      if (normalizeValue(member.email).toLowerCase() === normalizeValue(teacher?.email).toLowerCase()) {
        (member.subjects || []).forEach((subject) => subjectSet.add(normalizeValue(subject)));
      }
    });
  });
  (teacher?.subjects || []).forEach((subject) => subjectSet.add(normalizeValue(subject)));
  if (teacher?.subject) subjectSet.add(normalizeValue(teacher.subject));
  return {
    schoolId,
    classes: scopedClasses,
    subjects: Array.from(subjectSet).filter(Boolean).sort(),
    isClassTeacher,
    canTakeAttendance: isClassTeacher,
    canViewReports: true,
    canManageAllSubjects: isClassTeacher,
  };
};

export const loadStudentsForClass = async ({ schoolId, className, section, academicYear = "" }) => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  const normalizedYear = normalizeAcademicYear(academicYear);
  const normalizedClass = normalizeClassName(className);
  const { grade: requestedGrade, division: requestedDivision } = splitClassAndDivision(normalizedClass);
  const normalizedSec = normalizeSection(section || requestedDivision);

  const mapStudentEntry = (entry) => ({
    studentId: entry.id,
    fullName: normalizeValue(entry.fullName || entry.name),
    rollNumber: normalizeValue(entry.rollNumber || entry.studentId),
    className: normalizeClassName(entry.className || entry.class || normalizedClass),
    section: normalizeSection(entry.section || entry.classSection || entry.division || normalizedSec),
    phone: normalizeValue(entry.phone || entry.parentPhone),
    email: normalizeValue(entry.email).toLowerCase(),
    pin: normalizeValue(entry.pin),
    parentPhone: normalizeValue(entry.parentPhone || entry.phone),
    customFields: entry.customFields && typeof entry.customFields === "object" ? entry.customFields : {},
    customFieldLabels:
      entry.customFieldLabels && typeof entry.customFieldLabels === "object" ? entry.customFieldLabels : {},
  });

  const matchesClassAndSection = (entry) => {
    const entryClass = normalizeClassName(entry.className || entry.class || entry.grade);
    const entrySection = normalizeSection(entry.section || entry.classSection || entry.division);
    const { grade: entryGrade, division: entryDivision, combined: combinedEntryClass } = splitClassAndDivision(entryClass);

    const gradeMatches =
      combinedEntryClass === normalizedClass ||
      (requestedGrade && entryGrade === requestedGrade) ||
      (!requestedGrade && entryClass === normalizedClass);

    const sectionMatches =
      !normalizedSec ||
      entrySection === normalizedSec ||
      entryDivision === normalizedSec ||
      combinedEntryClass === normalizedClass;

    return gradeMatches && sectionMatches;
  };

  const enrollmentRecords = await loadYearScopedEnrollments({
    schoolId: normalizedSchool,
    academicYear: normalizedYear,
    includeLegacyWithoutYear: true,
  });

  let enrollmentStudents = enrollmentRecords
    .filter(matchesClassAndSection)
    .map((entry) =>
      mapEnrollmentToStudent(entry, {
        schoolId: normalizedSchool,
        academicYear: normalizedYear,
        className: normalizedClass,
        section: normalizedSec,
      })
    )
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  if (enrollmentStudents.length) return enrollmentStudents;

  const snap = await getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchool)));
  const candidateDocs = snap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => matchesSchoolIdentity(entry, normalizedSchool));
  let students = candidateDocs
    .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
    .filter(matchesClassAndSection)
    .map(mapStudentEntry)
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  if (!students.length && normalizedYear) {
    students = candidateDocs
      .filter((entry) => normalizeSchoolId(entry.schoolId || entry.schoolIdRaw) === normalizedSchool)
      .filter((entry) => !normalizeAcademicYear(entry.academicYear))
      .filter(matchesClassAndSection)
      .map(mapStudentEntry)
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }

  if (students.length) return students;

  const globalStudentSnap = await getDocs(collection(db, "studentAccounts"));
  const globalStudentCandidates = globalStudentSnap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => matchesSchoolIdentity(entry, normalizedSchool));

  students = globalStudentCandidates
    .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
    .filter(matchesClassAndSection)
    .map(mapStudentEntry)
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));

  if (!students.length && normalizedYear) {
    students = globalStudentCandidates
      .filter((entry) => !normalizeAcademicYear(entry.academicYear))
      .filter(matchesClassAndSection)
      .map(mapStudentEntry)
      .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }

  if (students.length) return students;

  const allClassSnap = await getDocs(collection(db, "classes"));
  const matchingClassDocs = allClassSnap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((entry) => matchesSchoolIdentity(entry, normalizedSchool))
    .filter((entry) => !normalizedYear || normalizeAcademicYear(entry.academicYear) === normalizedYear)
    .filter((entry) => {
      const entryClass = normalizeClassName(entry.className);
      const entrySection = normalizeSection(entry.section || entry.division);
      const { grade: entryGrade, division: entryDivision, combined: combinedEntryClass } = splitClassAndDivision(entryClass);

      const gradeMatches =
        combinedEntryClass === normalizedClass ||
        (requestedGrade && entryGrade === requestedGrade) ||
        (!requestedGrade && entryClass === normalizedClass);

      const sectionMatches =
        !normalizedSec ||
        entrySection === normalizedSec ||
        entryDivision === normalizedSec ||
        combinedEntryClass === normalizedClass;

      return gradeMatches && sectionMatches;
    });

  const classStudentSets = await Promise.all(
    matchingClassDocs.map((classDoc) =>
      getDocs(collection(db, "classes", classDoc.id || buildYearScopedClassId({ schoolId: normalizedSchool, academicYear: normalizedYear, className: classDoc.className }), "students"))
    )
  );

  return classStudentSets
    .flatMap((studentSnap, index) =>
      studentSnap.docs.map((entry) => ({
        id: entry.id,
        className: matchingClassDocs[index]?.className || normalizedClass,
        section: matchingClassDocs[index]?.section || matchingClassDocs[index]?.division || normalizedSec,
        ...entry.data(),
      }))
    )
    .map((entry) => ({
      studentId: normalizeValue(entry.studentId || entry.id || entry.rollNumber),
      fullName: normalizeValue(entry.fullName || entry.name),
      rollNumber: normalizeValue(entry.rollNumber || entry.studentId || entry.id),
      className: normalizeClassName(entry.className || normalizedClass),
      section: normalizeSection(entry.section || entry.classSection || entry.division || normalizedSec),
      phone: normalizeValue(entry.phone || entry.parentPhone),
      email: normalizeValue(entry.email).toLowerCase(),
      pin: normalizeValue(entry.pin),
      parentPhone: normalizeValue(entry.parentPhone || entry.phone),
      customFields: entry.customFields && typeof entry.customFields === "object" ? entry.customFields : {},
      customFieldLabels:
        entry.customFieldLabels && typeof entry.customFieldLabels === "object" ? entry.customFieldLabels : {},
    }))
    .sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
};

export const loadSchoolMeta = async (schoolId) => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  const candidates = [normalizeValue(schoolId), normalizedSchool].filter(Boolean);
  for (const candidate of candidates) {
    const snap = await getDoc(doc(db, "schools", candidate));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  }
  return null;
};
