const functions = require("firebase-functions");
const Razorpay = require("razorpay");
const admin = require("firebase-admin");
const cors = require("cors")({ origin: true });

admin.initializeApp();

const razorpay = new Razorpay({
  key_id: "rzp_test_RRLIUKVhNEnWLh",
  key_secret: "oreGjVA0HaxcttXBkBb18sTE",
});

// ✅ Create payment link (not popup)
exports.createCustomPaymentLink = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      const { userId, name, email } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing userId" });

      // Create payment link
      const paymentLink = await razorpay.paymentLink.create({
        amount: 2900, // ₹29
        currency: "INR",
        accept_partial: false,
        description: "Hepsy Premium Subscription",
        customer: {
          name,
          email,
        },
        notify: { sms: true, email: true },
        callback_url: "https://hepsy.in/payment-success?uid=" + userId,
        callback_method: "get",
      });

      res.status(200).json({ payment_url: paymentLink.short_url });
    } catch (err) {
      console.error("Payment link error:", err);
      res.status(500).json({ error: err.message });
    }
  });
});

// ✅ Webhook for auto Firestore update
exports.verifyPayment = functions.https.onRequest((req, res) => {
  const body = req.body;

  if (body.event === "payment_link.paid") {
    const payment = body.payload.payment_link.entity;
    const userId = payment.callback_url.split("uid=")[1];
    if (userId) {
      admin.firestore().collection("users").doc(userId).set(
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
});
