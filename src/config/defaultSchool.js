export const DEFAULT_SCHOOL_SETTINGS_COLLECTION = "appSettings";
export const DEFAULT_SCHOOL_SETTINGS_DOC = "defaultSchool";
export const DEFAULT_SCHOOL_PLANS = {
  single: {
    id: "single",
    name: "Single Class",
    amount: 1000,
    maxClasses: 1,
  },
  multi: {
    id: "multi",
    name: "Multi Class",
    amount: 1800,
    maxClasses: 3,
  },
  mega: {
    id: "mega",
    name: "Mega Plan",
    amount: 2600,
    maxClasses: 999,
    allClasses: true,
  },
};
export const DEFAULT_SCHOOL_PAYMENT_AMOUNT = DEFAULT_SCHOOL_PLANS.single.amount;
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
export const getDefaultSchoolPlan = (planId) => DEFAULT_SCHOOL_PLANS[planId] || DEFAULT_SCHOOL_PLANS.single;
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
