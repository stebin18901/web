const functions = require("firebase-functions");
const Razorpay = require("razorpay");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

/**
 * Helper to fetch Razorpay credentials from environment variables securely.
 */
const getRazorpayConfig = () => {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  return {
    keyId: razorpayKeyId ? String(razorpayKeyId).trim() : "",
    keySecret: razorpayKeySecret ? String(razorpayKeySecret).trim() : "",
  };
};

/**
 * Instantiates the Razorpay SDK instance cleanly.
 */
const getRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  if (!keyId || !keySecret) {
    const error = new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your functions/.env file."
    );
    error.statusCode = 503;
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const normalizePhone = (value) => String(value || "").replace(/\D/g, "").slice(-10);
const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Endpoint: Generates a distinct Razorpay checkout link for a user/student.
 */
exports.createCustomPaymentLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      const {
        userId,
        studentId,
        name,
        email,
        phone,
        purpose,
        amount,
        schoolId,
        schoolName,
        planId,
        planName,
        selectedClasses,
        callbackUrl,
      } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      const isDefaultSchoolPayment = purpose === "defaultSchool";
      const requestedAmount = Number(amount || 0);
      const paymentAmount = isDefaultSchoolPayment ? requestedAmount || 100 : requestedAmount || 2900;
      if (!Number.isFinite(paymentAmount) || paymentAmount < 100) {
        return res.status(400).json({ error: "Invalid payment amount." });
      }

      const description = isDefaultSchoolPayment
        ? `Default School ${planName ? `- ${planName}` : "Access"} - ${schoolName || schoolId || "School"}`
        : "Hepsy Premium Subscription";

      const returnUrl =
        callbackUrl ||
        (isDefaultSchoolPayment
          ? `https://hepsy.in/payment-success?defaultStudentId=${encodeURIComponent(studentId || userId)}`
          : "https://hepsy.in/payment-success?uid=" + userId);

      const customer = {
        name: name || "Student",
      };
      if (email) customer.email = email;
      const cleanPhone = normalizePhone(phone);
      if (cleanPhone) customer.contact = cleanPhone;

      const razorpay = getRazorpayClient();
      const paymentLink = await razorpay.paymentLink.create({
        amount: paymentAmount,
        currency: "INR",
        accept_partial: false,
        description,
        customer,
        notes: {
          purpose: purpose || "premium",
          userId,
          studentId: studentId || userId,
          schoolId: schoolId || "",
          planId: planId || "",
          planName: planName || "",
          selectedClasses: JSON.stringify(Array.isArray(selectedClasses) ? selectedClasses : []),
        },
        notify: { sms: !!phone, email: !!email },
        callback_url: returnUrl,
        callback_method: "get",
      });

      if (!paymentLink?.short_url) {
        return res.status(502).json({ error: "Razorpay did not return a payment link." });
      }

      res.status(200).json({ payment_url: paymentLink.short_url, paymentLinkId: paymentLink.id });
    } catch (err) {
      console.error("Payment link error:", err);
      const statusCode = err.statusCode || err.status || 500;
      const razorpayError = err.error?.description || err.error?.reason || err.description;
      res.status(statusCode).json({
        error: razorpayError || err.message || "Payment link creation failed.",
        code: err.code || err.error?.code || "PAYMENT_LINK_FAILED",
      });
    }
  });
});

/**
 * Endpoint: Webhook handler listening directly to incoming events from Razorpay.
 */
exports.verifyPayment = functions.https.onRequest(async (req, res) => {
  try {
    const body = req.body;

    if (body.event === "payment_link.paid") {
      const payment = body.payload.payment_link.entity;
      const notes = payment.notes || {};
      const purpose = notes.purpose || "";
      const userId = notes.userId || (payment.callback_url && payment.callback_url.split("uid=")[1]);
      const studentId = notes.studentId || userId;

      if (purpose === "defaultSchool" && studentId) {
        const selectedClasses = parseJsonArray(notes.selectedClasses);
        const paymentPatch = {
          isPaid: true,
          paymentId: payment.id,
          paymentLinkId: payment.id,
          amount: payment.amount / 100,
          paidAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        if (notes.planId) paymentPatch.planId = notes.planId;
        if (notes.planName) paymentPatch.planName = notes.planName;
        if (selectedClasses.length) paymentPatch.selectedClasses = selectedClasses;
        await admin.firestore().collection("defaultSchoolEnrollments").doc(studentId).set(
          paymentPatch,
          { merge: true }
        );
      } else if (userId) {
        await admin.firestore().collection("users").doc(userId).set(
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

    res.status(200).send("Webhook received");
  } catch (err) {
    console.error("Webhook processing error:", err);
    res.status(500).send("Webhook handler broken");
  }
});

/**
 * Endpoint: Explicit user-facing verification fallback fallback logic when webhooks lag.
 */
exports.verifyDefaultSchoolPayment = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      const defaultStudentId = String(req.body?.defaultStudentId || req.query?.defaultStudentId || "").trim();
      const paymentLinkId = String(
        req.body?.paymentLinkId ||
          req.query?.paymentLinkId ||
          req.body?.razorpay_payment_link_id ||
          req.query?.razorpay_payment_link_id ||
          ""
      ).trim();

      if (!defaultStudentId) {
        return res.status(400).json({ error: "Missing defaultStudentId." });
      }

      if (!paymentLinkId) {
        const enrollmentSnap = await admin.firestore().collection("defaultSchoolEnrollments").doc(defaultStudentId).get();
        if (enrollmentSnap.exists && enrollmentSnap.data().isPaid) {
          return res.status(200).json({ paid: true, source: "firestore" });
        }
        return res.status(400).json({ error: "Missing Razorpay payment link id." });
      }

      const razorpay = getRazorpayClient();
      const paymentLink = await razorpay.paymentLink.fetch(paymentLinkId);
      const notes = paymentLink.notes || {};
      const linkedStudentId = notes.studentId || notes.userId || "";

      if (linkedStudentId && linkedStudentId !== defaultStudentId) {
        return res.status(403).json({ error: "Payment link does not match this student." });
      }

      const paid = paymentLink.status === "paid" || paymentLink.status === "partially_paid";
      if (!paid) {
        return res.status(200).json({ paid: false, status: paymentLink.status || "created" });
      }

      const selectedClasses = parseJsonArray(notes.selectedClasses);
      const paymentPatch = {
        isPaid: true,
        paymentId: paymentLinkId,
        paymentLinkId,
        amount: Number(paymentLink.amount || 0) / 100,
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verifiedBy: "verifyDefaultSchoolPayment",
      };
      if (notes.planId) paymentPatch.planId = notes.planId;
      if (notes.planName) paymentPatch.planName = notes.planName;
      if (selectedClasses.length) paymentPatch.selectedClasses = selectedClasses;
      await admin.firestore().collection("defaultSchoolEnrollments").doc(defaultStudentId).set(
        paymentPatch,
        { merge: true }
      );

      return res.status(200).json({ paid: true, status: paymentLink.status });
    } catch (err) {
      console.error("Default school payment verification error:", err);
      const statusCode = err.statusCode || err.status || 500;
      const razorpayError = err.error?.description || err.error?.reason || err.description;
      return res.status(statusCode).json({
        error: razorpayError || err.message || "Unable to verify payment.",
        code: err.code || err.error?.code || "PAYMENT_VERIFY_FAILED",
      });
    }
  });
});
