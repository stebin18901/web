export const DEFAULT_SCHOOL_SETTINGS_COLLECTION = "appSettings";
export const DEFAULT_SCHOOL_SETTINGS_DOC = "defaultSchool";
export const DEFAULT_SCHOOL_PLANS = {
  quarterly: {
    id: "quarterly",
    name: "Quarterly",
    amount: 590,
    maxClasses: 999,
    allClasses: true,
    durationLabel: "3 Months",
    description: "Quarterly school access with plan-based student registration payment.",
    suggestedStudentPaymentLabel: "Pay Quarterly Registration",
  },
  half_yearly: {
    id: "half_yearly",
    name: "Half-Yearly",
    amount: 990,
    maxClasses: 999,
    allClasses: true,
    durationLabel: "6 Months",
    description: "Half-yearly school access with plan-based student registration payment.",
    suggestedStudentPaymentLabel: "Pay Half-Yearly Registration",
  },
  yearly: {
    id: "yearly",
    name: "Yearly",
    amount: 1590,
    maxClasses: 999,
    allClasses: true,
    durationLabel: "12 Months",
    description: "Full-year school access with plan-based student registration payment.",
    suggestedStudentPaymentLabel: "Pay Yearly Registration",
  },
};
export const DEFAULT_SCHOOL_PAYMENT_AMOUNT = DEFAULT_SCHOOL_PLANS.quarterly.amount;
export const DEFAULT_SCHOOL_PAYMENT_AMOUNT_PAISE = DEFAULT_SCHOOL_PAYMENT_AMOUNT * 100;
export const DEFAULT_SCHOOL_CLASS_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
];
export const CREATE_PAYMENT_LINK_URL =
  "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/createCustomPaymentLink";
export const VERIFY_DEFAULT_SCHOOL_PAYMENT_URL =
  "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/verifyDefaultSchoolPayment";

export const normalizeSchoolId = (value) => String(value || "").trim().toLowerCase();
export const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
export const normalizeClassName = (value) =>
  String(value || "")
    .trim()
    .replace(/^class\s*/i, "");
export const getDefaultSchoolPlan = (planId) =>
  DEFAULT_SCHOOL_PLANS[planId] || DEFAULT_SCHOOL_PLANS.quarterly;
export const buildSchoolPlanOptions = () => Object.values(DEFAULT_SCHOOL_PLANS);
export const getUniqueClasses = (classes) => {
  const seen = new Set();
  return (Array.isArray(classes) ? classes : [])
    .map(normalizeClassName)
    .filter(Boolean)
    .filter((className) => {
      const key = className.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};
export const getClassValueFromRecord = (record) => {
  if (!record) return "";
  return (
    record.class ||
    record.className ||
    record.grade ||
    record.metadata?.class ||
    record.metadata?.className ||
    record.metadata?.grade ||
    record.quizData?.class ||
    record.quizData?.className ||
    record.quizData?.grade ||
    ""
  );
};
export const buildAvailableClasses = (records, extraClasses = []) => {
  const classes = [
    ...extraClasses,
    ...(Array.isArray(records) ? records.map(getClassValueFromRecord) : []),
  ];
  return getUniqueClasses(classes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};
