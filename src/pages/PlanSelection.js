import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import {
  SUBSCRIPTION_PLANS,
  DEFAULT_PRICING,
  SUBSCRIPTION_FEATURES,
  getPlanById,
} from "../config/subscriptionConfig";
import "./PlanSelection.css";

const planRows = [
  { id: "quarterly", key: "QUARTERLY" },
  { id: "half_yearly", key: "HALF_YEARLY" },
  { id: "yearly", key: "YEARLY" },
];

const PlanSelection = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const enrollmentId = searchParams.get("enrollmentId") || "";
  const [enrollment, setEnrollment] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState("yearly");
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pricingLoaded, setPricingLoaded] = useState(false);
  
  // Fix: Added state container so subscription details can be read anywhere in the JSX template
  const [activeSubscriptionId, setActiveSubscriptionId] = useState("");

  useEffect(() => {
    const loadEnrollment = async () => {
      try {
        if (!enrollmentId) {
          const user = auth.currentUser;
          if (user) {
            navigate("/pricing", { replace: true });
          } else {
            navigate("/login", { replace: true });
          }
          setLoading(false);
          return;
        }

        const snap = await getDoc(doc(db, "defaultSchoolEnrollments", enrollmentId));
        if (!snap.exists()) {
          setError("Enrollment not found. Please register again.");
          setLoading(false);
          return;
        }

        const data = snap.data();
        setEnrollment(data);
        if (data.razorpaySubscriptionId) {
          setActiveSubscriptionId(data.razorpaySubscriptionId);
        }

        try {
          const priceSettingsRef = doc(db, "subscriptionSettings", "default");
          const priceSettingsSnap = await getDoc(priceSettingsRef);
          if (priceSettingsSnap.exists()) {
            const settings = priceSettingsSnap.data();
            setPricing({
              quarterly: settings.quarterlyPrice || DEFAULT_PRICING.quarterly,
              half_yearly: settings.halfYearlyPrice || DEFAULT_PRICING.half_yearly,
              yearly: settings.yearlyPrice || DEFAULT_PRICING.yearly,
            });
          }
        } catch (err) {
          console.log("Using default pricing:", err.message);
        }

        setPricingLoaded(true);
        setLoading(false);
      } catch (err) {
        console.error("Error loading enrollment:", err);
        setError("Unable to load enrollment details.");
        setLoading(false);
      }
    };

    loadEnrollment();
  }, [enrollmentId, navigate]);

  useEffect(() => {
    const sp = getPlanById(selectedPlanId);
    const spPrice = pricing[selectedPlanId] || DEFAULT_PRICING[selectedPlanId];
    console.debug("PlanSelection debug:", { selectedPlanId, selectedPlan: sp, selectedPrice: spPrice, submitting });
  }, [selectedPlanId, pricing, submitting]);

  const choosePlan = (planId) => {
    setSelectedPlanId(planId);
    setError("");
  };

  const handlePay = async () => {
    if (!enrollment || !pricingLoaded) {
      setError("Loading plan details...");
      return;
    }

    if (!selectedPlanId) {
      setError("Please select a plan.");
      return;
    }

    const selectedPlan = getPlanById(selectedPlanId);
    if (!selectedPlan) {
      setError("Invalid plan selected.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (enrollment.isPaid && enrollment.razorpaySubscriptionId) {
        localStorage.setItem("schoolStudentSession", JSON.stringify(enrollment));
        navigate("/dashboard", { replace: true });
        return;
      }

      const enrollmentRef = doc(db, "defaultSchoolEnrollments", enrollmentId);
      const amount = pricing[selectedPlanId];

      const planPayload = {
        planId: selectedPlanId,
        planName: selectedPlan.name,
        planAmount: amount,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(enrollmentRef, planPayload, { merge: true });

      const userPhone = enrollment.phone || auth.currentUser?.phoneNumber || "";
      const userName = enrollment.name || "Student";

      const response = await fetch(
        "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/createRazorpaySubscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: enrollmentId,
            name: userName,
            email: auth.currentUser?.email || enrollment.email || "user@example.com",
            phone: userPhone,
            planId: selectedPlanId,
            schoolId: enrollment.schoolId || "default",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create subscription");
      }

      const data = await response.json();

      if (!data.subscriptionId) {
        throw new Error("Failed to generate subscription reference");
      }

      setActiveSubscriptionId(data.subscriptionId);

      await setDoc(
        enrollmentRef,
        {
          razorpaySubscriptionId: data.subscriptionId,
          checkoutUrl: data.shortUrl || "",
          subscriptionCreatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (!window.Razorpay) {
        throw new Error("Razorpay script not loaded. Please refresh the page.");
      }

      // --- UPDATE YOUR OPTIONS OBJECT TO THIS EXACT FORMAT ---
      // --- CLEAN SUBSCRIPTION OPTIONS FORMAT ---
      const options = {
        key: "rzp_test_SINM6r07wHAFN6", 
        subscription_id: data.subscriptionId, // ONLY use subscription_id (NO amount, NO currency)
        name: "MINT Entrance Foundation",
        description: `${selectedPlan.name} Subscription`,
        handler: function (response) {
          // This fires the instant you click 'Success' in the test environment!
          window.location.href = `https://hepsy.in/payment-success?defaultStudentId=${encodeURIComponent(enrollmentId)}&razorpay_payment_id=${encodeURIComponent(response.razorpay_payment_id)}&razorpay_subscription_id=${encodeURIComponent(response.razorpay_subscription_id)}`;
        },
        prefill: {
          name: userName,
          email: auth.currentUser?.email || enrollment.email || "user@example.com",
          contact: userPhone ? `+91${userPhone}` : ""
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
          }
        },
        theme: {
          color: "#2563eb"
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();

    } catch (err) {
      console.error("Payment error:", err);
      setError(err.message || "Unable to proceed to payment.");
      setSubmitting(false);
    }
  };

  if (loading || !pricingLoaded) {
    return (
      <div className="plan-page">
        <div className="plan-shell">
          <div className="plan-loader">
            <div className="loader-circle"></div>
            <p>Loading plans...</p>
          </div>
        </div>
      </div>
    );
  }

  const selectedPlan = getPlanById(selectedPlanId);
  const selectedPrice = pricing[selectedPlanId] || DEFAULT_PRICING[selectedPlanId];

  return (
    <div className="plan-page">
      <main className="plan-shell">
        <div className="plan-head">
          <div>
            <p>MINT Entrance Foundation Platform</p>
            <h1>Choose Your Subscription Plan</h1>
            <span>🎓 Unlock all classes (6-10) with one subscription</span>
          </div>
          <button type="button" onClick={() => navigate("/login", { replace: true })} className="btn-back">
            Back
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <section className="plan-grid">
          {planRows.map((planConfig) => {
            const plan = SUBSCRIPTION_PLANS[planConfig.key];
            const price = pricing[planConfig.id];
            const isSelected = selectedPlanId === planConfig.id;
            const monthlyEquivalent = Math.round(price / plan.durationInMonths);

            return (
              <button
                type="button"
                key={plan.id}
                className={`plan-card ${isSelected ? "active" : ""}`}
                onClick={() => choosePlan(planConfig.id)}
              >
                <div className="plan-card-badge">
                  {planConfig.id === "yearly" && <span className="badge-popular">Best Value</span>}
                </div>

                <span className="plan-name">{plan.name}</span>
                <strong className="plan-price">₹{price}</strong>
                <small className="plan-duration">for {plan.durationInMonths} months</small>
                <small className="plan-monthly">₹{monthlyEquivalent}/month</small>

                <div className="plan-features">
                  <p>✅ All Classes (6-10)</p>
                  <p>✅ Unlimited Quizzes</p>
                  <p>✅ Auto-Renewal</p>
                </div>
              </button>
            );
          })}
        </section>

        <section className="features-section">
          <h2>What's Included in Your Subscription</h2>
          <div className="features-list">
            {SUBSCRIPTION_FEATURES.map((feature, idx) => (
              <div key={idx} className="feature-item">
                <span className="feature-check">✓</span>
                <p>{feature}</p>
              </div>
            ))}
          </div>
        </section>

        {selectedPlan && (
          <div className="summary-card">
            <div className="summary-header">
              <h3>Order Summary</h3>
            </div>
            <div className="summary-details">
              <div className="summary-row">
                <span>Plan:</span>
                <strong>{selectedPlan.name}</strong>
              </div>
              <div className="summary-row">
                <span>Duration:</span>
                <strong>{selectedPlan.durationInMonths} months</strong>
              </div>
              <div className="summary-row">
                <span>Price:</span>
                <strong>₹{selectedPrice}</strong>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <strong>₹{selectedPrice}</strong>
              </div>
              <p className="summary-note">
                ✓ Automatic renewal enabled • ✓ Cancel anytime • ✓ Secure payment with Razorpay
              </p>
            </div>
          </div>
        )}

        <button className="plan-pay-btn" type="button" onClick={handlePay} disabled={submitting || !selectedPlan}>
          {submitting ? (
            <>
              <span className="btn-loader"></span>
              Processing...
            </>
          ) : enrollment?.isPaid ? (
            "Continue to Dashboard"
          ) : (
            `Subscribe Now - ₹${selectedPrice}`
          )}
        </button>

        <div className="plan-footer-note">
          <p>
            💳 Payments powered by <strong>Razorpay</strong> | 🔒 Secure & encrypted | 📱 Works on all devices
          </p>
          {activeSubscriptionId && (
            <p style={{ fontSize: "11px", opacity: 0.6, marginTop: "5px" }}>
              Reference Token: {activeSubscriptionId}
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default PlanSelection;