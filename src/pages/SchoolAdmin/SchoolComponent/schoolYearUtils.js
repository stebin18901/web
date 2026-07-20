import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

const normalize = (value) => String(value || "").trim();
export const normalizeLower = (value) => normalize(value).toLowerCase();
export const normalizeAcademicYear = (value) => normalize(value);
export const matchesAcademicYearScope = (entry = {}, academicYear = "") => {
  const normalizedYear = normalizeAcademicYear(academicYear);
  if (!normalizedYear) return true;
  if (normalizeAcademicYear(entry?.academicYear) === normalizedYear) return true;
  return Array.isArray(entry?.academicYears)
    ? entry.academicYears.some((yearValue) => normalizeAcademicYear(yearValue) === normalizedYear)
    : false;
};

export const getDefaultAcademicYear = () => String(new Date().getFullYear());

export const buildYearScopedClassId = ({ schoolId, academicYear, className }) =>
  `${normalizeLower(schoolId)}_${normalizeAcademicYear(academicYear)}_${normalize(className).toUpperCase()}`;

export const buildYearScopedStudentId = ({ schoolId, academicYear, className, rollNumber }) =>
  `${normalizeLower(schoolId)}_${normalizeAcademicYear(academicYear)}_${normalize(className).toUpperCase()}_${normalize(rollNumber)}`;

const splitIntoChunks = (items, size = 350) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

export const ensureAcademicYearRecords = async ({ schoolId, schoolName = "" }) => {
  const normalizedSchoolId = normalizeLower(schoolId);
  if (!normalizedSchoolId) return [];

  const yearsRef = collection(db, "schools", normalizedSchoolId, "academicYears");
  const yearsSnap = await getDocs(yearsRef);

  if (!yearsSnap.empty) {
    return yearsSnap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((left, right) => Number(right.id) - Number(left.id));
  }

  const defaultYear = getDefaultAcademicYear();
  await setDoc(doc(db, "schools", normalizedSchoolId, "academicYears", defaultYear), {
    schoolId: normalizedSchoolId,
    schoolName,
    yearLabel: defaultYear,
    transferConfig: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isDefault: true,
  });

  const defaultSnap = await getDoc(doc(db, "schools", normalizedSchoolId, "academicYears", defaultYear));
  return defaultSnap.exists() ? [{ id: defaultSnap.id, ...defaultSnap.data() }] : [];
};

const filterByYear = (docs = [], academicYear) =>
  docs.filter((entry) => normalizeAcademicYear(entry.academicYear) === normalizeAcademicYear(academicYear));

const buildStudentTransferPayload = (student = {}, normalizedTargetYear, normalizedSourceYear) => {
  const {
    id,
    academicYear,
    sourceYear,
    feeAmount,
    feePaidAmount,
    feePendingAmount,
    currentOutstandingBalance,
    feeStatus,
    feeCalculationMode,
    feeCollectionCycle,
    paymentStatus,
    registrationStatus,
    paymentLinkId,
    paymentUrl,
    checkoutUrl,
    feeLastPaymentAmount,
    feeLastPaymentMethod,
    feeLastPaymentNote,
    feeLastPaymentAt,
    paymentVerifiedAt,
    examAverage,
    attendancePercentage,
    updatedAt,
    createdAt,
    ...rest
  } = student;

  return {
    ...rest,
    academicYear: normalizedTargetYear,
    sourceYear: normalizedSourceYear,
    feeAmount: 0,
    feePaidAmount: 0,
    feePendingAmount: 0,
    currentOutstandingBalance: 0,
    feeStatus: "pending",
    feeCalculationMode: "class_default",
    feeCollectionCycle: normalize(student.feeCollectionCycle || "monthly").toLowerCase() || "monthly",
    paymentStatus: "none",
    registrationStatus: "transferred",
    paymentLinkId: "",
    paymentUrl: "",
    checkoutUrl: "",
    feeLastPaymentAmount: 0,
    feeLastPaymentMethod: "",
    feeLastPaymentNote: "",
    feeLastPaymentAt: null,
    paymentVerifiedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
};

export const createAcademicYearWorkspace = async ({
  schoolId,
  schoolName = "",
  targetYear,
  sourceYear = "",
  transfers = {},
}) => {
  const normalizedSchoolId = normalizeLower(schoolId);
  const normalizedTargetYear = normalizeAcademicYear(targetYear);
  const normalizedSourceYear = normalizeAcademicYear(sourceYear);

  if (!normalizedSchoolId || !normalizedTargetYear) {
    throw new Error("School and target year are required.");
  }

  const yearRef = doc(db, "schools", normalizedSchoolId, "academicYears", normalizedTargetYear);
  const existingYearSnap = await getDoc(yearRef);
  if (existingYearSnap.exists()) {
    throw new Error(`Year ${normalizedTargetYear} already exists.`);
  }

  await setDoc(yearRef, {
    schoolId: normalizedSchoolId,
    schoolName,
    yearLabel: normalizedTargetYear,
    sourceYear: normalizedSourceYear || "",
    transferConfig: transfers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const tasks = [];

  if (transfers.students && normalizedSourceYear) {
    tasks.push(async () => {
      const studentsSnap = await getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId)));
      const students = filterByYear(
        studentsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
        normalizedSourceYear
      );

      const writeOps = [];
      const configOps = [];

      for (const student of students) {
        const nextId = buildYearScopedStudentId({
          schoolId: normalizedSchoolId,
          academicYear: normalizedTargetYear,
          className: student.className,
          rollNumber: student.rollNumber,
        });

        writeOps.push({
          ref: doc(collection(db, "studentAccounts"), nextId),
          data: buildStudentTransferPayload(student, normalizedTargetYear, normalizedSourceYear),
        });

        if (transfers.feeSetup) {
          const configSnap = await getDoc(doc(db, "studentAccounts", student.id, "feeProfile", "config"));
          if (configSnap.exists()) {
            configOps.push({
              ref: doc(db, "studentAccounts", nextId, "feeProfile", "config"),
              data: {
                ...configSnap.data(),
                updatedAt: serverTimestamp(),
                sourceYear: normalizedSourceYear,
              },
            });
          }
        }
      }

      for (const chunk of splitIntoChunks(writeOps)) {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }

      for (const chunk of splitIntoChunks(configOps)) {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }
    });
  }

  if (transfers.classes && normalizedSourceYear) {
    tasks.push(async () => {
      const classesSnap = await getDocs(query(collection(db, "classes"), where("schoolId", "==", normalizedSchoolId)));
      const classes = filterByYear(
        classesSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() })),
        normalizedSourceYear
      );

      const writeOps = classes.map((classEntry) => ({
        ref: doc(collection(db, "classes"), buildYearScopedClassId({
          schoolId: normalizedSchoolId,
          academicYear: normalizedTargetYear,
          className: classEntry.className,
        })),
        data: {
          ...classEntry,
          academicYear: normalizedTargetYear,
          sourceYear: normalizedSourceYear,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      }));

      for (const chunk of splitIntoChunks(writeOps)) {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }
    });
  }

  if (transfers.teachers && normalizedSourceYear) {
    tasks.push(async () => {
      const usersSnap = await getDocs(query(collection(db, "users"), where("schoolId", "==", normalizedSchoolId)));
      const teachers = filterByYear(
        usersSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => ["teacher", "class_teacher"].includes(normalizeLower(entry.role))),
        normalizedSourceYear
      );

      const writeOps = teachers.map((teacher) => ({
        ref: doc(db, "users", teacher.id),
        data: {
          schoolId: normalizedSchoolId,
          schoolName: teacher.schoolName || schoolName,
          academicYears: arrayUnion(normalizedTargetYear),
          academicYear: teacher.academicYear || normalizedTargetYear,
          updatedAt: serverTimestamp(),
        },
      }));

      for (const chunk of splitIntoChunks(writeOps)) {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }
    });
  }

  if (transfers.feeSetup && normalizedSourceYear) {
    tasks.push(async () => {
      const schoolSnap = await getDoc(doc(db, "schools", normalizedSchoolId));
      const schoolData = schoolSnap.exists() ? schoolSnap.data() || {} : {};
      const templatesSnap = await getDocs(query(collection(db, "feeTemplates"), where("schoolId", "==", normalizedSchoolId)));
      const feeTemplates = templatesSnap.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((entry) => normalizeAcademicYear(entry.academicYear) === normalizedSourceYear);

      await setDoc(
        yearRef,
        {
          feeCollectionCycle: schoolData.feeCollectionCycle || "monthly",
          feeAmount: Number(schoolData.feeAmount || 0),
          feeCollectionEnabled: schoolData.feeCollectionEnabled !== false,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const templateOps = feeTemplates.map((template) => {
        const nextTemplateId = buildYearScopedClassId({
          schoolId: normalizedSchoolId,
          academicYear: normalizedTargetYear,
          className: template.className,
        });
        return {
          ref: doc(db, "feeTemplates", nextTemplateId),
          data: {
            ...template,
            classId: nextTemplateId,
            schoolId: normalizedSchoolId,
            academicYear: normalizedTargetYear,
            sourceYear: normalizedSourceYear,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
        };
      });

      for (const chunk of splitIntoChunks(templateOps)) {
        const batch = writeBatch(db);
        chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
        await batch.commit();
      }
    });
  }

  for (const task of tasks) {
    await task();
  }

  const createdSnap = await getDoc(yearRef);
  return createdSnap.exists() ? { id: createdSnap.id, ...createdSnap.data() } : null;
};
