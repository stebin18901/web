import {
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { normalizeAcademicYear } from "./schoolYearUtils";

const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();
const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

export const DEFAULT_WAIVER_OPTIONS = [
  { key: "sibling_discount", label: "Sibling discount", amount: 500 },
  { key: "sports_quota", label: "Sports quota", amount: 700 },
  { key: "staff_child", label: "Staff child", amount: 1000 },
  { key: "scholarship", label: "Scholarship", amount: 1200 },
];

export const DEFAULT_ADDON_OPTIONS = [
  { id: "transport_standard", label: "Transport standard", amount: 800, category: "transport" },
  { id: "smart_class", label: "Smart class", amount: 250, category: "service" },
  { id: "club_fee", label: "Club fee", amount: 300, category: "activity" },
  { id: "lab_fee", label: "Lab fee", amount: 450, category: "lab" },
];

export const buildFeeTemplateId = ({ schoolId, academicYear, className }) =>
  `${normalizeLower(schoolId)}_${normalizeAcademicYear(academicYear) || "general"}_${normalize(className).toUpperCase()}`;

export const getFeeTemplateRef = ({ schoolId, academicYear, className }) =>
  doc(db, "feeTemplates", buildFeeTemplateId({ schoolId, academicYear, className }));

export const getStudentFeeConfigRef = (studentId) =>
  doc(db, "studentAccounts", normalize(studentId), "feeProfile", "config");

export const getStudentLedgerCollectionRef = (studentId) =>
  collection(db, "studentAccounts", normalize(studentId), "ledger");

const dedupeByKey = (items = [], key = "id") => {
  const map = new Map();
  items.forEach((item) => {
    const itemKey = normalizeLower(item?.[key]);
    if (!itemKey) return;
    map.set(itemKey, item);
  });
  return Array.from(map.values());
};

export const normalizeAddonRecord = (addon = {}) => ({
  id: normalize(addon.id || addon.key || addon.label),
  label: normalize(addon.label || addon.name || addon.id || "Addon"),
  amount: toAmount(addon.amount),
  category: normalize(addon.category || "custom"),
});

export const normalizeFeeTemplate = (template = {}, fallback = {}) => {
  const baseTuition = toAmount(template.baseTuition || fallback.baseTuition);
  const transportStandard = toAmount(template.transportStandard || fallback.transportStandard);
  const examFee = toAmount(template.examFee || fallback.examFee);
  const addonOptions = dedupeByKey(
    [...(template.availableAddons || []), ...(fallback.availableAddons || []), ...DEFAULT_ADDON_OPTIONS].map(normalizeAddonRecord),
    "id"
  );
  const waiverOptions = dedupeByKey(
    [...(template.availableWaivers || []), ...(fallback.availableWaivers || []), ...DEFAULT_WAIVER_OPTIONS].map((waiver) => ({
      key: normalize(waiver.key || waiver.id || waiver.label),
      label: normalize(waiver.label || waiver.key || "Waiver"),
      amount: toAmount(waiver.amount),
    })),
    "key"
  );

  return {
    cycle: normalize(template.cycle || fallback.cycle || "monthly").toLowerCase() || "monthly",
    baseTuition,
    transportStandard,
    examFee,
    availableAddons: addonOptions,
    availableWaivers: waiverOptions,
    structuralWaiverMap: waiverOptions.reduce((accumulator, waiver) => {
      accumulator[waiver.key] = waiver.amount;
      return accumulator;
    }, {}),
  };
};

export const normalizeStudentFeeConfig = (config = {}) => ({
  useClassDefaults: config.useClassDefaults !== false,
  customBaseFee: toAmount(config.customBaseFee),
  activeWaivers: Array.isArray(config.activeWaivers) ? config.activeWaivers.map((entry) => normalize(entry)).filter(Boolean) : [],
  selectedAddons: Array.isArray(config.selectedAddons) ? config.selectedAddons.map(normalizeAddonRecord) : [],
});

export const calculateStudentFeeSummary = ({ template, config }) => {
  const normalizedTemplate = normalizeFeeTemplate(template);
  const normalizedConfig = normalizeStudentFeeConfig(config);
  const standardClassFee =
    toAmount(normalizedTemplate.baseTuition) +
    toAmount(normalizedTemplate.transportStandard) +
    toAmount(normalizedTemplate.examFee);

  const effectiveBaseFee = normalizedConfig.useClassDefaults
    ? standardClassFee
    : toAmount(normalizedConfig.customBaseFee);

  const addonTotal = normalizedConfig.selectedAddons.reduce(
    (sum, addon) => sum + toAmount(addon.amount),
    0
  );

  const waiverTotal = normalizedConfig.activeWaivers.reduce((sum, waiverKey) => {
    const amount = normalizedTemplate.structuralWaiverMap[waiverKey] || 0;
    return sum + toAmount(amount);
  }, 0);

  const customizedStudentTotal = Math.max(effectiveBaseFee + addonTotal - waiverTotal, 0);

  return {
    template: normalizedTemplate,
    config: normalizedConfig,
    standardClassFee,
    effectiveBaseFee,
    addonTotal,
    waiverTotal,
    customizedStudentTotal,
    breakdown: [
      { key: "base", label: normalizedConfig.useClassDefaults ? "Standard class fee" : "Custom base fee", amount: effectiveBaseFee },
      { key: "addons", label: "Selected addons", amount: addonTotal },
      { key: "waivers", label: "Active waivers", amount: -waiverTotal },
    ],
  };
};

export const fetchStudentFeeSummary = async ({ studentId, classId, schoolId, academicYear }) => {
  const templateRef = doc(db, "feeTemplates", normalize(classId));
  const studentRef = doc(db, "studentAccounts", normalize(studentId));
  const configRef = getStudentFeeConfigRef(studentId);

  const [templateSnap, studentSnap, configSnap] = await Promise.all([
    getDoc(templateRef),
    getDoc(studentRef),
    getDoc(configRef),
  ]);

  if (!studentSnap.exists()) {
    throw new Error("Student record not found.");
  }

  const studentData = studentSnap.data() || {};
  const fallbackTemplate = {
    schoolId: normalizeLower(schoolId),
    className: normalize(studentData.className),
    academicYear: normalizeAcademicYear(academicYear),
    cycle: studentData.feeCollectionCycle || "monthly",
    baseTuition: studentData.feeAmount || 0,
    transportStandard: 0,
    examFee: 0,
    availableAddons: DEFAULT_ADDON_OPTIONS,
    availableWaivers: DEFAULT_WAIVER_OPTIONS,
  };

  const summary = calculateStudentFeeSummary({
    template: templateSnap.exists() ? templateSnap.data() : fallbackTemplate,
    config: configSnap.exists() ? configSnap.data() : {},
  });

  return {
    student: { id: studentSnap.id, ...studentData },
    templateId: normalize(classId),
    template: summary.template,
    config: summary.config,
    ...summary,
  };
};

export const processFeePayment = async ({
  studentId,
  schoolId,
  academicYear,
  actorName,
  amount,
  paymentMethod = "manual",
  note = "",
  summary,
}) => {
  return processFeeTransaction({
    studentId,
    schoolId,
    academicYear,
    actorName,
    amount,
    transactionType: "payment",
    paymentMethod,
    note,
    summary,
  });
};

export const processFeeTransaction = async ({
  studentId,
  schoolId,
  academicYear,
  actorName,
  amount,
  transactionType = "payment",
  paymentMethod = "manual",
  note = "",
  summary,
}) => {
  const paymentAmount = toAmount(amount);
  if (paymentAmount <= 0) {
    throw new Error("Enter a valid payment amount.");
  }

  const studentRef = doc(db, "studentAccounts", normalize(studentId));
  const enrollmentRef = doc(db, "defaultSchoolEnrollments", normalize(studentId));
  const ledgerRef = doc(getStudentLedgerCollectionRef(studentId));

  return runTransaction(db, async (transaction) => {
    const studentSnap = await transaction.get(studentRef);
    if (!studentSnap.exists()) {
      throw new Error("Student record not found.");
    }

    const studentData = studentSnap.data() || {};
    const liveSummary = summary || (await fetchStudentFeeSummary({
      studentId,
      classId: buildFeeTemplateId({
        schoolId,
        academicYear,
        className: studentData.className,
      }),
      schoolId,
      academicYear,
    }));

    const currentType = normalizeLower(transactionType || "payment");
    let totalDue = toAmount(studentData.feeAmount || liveSummary.customizedStudentTotal);
    const currentPaid = toAmount(studentData.feePaidAmount);
    let nextPaid = currentPaid;

    if (currentType === "payment") {
      nextPaid = Math.min(currentPaid + paymentAmount, totalDue);
    } else if (currentType === "reversal") {
      nextPaid = Math.max(currentPaid - paymentAmount, 0);
    } else if (currentType === "due") {
      totalDue += paymentAmount;
    } else if (currentType === "concession") {
      totalDue = Math.max(totalDue - paymentAmount, currentPaid);
    }

    const currentOutstandingBalance = Math.max(totalDue - nextPaid, 0);
    const status = currentOutstandingBalance === 0 ? "paid" : nextPaid > 0 ? "partial" : "pending";
    const appliedAmount =
      currentType === "payment"
        ? Math.max(nextPaid - currentPaid, 0)
        : currentType === "reversal"
          ? Math.max(currentPaid - nextPaid, 0)
          : paymentAmount;

    if (appliedAmount <= 0 && currentType !== "concession" && currentType !== "due") {
      throw new Error("This student does not have any outstanding balance left.");
    }

    const receiptNumber =
      currentType === "payment"
        ? `RCPT-${normalizeLower(schoolId).slice(0, 4)}-${Date.now().toString().slice(-8)}`
        : "";

    const lockedBreakdown = {
      standardClassFee: toAmount(liveSummary.standardClassFee),
      effectiveBaseFee: toAmount(liveSummary.effectiveBaseFee),
      addonTotal: toAmount(liveSummary.addonTotal),
      waiverTotal: toAmount(liveSummary.waiverTotal),
      customizedStudentTotal: totalDue,
      useClassDefaults: liveSummary.config.useClassDefaults,
      activeWaivers: liveSummary.config.activeWaivers,
      selectedAddons: liveSummary.config.selectedAddons,
    };

    const sharedPayload = {
      schoolId: normalizeLower(schoolId),
      academicYear: normalizeAcademicYear(academicYear),
      currentOutstandingBalance,
      feeAmount: totalDue,
      feePaidAmount: nextPaid,
      feePendingAmount: currentOutstandingBalance,
      feeStatus: status,
      feeCollectionCycle: liveSummary.template.cycle,
      feeCalculationMode: liveSummary.config.useClassDefaults ? "class_default" : "custom_override",
      feeLastPaymentAmount: appliedAmount,
      feeLastPaymentMethod: normalize(paymentMethod) || "manual",
      feeLastPaymentNote: normalize(note),
      feeLastPaymentAt: serverTimestamp(),
      feeLastTransactionType: currentType,
      feeLastReceiptNumber: receiptNumber,
      feeUpdatedAt: serverTimestamp(),
      feeUpdatedBy: normalize(actorName) || "School Admin",
    };

    transaction.set(
      ledgerRef,
      {
        schoolId: normalizeLower(schoolId),
        academicYear: normalizeAcademicYear(academicYear),
        studentId: normalize(studentId),
        className: normalize(studentData.className),
        amountPaid: currentType === "payment" ? appliedAmount : 0,
        amountAdjusted: currentType === "payment" ? 0 : appliedAmount,
        transactionType: currentType,
        paymentMethod: normalize(paymentMethod) || "manual",
        note: normalize(note),
        receiptNumber,
        postedBy: normalize(actorName) || "School Admin",
        postedAt: serverTimestamp(),
        lockedFeeSnapshot: lockedBreakdown,
        resultingOutstandingBalance: currentOutstandingBalance,
        resultingPaidAmount: nextPaid,
      },
      { merge: true }
    );

    transaction.set(studentRef, sharedPayload, { merge: true });
    transaction.set(
      enrollmentRef,
      {
        schoolId: normalizeLower(schoolId),
        academicYear: normalizeAcademicYear(academicYear),
        fullName: normalize(studentData.fullName || studentData.name),
        className: normalize(studentData.className),
        rollNumber: normalize(studentData.rollNumber),
        phone: normalize(studentData.phone || studentData.parentPhone),
        ...sharedPayload,
      },
      { merge: true }
    );

    return {
      feePaidAmount: nextPaid,
      feePendingAmount: currentOutstandingBalance,
      feeStatus: status,
      currentOutstandingBalance,
      appliedAmount,
      receiptNumber,
      transactionType: currentType,
    };
  });
};
