import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import "./Pricing.css";

const createPaymentLinkURL =
  "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/createCustomPaymentLink";

export default function Pricing() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPremium, setIsPremium] = useState(null);
  const [userName, setUserName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("upi");

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsPremium(false);
        return;
      }

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setUserName(data.name || "Champion");
          setIsPremium(!!data.isPremium);
        } else setIsPremium(false);
      } catch (err) {
        console.error("Error checking premium status:", err);
        setIsPremium(false);
      }
    };

    fetchUserData();
  }, []);

  const handlePayment = async () => {
    const user = auth.currentUser;
    if (!user) return alert("Please log in first.");

    try {
      setIsProcessing(true);
      const res = await fetch(createPaymentLinkURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          name: user.displayName || "User",
          email: user.email,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment creation failed");

      window.location.href = data.payment_url;
    } catch (err) {
      console.error("Payment initiation failed:", err);
      alert("Error creating payment. Please try again later.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isPremium === null)
    return (
      <div className="pricing-loader">
        <div className="loader-circle"></div>
        <p>Checking your premium status...</p>
      </div>
    );

  return (
    <div className="premium-container">
      {isPremium ? (
        <div className="premium-card success">
          <h1>Hi {userName}! 👑</h1>
          <p>You’re already a <strong>Hepsy Premium Champion</strong> 💪</p>
          <p>Enjoy your exclusive quizzes, leaderboard access & insights!</p>
          <button
            className="dashboard-btn"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="premium-card">
          <h1 className="title">Unlock Hepsy Premium</h1>
          <p className="subtitle">
            Get unlimited access for <strong>₹29/month</strong>
          </p>

          <div className="feature-list">
            <p>✅ Exclusive quizzes & leaderboard</p>
            <p>✅ Premium notes & analytics</p>
            <p>✅ Early access to new features</p>
          </div>

          <div className="method-toggle">
            <label className={paymentMethod === "upi" ? "active" : ""}>
              <input
                type="radio"
                value="upi"
                checked={paymentMethod === "upi"}
                onChange={() => setPaymentMethod("upi")}
              />
              <span>UPI</span>
            </label>
            <label className={paymentMethod === "card" ? "active" : ""}>
              <input
                type="radio"
                value="card"
                checked={paymentMethod === "card"}
                onChange={() => setPaymentMethod("card")}
              />
              <span>Card</span>
            </label>
          </div>

          <button
            className="pay-btn"
            onClick={handlePayment}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : `Pay ₹29 via ${paymentMethod.toUpperCase()}`}
          </button>

          <p className="secure-text">🔒 Secure Payment - Hepsy Gateway</p>
        </div>
      )}
    </div>
  );
}
