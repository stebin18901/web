const functions = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const Razorpay = require("razorpay");
const admin = require("firebase-admin");
const crypto = require("crypto");
const https = require("https");
const cors = require("cors")({ origin: true });

admin.initializeApp();

const readEnv = (name, fallback = "") =>
  String(process.env[name] || fallback).trim();

// ---------------------------------------------------------------------------
// Razorpay plan IDs (created in your Razorpay dashboard)
// ---------------------------------------------------------------------------

const RAZORPAY_PLAN_IDS = {
  weekly_test: readEnv("RAZORPAY_PLAN_WEEKLY_TEST"),
  quarterly: readEnv("RAZORPAY_PLAN_QUARTERLY", "plan_T1FVocauu2nKwo"),
  half_yearly: readEnv("RAZORPAY_PLAN_HALF_YEARLY", "plan_T1FWOUvC89ozYc"),
  yearly: readEnv("RAZORPAY_PLAN_YEARLY", "plan_T1FWwGWagS8d66"),
};

const VALID_PLAN_IDS = Object.keys(RAZORPAY_PLAN_IDS);

// ---------------------------------------------------------------------------
// Razorpay client helpers
// ---------------------------------------------------------------------------

const getRazorpayConfig = () => ({
  keyId: readEnv("RAZORPAY_KEY_ID"),
  keySecret: readEnv("RAZORPAY_KEY_SECRET"),
});

const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    const err = new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in functions/.env"
    );
    err.statusCode = 503;
    err.code = "RAZORPAY_NOT_CONFIGURED";
    throw err;
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

const normalizePhone = (value) =>
  String(value || "").replace(/\D/g, "").slice(-10);
const normalizeValue = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalizeValue(value).toLowerCase();
const normalizeClassName = (value) => normalizeValue(value).toUpperCase();
const normalizeSection = (value) => normalizeValue(value).toUpperCase();

const splitClassAndDivision = (value) => {
  const normalized = normalizeClassName(value);
  const grade = (normalized.match(/^\d+/)?.[0] || "").trim();
  const division = normalized.slice(grade.length).trim().toUpperCase();
  return { grade, division, combined: normalized };
};

const buildStudentIdCandidates = ({ studentId = "", schoolId = "", className = "", section = "", rollNumber = "" } = {}) => {
  const normalizedStudentId = normalizeValue(studentId).toLowerCase();
  const normalizedSchool = normalizeSchoolId(schoolId);
  const normalizedClass = normalizeClassName(className);
  const normalizedSection = normalizeSection(section);
  const normalizedRoll = normalizeValue(rollNumber);
  const candidates = new Set();

  if (normalizedStudentId) candidates.add(normalizedStudentId);
  if (normalizedRoll) candidates.add(normalizedRoll.toLowerCase());
  if (normalizedSchool && normalizedClass && normalizedRoll) {
    candidates.add(`${normalizedSchool}_${normalizedClass}_${normalizedRoll}`.toLowerCase());
  }

  const classParts = splitClassAndDivision(normalizedClass);
  if (normalizedSchool && classParts.grade && normalizedRoll) {
    candidates.add(`${normalizedSchool}_${classParts.grade}_${normalizedRoll}`.toLowerCase());
    if (normalizedSection) {
      candidates.add(`${normalizedSchool}_${classParts.grade}${normalizedSection}_${normalizedRoll}`.toLowerCase());
      candidates.add(`${normalizedSchool}_${classParts.grade}_${normalizedSection}_${normalizedRoll}`.toLowerCase());
    }
    if (classParts.division) {
      candidates.add(`${normalizedSchool}_${classParts.grade}${classParts.division}_${normalizedRoll}`.toLowerCase());
      candidates.add(`${normalizedSchool}_${classParts.grade}_${classParts.division}_${normalizedRoll}`.toLowerCase());
    }
  }

  return candidates;
};

const deviceMatchesStudentTarget = (device = {}, target = {}) => {
  const deviceCandidates = buildStudentIdCandidates({
    studentId: device.studentId,
    schoolId: device.schoolId,
    className: device.className,
    section: device.section,
    rollNumber: device.rollNumber,
  });
  const targetCandidates = buildStudentIdCandidates({
    studentId: target.studentId,
    schoolId: target.schoolId || device.schoolId,
    className: target.className,
    section: target.section,
    rollNumber: target.rollNumber,
  });

  for (const candidate of targetCandidates) {
    if (deviceCandidates.has(candidate)) return true;
  }

  return false;
};

const classesEquivalent = (leftClass, rightClass, leftSection = "", rightSection = "") => {
  const left = splitClassAndDivision(leftClass);
  const right = splitClassAndDivision(rightClass);

  if (left.combined && right.combined && left.combined === right.combined) return true;
  if (left.grade && right.grade && left.grade === right.grade) {
    const resolvedLeftSection = normalizeSection(leftSection || left.division);
    const resolvedRightSection = normalizeSection(rightSection || right.division);
    if (!resolvedLeftSection || !resolvedRightSection || resolvedLeftSection === resolvedRightSection) {
      return true;
    }
  }

  return false;
};

const postJson = (url, body) =>
  new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const request = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          try {
            resolve(raw ? JSON.parse(raw) : {});
          } catch {
            resolve({});
          }
        });
      }
    );

    request.on("error", reject);
    request.write(payload);
    request.end();
  });

const chunkArray = (items = [], size = 100) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const matchesAnnouncementForDevice = (announcement = {}, device = {}) => {
  const audience = normalizeValue(announcement.audience).toLowerCase();
  const targetMode =
    normalizeValue(announcement.targetMode).toLowerCase() ||
    (audience === "class" ? "class" : audience === "parents" ? "parents" : audience === "teachers" ? "teachers" : "all");

  if (targetMode === "teachers" || audience === "teachers") return false;

  const targetClassName = normalizeClassName(announcement.targetClassName || announcement.className);
  const targetSection = normalizeSection(announcement.targetSection || announcement.section);
  const deviceClassName = normalizeClassName(device.className);
  const deviceSection = normalizeSection(device.section);
  const matchesClassTarget = !targetClassName
    ? true
    : classesEquivalent(deviceClassName, targetClassName, deviceSection, targetSection);

  if (targetMode === "parents") {
    const targetStudentIds = Array.isArray(announcement.targetStudentIds)
      ? announcement.targetStudentIds.map((entry) => normalizeValue(entry))
      : [];

    if (targetStudentIds.length) {
      return targetStudentIds.some((entry) =>
        deviceMatchesStudentTarget(device, {
          studentId: entry,
          schoolId: announcement.schoolId,
          className: announcement.targetClassName || announcement.className,
          section: announcement.targetSection || announcement.section,
        })
      );
    }

    return matchesClassTarget;
  }

  if (targetMode === "class") return matchesClassTarget;
  if (audience === "parents") return matchesClassTarget;

  return true;
};

const sendExpoPushNotifications = async (messages = []) => {
  const validMessages = messages.filter((item) => normalizeValue(item?.to).startsWith("ExponentPushToken["));
  if (!validMessages.length) return [];

  const tickets = [];
  const chunks = chunkArray(validMessages, 100);
  for (const chunk of chunks) {
    const response = await postJson("https://exp.host/--/api/v2/push/send", chunk);
    if (Array.isArray(response?.data)) {
      tickets.push(...response.data);
    }
  }
  return tickets;
};

const pushToParentDevices = async ({
  schoolId,
  title,
  body,
  data = {},
  matcher = () => true,
}) => {
  const normalizedSchool = normalizeSchoolId(schoolId);
  if (!normalizedSchool) return 0;

  const snap = await admin
    .firestore()
    .collection("parentDeviceTokens")
    .where("schoolId", "==", normalizedSchool)
    .get();

  const devices = snap.docs
    .map((entry) => ({ id: entry.id, ...entry.data() }))
    .filter((item) => item.active !== false)
    .filter((item) => normalizeValue(item.token))
    .filter(matcher);

  const uniqueByToken = new Map();
  devices.forEach((item) => {
    uniqueByToken.set(normalizeValue(item.token), item);
  });

  const messages = Array.from(uniqueByToken.values()).map((device) => ({
    to: normalizeValue(device.token),
    sound: "default",
    title: normalizeValue(title) || "School update",
    body: normalizeValue(body) || "A new school update is available.",
    data: {
      ...data,
      schoolId: normalizedSchool,
      studentId: normalizeValue(device.studentId),
      type: normalizeValue(data.type || "announcement"),
    },
  }));

  await sendExpoPushNotifications(messages);
  return messages.length;
};

const normalizeNumericString = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? String(numericValue) : "";
};

const matchesParentNotificationForDevice = (notification = {}, device = {}) => {
  const targetStudentId = normalizeValue(notification.studentId);
  if (targetStudentId) {
    return deviceMatchesStudentTarget(device, {
      studentId: targetStudentId,
      schoolId: notification.schoolId,
      className: notification.className,
      section: notification.section,
      rollNumber: notification.rollNumber,
    });
  }

  const targetRollNumber = normalizeValue(notification.rollNumber);
  const deviceRollNumber = normalizeValue(device.rollNumber);
  if (targetRollNumber && deviceRollNumber && targetRollNumber !== deviceRollNumber) {
    return false;
  }

  return classesEquivalent(
    device.className,
    notification.className,
    device.section,
    notification.section
  );
};

const parentNotificationSignature = (notification = {}) =>
  JSON.stringify({
    active: notification.active !== false,
    schoolId: normalizeSchoolId(notification.schoolId),
    studentId: normalizeValue(notification.studentId),
    rollNumber: normalizeValue(notification.rollNumber),
    className: normalizeClassName(notification.className),
    section: normalizeSection(notification.section),
    type: normalizeValue(notification.type).toLowerCase(),
    title: normalizeValue(notification.title),
    summary: normalizeValue(notification.summary),
    message: normalizeValue(notification.message),
    tone: normalizeValue(notification.tone),
    status: normalizeValue(notification.status).toLowerCase(),
    note: normalizeValue(notification.note),
    relatedDate: normalizeValue(notification.relatedDate),
    examId: normalizeValue(notification.examId),
    examName: normalizeValue(notification.examName),
    academicYear: normalizeValue(notification.academicYear),
    percentage: normalizeNumericString(notification.percentage),
    total: normalizeNumericString(notification.total),
    grade: normalizeValue(notification.grade),
  });

const hasParentNotificationChanged = (before = {}, after = {}) =>
  parentNotificationSignature(before) !== parentNotificationSignature(after);

const announcementSignature = (announcement = {}) =>
  JSON.stringify({
    active: announcement.active !== false,
    schoolId: normalizeSchoolId(announcement.schoolId),
    title: normalizeValue(announcement.title),
    summary: normalizeValue(announcement.summary),
    message: normalizeValue(announcement.message),
    audience: normalizeValue(announcement.audience).toLowerCase(),
    targetMode: normalizeValue(announcement.targetMode).toLowerCase(),
    className: normalizeClassName(announcement.targetClassName || announcement.className),
    section: normalizeSection(announcement.targetSection || announcement.section),
    targetStudentIds: Array.isArray(announcement.targetStudentIds)
      ? announcement.targetStudentIds.map((entry) => normalizeValue(entry).toLowerCase()).sort()
      : [],
  });

const hasAnnouncementChanged = (before = {}, after = {}) =>
  announcementSignature(before) !== announcementSignature(after);

const adminNotificationSignature = (notification = {}) =>
  JSON.stringify({
    active: notification.active !== false,
    schoolId: normalizeSchoolId(notification.schoolId),
    title: normalizeValue(notification.title),
    summary: normalizeValue(notification.summary),
    message: normalizeValue(notification.message),
    tone: normalizeValue(notification.tone).toLowerCase(),
  });

const hasAdminNotificationChanged = (before = {}, after = {}) =>
  adminNotificationSignature(before) !== adminNotificationSignature(after);

const feeNotificationSignature = (record = {}) =>
  JSON.stringify({
    schoolId: normalizeSchoolId(record.schoolId),
    studentId: normalizeValue(record.studentId),
    fullName: normalizeValue(record.fullName || record.name),
    className: normalizeClassName(record.className),
    section: normalizeSection(record.section),
    rollNumber: normalizeValue(record.rollNumber),
    feeStatus: normalizeValue(record.feeStatus).toLowerCase(),
    feeAmount: normalizeNumericString(record.feeAmount),
    feePaidAmount: normalizeNumericString(record.feePaidAmount),
    feePendingAmount: normalizeNumericString(record.feePendingAmount),
    feeCollectionCycle: normalizeValue(record.feeCollectionCycle).toLowerCase(),
  });

const hasFeeNotificationChanged = (before = {}, after = {}) =>
  feeNotificationSignature(before) !== feeNotificationSignature(after);

const buildFeeUpdateBody = (student = {}) => {
  const studentName = normalizeValue(student.fullName || student.name || "Student");
  const feeStatus = normalizeValue(student.feeStatus).toLowerCase();
  const pendingAmount = Number(student.feePendingAmount || 0);
  const paidAmount = Number(student.feePaidAmount || 0);
  const totalAmount = Number(student.feeAmount || 0);
  const cycle = normalizeValue(student.feeCollectionCycle);
  const cycleText = cycle ? `${cycle} fee` : "fee";

  if (feeStatus === "paid") {
    return `${studentName}'s ${cycleText} is marked paid. Total paid: Rs ${paidAmount || totalAmount || 0}.`;
  }
  if (feeStatus === "partial") {
    return `${studentName}'s ${cycleText} was updated. Paid Rs ${paidAmount || 0}, pending Rs ${pendingAmount || 0}.`;
  }
  if (pendingAmount > 0) {
    return `${studentName}'s ${cycleText} is pending. Amount due: Rs ${pendingAmount}.`;
  }
  return `${studentName}'s fee details were updated.`;
};

const getSubscriptionCycleCount = (planId) => {
  switch (planId) {
    case "weekly_test":
      return 1;
    case "quarterly":
      return 4;
    case "half_yearly":
      return 2;
    case "yearly":
      return 1;
    default:
      return 1;
  }
};

const toPaise = (amount) => Math.round(Number(amount || 0) * 100);

const getBearerToken = (req) => {
  const header = req.headers.authorization || req.headers.Authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
};

const authenticateRequest = async (req) => {
  const token = getBearerToken(req);
  if (!token) {
    const err = new Error("Missing Authorization bearer token");
    err.statusCode = 401;
    err.code = "AUTH_TOKEN_MISSING";
    throw err;
  }

  try {
    return await admin.auth().verifyIdToken(token);
  } catch (authError) {
    const err = new Error("Invalid or expired authentication token");
    err.statusCode = 401;
    err.code = "AUTH_TOKEN_INVALID";
    err.cause = authError;
    throw err;
  }
};

/**
 * Calculates the subscription expiry date from today based on planId.
 */
const calculateExpiryDate = (planId) => {
  const d = new Date();
  switch (planId) {
    case "weekly_test":
      d.setDate(d.getDate() + 8);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "half_yearly":
      d.setMonth(d.getMonth() + 6);
      break;
    case "yearly":
    default:
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
};

/**
 * Fetches custom pricing from Firestore; falls back to hardcoded defaults.
 */
const getSubscriptionPricing = async (schoolId) => {
  const defaults = {
    weekly_test: 1,
    quarterly: 590,
    half_yearly: 990,
    yearly: 1599,
  };
  try {
    const snap = await admin
      .firestore()
      .collection("subscriptionSettings")
      .doc(schoolId || "default")
      .get();
    if (!snap.exists) return defaults; // FIX: changed snap.exists() to snap.exists
    const d = snap.data();
    return {
      weekly_test: d.weeklyTestPrice || defaults.weekly_test,
      quarterly: d.quarterlyPrice || defaults.quarterly,
      half_yearly: d.halfYearlyPrice || defaults.half_yearly,
      yearly: d.yearlyPrice || defaults.yearly,
    };
  } catch {
    return defaults;
  }
};

/**
 * Verifies a Razorpay webhook signature.
 * Returns true if valid, false otherwise.
 */
const verifyWebhookSignature = (rawBody, signature, secret) => {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    return crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
};

/**
 * Writes a paid + active state to both the enrollment doc and
 * the subscription doc in a single batch to keep them in sync.
 *
 * Called from multiple webhook event handlers to avoid duplication.
 */
const activateSubscription = async ({
  subscriptionId,
  studentId,
  userId,
  planId,
  startDate,
  expiryDate,
  razorpayStatus,
  amount,
}) => {
  const batch = admin.firestore().batch();

  // subscriptions/{subscriptionId}
  const subRef = admin
    .firestore()
    .collection("subscriptions")
    .doc(subscriptionId);
  batch.set(
    subRef,
    {
      subscriptionActive: true,
      status: "active",
      razorpayStatus,
      planId,
      planName: planId,
      startDate: startDate.toISOString(),
      expiryDate: expiryDate.toISOString(),
      updatedAt: new Date().toISOString(),
      ...(amount !== undefined ? { amount } : {}),
    },
    { merge: true }
  );

  // defaultSchoolEnrollments/{studentId}
  if (studentId) {
    const enrollRef = admin
      .firestore()
      .collection("defaultSchoolEnrollments")
      .doc(studentId);
    batch.set(
      enrollRef,
      {
        isPaid: true,
        planId,
        planName: planId,
        razorpaySubscriptionId: subscriptionId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // users/{userId}
  if (userId) {
    const userRef = admin.firestore().collection("users").doc(userId);
    batch.set(
      userRef,
      {
        subscriptionActive: true,
        razorpaySubscriptionId: subscriptionId,
        planType: planId,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();
};

/**
 * Deactivates a subscription across both collections.
 */
const deactivateSubscription = async ({
  subscriptionId,
  userId,
  razorpayStatus,
  cancelledAt,
}) => {
  const batch = admin.firestore().batch();

  const subRef = admin
    .firestore()
    .collection("subscriptions")
    .doc(subscriptionId);
  batch.set(
    subRef,
    {
      subscriptionActive: false,
      status: razorpayStatus || "cancelled",
      razorpayStatus,
      ...(cancelledAt ? { cancelledAt } : {}),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  if (userId) {
    const userRef = admin.firestore().collection("users").doc(userId);
    batch.set(
      userRef,
      {
        subscriptionActive: false,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();
};

// ===========================================================================
// ENDPOINT: createRazorpaySubscription
// POST — creates a Razorpay subscription and saves it to Firestore
// ===========================================================================

exports.createRazorpaySubscription = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const decodedToken = await authenticateRequest(req);
      const {
        studentId,
        name,
        email,
        phone,
        planId,
        schoolId,
      } = req.body || {};
      const userId = decodedToken.uid;

      if (!planId) return res.status(400).json({ error: "Missing planId" });
      if (!VALID_PLAN_IDS.includes(planId)) {
        return res.status(400).json({ error: `Invalid planId. Must be one of: ${VALID_PLAN_IDS.join(", ")}` });
      }
      if (!RAZORPAY_PLAN_IDS[planId]) {
        return res.status(400).json({
          error: `Razorpay plan ID is not configured for ${planId}. Update functions/.env first.`,
        });
      }

      const pricing = await getSubscriptionPricing(schoolId);
      const amount = pricing[planId];
      if (!Number.isFinite(amount) || amount < 1) {
        return res.status(400).json({ error: "Invalid subscription amount" });
      }

      const targetStudentId = studentId || userId;
      const razorpay = getRazorpayClient();

      if (studentId && studentId !== userId) {
        const enrollmentSnap = await admin
          .firestore()
          .collection("defaultSchoolEnrollments")
          .doc(studentId)
          .get();

        if (!enrollmentSnap.exists) {
          return res.status(404).json({ error: "Enrollment not found" });
        }

        const enrollmentData = enrollmentSnap.data() || {};
        const tokenPhone = normalizePhone(decodedToken.phone_number);
        const enrollmentPhone = normalizePhone(enrollmentData.phone);

        if (enrollmentPhone && tokenPhone && enrollmentPhone !== tokenPhone) {
          return res.status(403).json({
            error: "Authenticated user is not allowed to create a subscription for this enrollment",
            code: "SUBSCRIPTION_FORBIDDEN",
          });
        }
      }

      // Check for an existing subscription for this enrollment and reuse it
      const existingEnrollSnap = await admin
        .firestore()
        .collection("defaultSchoolEnrollments")
        .doc(targetStudentId)
        .get();

      if (existingEnrollSnap.exists) {
        const existing = existingEnrollSnap.data();
        if (existing.razorpaySubscriptionId) {
          try {
            const existingSub = await razorpay.subscriptions.fetch(
              existing.razorpaySubscriptionId
            );
            const pendingStatuses = ["created", "authenticated", "pending"];
            const activeStatuses = ["active"];
            if (pendingStatuses.includes(existingSub.status)) {
              return res.status(200).json({
                success: true,
                subscriptionId: existing.razorpaySubscriptionId,
                status: existingSub.status,
                shortUrl: existingSub.short_url || "",
                message: "Existing pending subscription returned",
              });
            }
            if (activeStatuses.includes(existingSub.status)) {
              return res.status(200).json({
                success: true,
                subscriptionId: existing.razorpaySubscriptionId,
                status: existingSub.status,
                shortUrl: existingSub.short_url || "",
                message: "Existing active subscription returned",
              });
            }
          } catch {
            // Couldn't fetch — create a new subscription
          }
        }
      }

      // Look up Razorpay customer ID if we have one saved
      const userSnap = await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .get();
      const userData = userSnap.exists ? userSnap.data() : {}; // FIX: changed .exists() to .exists

      const subscriptionPayload = {
        plan_id: RAZORPAY_PLAN_IDS[planId],
        customer_notify: 1,
        quantity: 1,
        total_count: getSubscriptionCycleCount(planId),
        notes: {
          userId,
          studentId: targetStudentId,
          name: name || "Student",
          email: email || "",
          phone: normalizePhone(phone),
          schoolId: schoolId || "default",
          planId,
        },
      };

      if (userData.razorpayCustomerId) {
        subscriptionPayload.customer_id = userData.razorpayCustomerId;
      }

      const subscription = await razorpay.subscriptions.create(
        subscriptionPayload
      );

      if (!subscription?.id) {
        return res
          .status(502)
          .json({ error: "Razorpay did not return a subscription ID" });
      }

      // Save initial subscription record to Firestore
      const startDate = new Date();
      const expiryDate = calculateExpiryDate(planId);

      await admin
        .firestore()
        .collection("subscriptions")
        .doc(subscription.id)
        .set({
          userId,
          studentId: targetStudentId,
          razorpaySubscriptionId: subscription.id,
          planId,
          planName: planId,
          amount,
          schoolId: schoolId || "default",
          startDate: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          subscriptionActive: false,   // true only after webhook confirms payment
          status: subscription.status || "created",
          razorpayStatus: subscription.status || "created",
          autoRenewal: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      // Also save subscription ID back to enrollment so frontend can read it
      await admin
        .firestore()
        .collection("defaultSchoolEnrollments")
        .doc(targetStudentId)
        .set(
          {
            razorpaySubscriptionId: subscription.id,
            planId,
            planName: planId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

      // Save to user doc as well
      await admin
        .firestore()
        .collection("users")
        .doc(userId)
        .set(
          {
            razorpaySubscriptionId: subscription.id,
            planType: planId,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

      return res.status(200).json({
        success: true,
        subscriptionId: subscription.id,
        status: subscription.status,
        shortUrl: subscription.short_url || "",
        keyId: getRazorpayConfig().keyId,
        message: "Subscription created successfully",
      });
    } catch (err) {
      console.error("createRazorpaySubscription error:", err);
      const statusCode = err.statusCode || 500;
      const message =
        err.error?.description || err.message || "Subscription creation failed";
      return res.status(statusCode).json({
        error: message,
        code: err.code || "SUBSCRIPTION_CREATION_FAILED",
      });
    }
  });
});

// ===========================================================================
// ENDPOINT: verifySubscriptionWebhook
// POST — receives Razorpay webhook events and updates Firestore
// ===========================================================================

exports.verifySubscriptionWebhook = functions.https.onRequest(
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody;

    if (!webhookSecret) {
      console.error(
        "RAZORPAY_WEBHOOK_SECRET not set. Rejecting webhook until the secret is configured."
      );
      return res.status(503).json({ error: "Webhook secret not configured" });
    }

    const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.warn("Invalid webhook signature - request rejected");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { event, payload } = req.body || {};
    if (!event || !payload) {
      return res.status(400).json({ error: "Invalid webhook payload" });
    }

    console.log("Webhook event received:", event);

    try {
      if (
        event === "subscription.authenticated" ||
        event === "subscription.activated"
      ) {
        const sub = payload.subscription.entity;
        const notes = sub.notes || {};
        const subscriptionId = sub.id;
        const userId = notes.userId;
        const studentId = notes.studentId || userId;
        const planId = notes.planId || "";
        const startDate = sub.created_at
          ? new Date(sub.created_at * 1000)
          : new Date();
        const expiryDate = calculateExpiryDate(planId);

        await activateSubscription({
          subscriptionId,
          studentId,
          userId,
          planId,
          startDate,
          expiryDate,
          razorpayStatus: sub.status,
        });

        await admin.firestore().collection("subscriptionHistory").add({
          userId,
          studentId,
          subscriptionId,
          event,
          planId,
          timestamp: new Date().toISOString(),
        });
      } else if (event === "invoice.paid") {
        const invoice = payload.invoice.entity;
        const subscriptionId = invoice.subscription_id;
        if (!subscriptionId) {
          return res.status(200).json({ received: true, note: "No subscriptionId on invoice" });
        }

        const notes = invoice.notes || {};
        const userId = notes.userId;
        const studentId = notes.studentId || userId;
        const planId = notes.planId || "";
        const paidAt = invoice.paid_at
          ? new Date(invoice.paid_at * 1000)
          : new Date();
        const expiryDate = calculateExpiryDate(planId);
        const amount = Number(invoice.amount || 0) / 100;

        await activateSubscription({
          subscriptionId,
          studentId,
          userId,
          planId,
          startDate: paidAt,
          expiryDate,
          razorpayStatus: "active",
          amount,
        });

        await admin
          .firestore()
          .collection("subscriptions")
          .doc(subscriptionId)
          .set(
            { lastPaymentDate: paidAt.toISOString() },
            { merge: true }
          );

        await admin.firestore().collection("subscriptionHistory").add({
          userId,
          studentId,
          subscriptionId,
          event: "invoice.paid",
          invoiceId: invoice.id,
          amount,
          planId,
          timestamp: new Date().toISOString(),
        });
      } else if (event === "subscription.updated") {
        const sub = payload.subscription.entity;
        await admin
          .firestore()
          .collection("subscriptions")
          .doc(sub.id)
          .set(
            {
              razorpayStatus: sub.status,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      } else if (event === "subscription.paused") {
        const sub = payload.subscription.entity;
        const notes = sub.notes || {};
        await deactivateSubscription({
          subscriptionId: sub.id,
          userId: notes.userId,
          razorpayStatus: "paused",
        });
      } else if (event === "subscription.resumed") {
        const sub = payload.subscription.entity;
        const notes = sub.notes || {};
        const planId = notes.planId || "";
        const startDate = sub.current_start
          ? new Date(sub.current_start * 1000)
          : new Date();
        const expiryDate = sub.current_end
          ? new Date(sub.current_end * 1000)
          : calculateExpiryDate(planId);

        await activateSubscription({
          subscriptionId: sub.id,
          studentId: notes.studentId || notes.userId,
          userId: notes.userId,
          planId,
          startDate,
          expiryDate,
          razorpayStatus: sub.status,
        });
      } else if (event === "subscription.cancelled") {
        const sub = payload.subscription.entity;
        const notes = sub.notes || {};
        const endedAt = sub.ended_at
          ? new Date(sub.ended_at * 1000).toISOString()
          : new Date().toISOString();

        await deactivateSubscription({
          subscriptionId: sub.id,
          userId: notes.userId,
          razorpayStatus: "cancelled",
          cancelledAt: endedAt,
        });

        if (notes.studentId) {
          await admin
            .firestore()
            .collection("defaultSchoolEnrollments")
            .doc(notes.studentId)
            .set(
              {
                isPaid: false,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      } else if (event === "subscription.completed") {
        const sub = payload.subscription.entity;
        const notes = sub.notes || {};
        await deactivateSubscription({
          subscriptionId: sub.id,
          userId: notes.userId,
          razorpayStatus: "completed",
        });
      } else if (event === "payment.failed") {
        const payment = payload.payment?.entity;
        if (payment?.subscription_id) {
          await admin
            .firestore()
            .collection("subscriptions")
            .doc(payment.subscription_id)
            .set(
              {
                lastFailedPaymentAt: new Date().toISOString(),
                lastFailureReason:
                  payment.error_description || "Payment failed",
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      } else {
        console.log("Unhandled webhook event (acknowledged):", event);
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("Webhook processing error:", err);
      return res.status(200).json({
        received: true,
        warning: "Processing error logged",
      });
    }
  }
);

// ===========================================================================
// ENDPOINT: fetchSubscription
// ===========================================================================

exports.fetchSubscription = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (!["GET", "POST"].includes(req.method)) {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const decodedToken = await authenticateRequest(req);
      const subscriptionId =
        req.query.subscriptionId || (req.body && req.body.subscriptionId);
      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }

      const localSubSnap = await admin
        .firestore()
        .collection("subscriptions")
        .doc(subscriptionId)
        .get();

      if (!localSubSnap.exists) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const localSub = localSubSnap.data() || {};
      if (localSub.userId !== decodedToken.uid) {
        return res.status(403).json({
          error: "You are not allowed to access this subscription",
          code: "SUBSCRIPTION_FORBIDDEN",
        });
      }

      const razorpay = getRazorpayClient();
      const sub = await razorpay.subscriptions.fetch(subscriptionId);

      return res.status(200).json({
        success: true,
        subscription: {
          id: sub.id,
          status: sub.status,
          planId: sub.plan_id,
          currentStart: sub.current_start
            ? new Date(sub.current_start * 1000).toISOString()
            : null,
          currentEnd: sub.current_end
            ? new Date(sub.current_end * 1000).toISOString()
            : null,
          endedAt: sub.ended_at
            ? new Date(sub.ended_at * 1000).toISOString()
            : null,
          quantity: sub.quantity,
          notes: sub.notes || {},
        },
      });
    } catch (err) {
      console.error("fetchSubscription error:", err);
      return res.status(err.statusCode || 500).json({
        error: err.message || "Failed to fetch subscription",
        code: err.code || "FETCH_FAILED",
      });
    }
  });
});

// ===========================================================================
// ENDPOINT: cancelSubscription
// ===========================================================================

exports.cancelSubscription = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const decodedToken = await authenticateRequest(req);
      const { subscriptionId } = req.body || {};
      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }

      const subSnap = await admin
        .firestore()
        .collection("subscriptions")
        .doc(subscriptionId)
        .get();

      if (!subSnap.exists) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const subData = subSnap.data() || {};
      if (subData.userId !== decodedToken.uid) {
        return res.status(403).json({
          error: "You are not allowed to cancel this subscription",
          code: "SUBSCRIPTION_FORBIDDEN",
        });
      }

      const razorpay = getRazorpayClient();
      const cancelled = await razorpay.subscriptions.cancel(subscriptionId, {
        cancel_at_cycle_end: true,
      });

      const nowIso = new Date().toISOString();
      const currentEnd = cancelled.current_end
        ? new Date(cancelled.current_end * 1000).toISOString()
        : subData.expiryDate || nowIso;
      const keepAccessUntilEnd = new Date(currentEnd) > new Date();
      const effectiveStatus = keepAccessUntilEnd ? "active" : "cancelled";

      const batch = admin.firestore().batch();
      batch.set(
        admin.firestore().collection("subscriptions").doc(subscriptionId),
        {
          autoRenewal: false,
          cancellationScheduled: keepAccessUntilEnd,
          cancellationEffectiveAt: currentEnd,
          subscriptionActive: keepAccessUntilEnd,
          status: effectiveStatus,
          razorpayStatus: cancelled.status,
          currentEnd,
          expiryDate: currentEnd,
          cancelledAt: nowIso,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      batch.set(
        admin.firestore().collection("users").doc(decodedToken.uid),
        {
          subscriptionActive: keepAccessUntilEnd,
          expiryDate: currentEnd,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (subData.studentId) {
        batch.set(
          admin
            .firestore()
            .collection("defaultSchoolEnrollments")
            .doc(subData.studentId),
          {
            isPaid: keepAccessUntilEnd,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      await batch.commit();

      return res.status(200).json({
        success: true,
        message: keepAccessUntilEnd
          ? "Subscription will cancel at the end of the current billing period"
          : "Subscription cancelled successfully",
        status: effectiveStatus,
        razorpayStatus: cancelled.status,
        cancellationScheduled: keepAccessUntilEnd,
        cancellationEffectiveAt: currentEnd,
      });
    } catch (err) {
      console.error("cancelSubscription error:", err);
      return res.status(err.statusCode || 500).json({
        error: err.message || "Failed to cancel subscription",
        code: err.code || "CANCEL_FAILED",
      });
    }
  });
});

// ===========================================================================
// ENDPOINT: resumeSubscription
// ===========================================================================

exports.resumeSubscription = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method Not Allowed" });
      }

      const decodedToken = await authenticateRequest(req);
      const { subscriptionId } = req.body || {};
      if (!subscriptionId) {
        return res.status(400).json({ error: "Missing subscriptionId" });
      }

      const subRef = admin
        .firestore()
        .collection("subscriptions")
        .doc(subscriptionId);
      const subSnap = await subRef.get();

      if (!subSnap.exists) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      const subData = subSnap.data() || {};
      if (subData.userId !== decodedToken.uid) {
        return res.status(403).json({
          error: "You are not allowed to resume this subscription",
          code: "SUBSCRIPTION_FORBIDDEN",
        });
      }

      const razorpay = getRazorpayClient();
      const resumed = await razorpay.subscriptions.resume(subscriptionId, {
        resume_at: "now",
      });

      const batch = admin.firestore().batch();
      const nowIso = new Date().toISOString();
      const currentStart = resumed.current_start
        ? new Date(resumed.current_start * 1000).toISOString()
        : subData.startDate || nowIso;
      const currentEnd = resumed.current_end
        ? new Date(resumed.current_end * 1000).toISOString()
        : subData.expiryDate || nowIso;
      const isActive = resumed.status === "active";

      batch.set(
        subRef,
        {
          autoRenewal: true,
          subscriptionActive: isActive,
          status: resumed.status,
          razorpayStatus: resumed.status,
          startDate: currentStart,
          expiryDate: currentEnd,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      const userRef = admin.firestore().collection("users").doc(decodedToken.uid);
      batch.set(
        userRef,
        {
          subscriptionActive: isActive,
          startDate: currentStart,
          expiryDate: currentEnd,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      if (subData.studentId) {
        const enrollmentRef = admin
          .firestore()
          .collection("defaultSchoolEnrollments")
          .doc(subData.studentId);
        batch.set(
          enrollmentRef,
          {
            isPaid: isActive,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      await batch.commit();

      return res.status(200).json({
        success: true,
        message: "Subscription resumed successfully",
        subscription: {
          id: resumed.id,
          status: resumed.status,
          currentStart,
          currentEnd,
        },
      });
    } catch (err) {
      console.error("resumeSubscription error:", err);
      return res.status(err.statusCode || 500).json({
        error: err.message || "Failed to resume subscription",
        code: err.code || "RESUME_FAILED",
      });
    }
  });
});

// ===========================================================================
// ENDPOINT: createCustomPaymentLink (legacy)
// ===========================================================================

exports.createCustomPaymentLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).send("Method Not Allowed");
      }

      const {
        userId,
        studentId,
        studentAccountId,
        name,
        email,
        phone,
        purpose,
        amount,
        schoolId,
        schoolName,
        className,
        rollNumber,
        planId,
        planName,
        callbackUrl,
      } = req.body;

      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const isDefaultSchool = purpose === "defaultSchool";
      const paymentAmountRupees = Number(amount || 0);
      if (!Number.isFinite(paymentAmountRupees) || paymentAmountRupees < 1) {
        return res.status(400).json({ error: "Invalid payment amount." });
      }
      const paymentAmount = toPaise(paymentAmountRupees);

      const description = isDefaultSchool
        ? `Default School Access — ${schoolName || schoolId || "School"}`
        : "Hepsy Premium Subscription";

      const returnUrl =
        callbackUrl ||
        (isDefaultSchool
          ? `https://hepsy.in/payment-success?defaultStudentId=${encodeURIComponent(studentId || userId)}`
          : `https://hepsy.in/payment-success?uid=${userId}`);

      const customer = { name: name || "Student" };
      if (email) customer.email = email;
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone) customer.contact = cleanPhone;

      const razorpay = getRazorpayClient();
      const link = await razorpay.paymentLink.create({
        amount: paymentAmount,
        currency: "INR",
        accept_partial: false,
        description,
        customer,
        notes: {
          purpose: purpose || "premium",
          userId,
          studentId: studentId || userId,
          studentAccountId: studentAccountId || studentId || userId,
          schoolId: schoolId || "",
          schoolName: schoolName || "",
          className: className || "",
          rollNumber: rollNumber || "",
          planId: planId || "",
          planName: planName || "",
        },
        notify: { sms: !!phone, email: !!email },
        callback_url: returnUrl,
        callback_method: "get",
      });

      if (!link?.short_url) {
        return res
          .status(502)
          .json({ error: "Razorpay did not return a payment link." });
      }

      return res.status(200).json({
        payment_url: link.short_url,
        paymentLinkId: link.id,
      });
    } catch (err) {
      console.error("createCustomPaymentLink error:", err);
      const statusCode = err.statusCode || err.status || 500;
      const razorpayError =
        err.error?.description || err.error?.reason || err.description;
      return res.status(statusCode).json({
        error: razorpayError || err.message || "Payment link creation failed.",
        code: err.code || err.error?.code || "PAYMENT_LINK_FAILED",
      });
    }
  });
});

// ===========================================================================
// ENDPOINT: verifyPayment (legacy webhook)
// ===========================================================================

exports.verifyPayment = functions.https.onRequest(async (req, res) => {
  try {
    const webhookSecret =
      process.env.RAZORPAY_PAYMENT_LINK_WEBHOOK_SECRET ||
      process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error(
        "verifyPayment webhook secret is not configured. Set RAZORPAY_PAYMENT_LINK_WEBHOOK_SECRET or RAZORPAY_WEBHOOK_SECRET."
      );
      return res.status(503).send("Webhook secret not configured");
    }

    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody;
    const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      console.warn("Invalid payment webhook signature - request rejected");
      return res.status(400).send("Invalid signature");
    }

    const { event, payload } = req.body;

    if (event === "payment_link.paid") {
      const payment = payload.payment_link.entity;
      const notes = payment.notes || {};
      const purpose = notes.purpose || "";
      const userId =
        notes.userId ||
        (payment.callback_url && payment.callback_url.split("uid=")[1]);
      const studentId = notes.studentId || userId;

      if (purpose === "defaultSchool" && studentId) {
        const studentAccountId = notes.studentAccountId || studentId;
        const className = notes.className || "";
        const rollNumber = notes.rollNumber || "";
        const classId = notes.schoolId && className ? `${notes.schoolId}_${className}` : "";

        await admin
          .firestore()
          .collection("defaultSchoolEnrollments")
          .doc(studentId)
          .set(
            {
              isPaid: true,
              paymentId: payment.id,
              paymentLinkId: payment.id,
              amount: payment.amount / 100,
              planId: notes.planId || "",
              planName: notes.planName || "",
              schoolId: notes.schoolId || "",
              schoolName: notes.schoolName || "",
              className,
              rollNumber,
              paidAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );

        if (studentAccountId) {
          await admin
            .firestore()
            .collection("studentAccounts")
            .doc(studentAccountId)
            .set(
              {
                paymentStatus: "paid",
                registrationStatus: "active",
                paymentId: payment.id,
                paymentLinkId: payment.id,
                amount: payment.amount / 100,
                planId: notes.planId || "",
                planName: notes.planName || "",
                schoolId: notes.schoolId || "",
                schoolName: notes.schoolName || "",
                className,
                rollNumber,
                paidAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }

        if (classId && rollNumber) {
          await admin
            .firestore()
            .collection("classes")
            .doc(classId)
            .collection("students")
            .doc(String(rollNumber))
            .set(
              {
                paymentStatus: "paid",
                registrationStatus: "active",
                paymentId: payment.id,
                paymentLinkId: payment.id,
                amount: payment.amount / 100,
                planId: notes.planId || "",
                planName: notes.planName || "",
                schoolId: notes.schoolId || "",
                schoolName: notes.schoolName || "",
                paidAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
        }
      } else if (purpose === "schoolRegistration" && userId) {
        await admin
          .firestore()
          .collection("schools")
          .doc(userId)
          .set(
            {
              schoolId: notes.schoolId || userId,
              schoolName: notes.schoolName || notes.name || "School",
              email: notes.email || "",
              planId: notes.planId || "",
              planName: notes.planName || "",
              paymentStatus: "paid",
              registrationStatus: "active",
              paymentId: payment.id,
              paymentLinkId: payment.id,
              amount: payment.amount / 100,
              paidAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      } else if (userId) {
        await admin
          .firestore()
          .collection("users")
          .doc(userId)
          .set(
            {
              isPremium: true,
              paymentId: payment.id,
              amount: payment.amount / 100,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
      }
    }

    return res.status(200).send("Webhook received");
  } catch (err) {
    console.error("verifyPayment webhook error:", err);
    return res.status(500).send("Webhook handler error");
  }
});

exports.pushParentAnnouncementOnWrite = functionsV1.firestore
  .document("announcements/{announcementId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() || {} : null;
    const announcement = change.after.exists ? change.after.data() || {} : null;
    if (!announcement || announcement.active === false) return null;
    if (before && !hasAnnouncementChanged(before, announcement)) return null;

    const audience = normalizeValue(announcement.audience).toLowerCase();
    const targetMode = normalizeValue(announcement.targetMode).toLowerCase();

    if (audience === "teachers" || targetMode === "teachers") return null;

    const delivered = await pushToParentDevices({
      schoolId: announcement.schoolId,
      title: announcement.title || "School announcement",
      body: announcement.message || announcement.summary || "A new school announcement is available.",
      data: {
        type: "announcement",
        announcementId: context.params.announcementId,
      },
      matcher: (device) => matchesAnnouncementForDevice(announcement, device),
    });

    console.log("pushParentAnnouncementOnWrite delivered:", delivered);
    return null;
  });

exports.pushParentAdminNotificationOnWrite = functionsV1.firestore
  .document("adminNotifications/{notificationId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() || {} : null;
    const notification = change.after.exists ? change.after.data() || {} : null;
    if (!notification || notification.active === false) return null;
    if (before && !hasAdminNotificationChanged(before, notification)) return null;

    if (notification.active === false) return null;

    const delivered = await pushToParentDevices({
      schoolId: notification.schoolId,
      title: notification.title || "School update",
      body: notification.summary || notification.message || "A new school update is available.",
      data: {
        type: "adminNotification",
        notificationId: context.params.notificationId,
      },
    });

    console.log("pushParentAdminNotificationOnWrite delivered:", delivered);
    return null;
  });

exports.pushParentNotificationOnWrite = functionsV1.firestore
  .document("parentNotifications/{notificationId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() || {} : null;
    const after = change.after.exists ? change.after.data() || {} : null;

    if (!after || after.active === false) return null;
    if (before && !hasParentNotificationChanged(before, after)) return null;

    const notificationType = normalizeValue(after.type).toLowerCase() || "parentNotification";
    const delivered = await pushToParentDevices({
      schoolId: after.schoolId,
      title: after.title || "Student update",
      body: after.message || after.summary || "A new update is available for your child.",
      data: {
        type: notificationType,
        notificationId: context.params.notificationId,
      },
      matcher: (device) => matchesParentNotificationForDevice(after, device),
    });

    console.log("pushParentNotificationOnWrite delivered:", delivered, context.params.notificationId);
    return null;
  });

exports.pushParentFeeNotificationOnUpdate = functionsV1.firestore
  .document("studentAccounts/{studentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    if (!normalizeSchoolId(after.schoolId)) return null;
    if (!hasFeeNotificationChanged(before, after)) return null;

    const studentName = normalizeValue(after.fullName || after.name || "Student");
    const delivered = await pushToParentDevices({
      schoolId: after.schoolId,
      title: `Fee update: ${studentName}`,
      body: buildFeeUpdateBody(after),
      data: {
        type: "fees",
        studentId: context.params.studentId,
      },
      matcher: (device) =>
        deviceMatchesStudentTarget(device, {
          studentId: context.params.studentId,
          schoolId: after.schoolId,
          className: after.className,
          section: after.section,
          rollNumber: after.rollNumber,
        }),
    });

    console.log("pushParentFeeNotificationOnUpdate delivered:", delivered, context.params.studentId);
    return null;
  });

// ===========================================================================
// ENDPOINT: testFunction
// ===========================================================================

exports.testFunction = functions.https.onRequest((req, res) => {
  res.send("TEST OK");
});
