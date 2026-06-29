import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import {
  API_ENDPOINTS,
  DEFAULT_PRICING,
  SUBSCRIPTION_FEATURES,
  getPlanById,
  getPlanBillingText,
  getSubscriptionPricingFromSettings,
  getVisibleSubscriptionPlans,
} from "../config/subscriptionConfig";
import "./PlanSelection.css";

const buildStudentSession = (enrollmentId, enrollment) => ({
  id: enrollmentId,
  name: enrollment.name || enrollment.fullName || enrollment.phone || "Student",
  className: enrollment.className || "Default",
  defaultClassName: enrollment.className || "",
  selectedClasses:
    Array.isArray(enrollment.selectedClasses) && enrollment.selectedClasses.length
      ? enrollment.selectedClasses
      : [enrollment.className].filter(Boolean),
  classProfiles: enrollment.classProfiles || {},
  section: enrollment.section || "",
  rollNumber: enrollment.rollNumber || "",
  phone: enrollment.phone || "",
  schoolId: enrollment.schoolId || "",
  schoolName: enrollment.schoolName || "School",
  accessMode: enrollment.accessMode || "default-school",
  isPaid: enrollment.isPaid === true,
  paymentStatus: enrollment.paymentStatus || "",
  registrationStatus: enrollment.registrationStatus || "",
  planId: enrollment.planId || "",
  planName: enrollment.planName || "",
  planMaxClasses: enrollment.planMaxClasses || enrollment.selectedClasses?.length || 1,
  razorpaySubscriptionId: enrollment.razorpaySubscriptionId || "",
  expiryDate: enrollment.expiryDate || "",
  startDate: enrollment.startDate || "",
  loggedInAt: new Date().toISOString(),
});

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
  const [activeSubscriptionId, setActiveSubscriptionId] = useState("");
  const [planSettings, setPlanSettings] = useState({});

  useEffect(() => {
    const loadEnrollment = async () => {
      try {
        if (!enrollmentId) {
          const user = auth.currentUser;
          navigate(user ? "/pricing" : "/login", { replace: true });
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
          const priceSettingsRef = doc(
            db,
            "subscriptionSettings",
            data.schoolId || "default"
          );
          const priceSettingsSnap = await getDoc(priceSettingsRef);
          if (priceSettingsSnap.exists()) {
            const settings = priceSettingsSnap.data();
            setPlanSettings(settings);
            setPricing(getSubscriptionPricingFromSettings(settings));
            const visiblePlans = getVisibleSubscriptionPlans(settings);
            setSelectedPlanId(visiblePlans[0]?.id || "yearly");
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

  const visiblePlans = getVisibleSubscriptionPlans(planSettings);

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
        localStorage.setItem(
          "schoolStudentSession",
          JSON.stringify(buildStudentSession(enrollmentId, enrollment))
        );
        navigate("/dashboard", { replace: true });
        return;
      }

      const enrollmentRef = doc(db, "defaultSchoolEnrollments", enrollmentId);
      const amount = pricing[selectedPlanId];

      await setDoc(
        enrollmentRef,
        {
          planId: selectedPlanId,
          planName: selectedPlan.name,
          planAmount: amount,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const idToken = await currentUser.getIdToken();
      const userPhone = enrollment.phone || auth.currentUser?.phoneNumber || "";
      const userName = enrollment.name || "Student";

      const response = await fetch(API_ENDPOINTS.CREATE_SUBSCRIPTION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          studentId: enrollmentId,
          name: userName,
          email: auth.currentUser?.email || enrollment.email || "user@example.com",
          phone: userPhone,
          planId: selectedPlanId,
          schoolId: enrollment.schoolId || "default",
        }),
      });

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

      if (data.shortUrl) {
        window.location.assign(data.shortUrl);
        return;
      }

      if (!window.Razorpay) {
        throw new Error("Razorpay script not loaded. Please refresh the page.");
      }

      const options = {
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "MINT Entrance Foundation",
        description: `${selectedPlan.name} Subscription`,
        handler: function handleSuccess(responseData) {
          window.location.href = `${window.location.origin}/payment-success?defaultStudentId=${encodeURIComponent(
            enrollmentId
          )}&razorpay_payment_id=${encodeURIComponent(
            responseData.razorpay_payment_id
          )}&razorpay_subscription_id=${encodeURIComponent(
            responseData.razorpay_subscription_id
          )}`;
        },
        prefill: {
          name: userName,
          email: auth.currentUser?.email || enrollment.email || "user@example.com",
          contact: userPhone ? `+91${userPhone}` : "",
        },
        modal: {
          ondismiss: function onDismiss() {
            setSubmitting(false);
          },
        },
        theme: {
          color: "#2563eb",
        },
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
            <span>Unlock all classes (6-10) with one subscription</span>
          </div>
          <button
            type="button"
            onClick={() => navigate("/login", { replace: true })}
            className="btn-back"
          >
            Back
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}

        <section className="plan-grid">
          {visiblePlans.map((plan) => {
            const price = pricing[plan.id];
            const isSelected = selectedPlanId === plan.id;

            return (
              <button
                type="button"
                key={plan.id}
                className={`plan-card ${isSelected ? "active" : ""}`}
                onClick={() => choosePlan(plan.id)}
              >
                <div className="plan-card-badge">
                  {plan.id === "yearly" && (
                    <span className="badge-popular">Best Value</span>
                  )}
                </div>

                <span className="plan-name">{plan.name}</span>
                <strong className="plan-price">Rs {price}</strong>
                <small className="plan-duration">{plan.badge}</small>
                <small className="plan-monthly">
                  {getPlanBillingText(plan.id, price)}
                </small>

                <div className="plan-features">
                  <p>All Classes (6-10)</p>
                  <p>Unlimited Quizzes</p>
                  <p>Auto-Renewal</p>
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
                <strong>{selectedPlan.badge}</strong>
              </div>
              <div className="summary-row">
                <span>Price:</span>
                <strong>Rs {selectedPrice}</strong>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <strong>Rs {selectedPrice}</strong>
              </div>
              <p className="summary-note">
                Automatic renewal enabled, cancel anytime, secure payment with Razorpay
              </p>
            </div>
          </div>
        )}

        <button
          className="plan-pay-btn"
          type="button"
          onClick={handlePay}
          disabled={submitting || !selectedPlan}
        >
          {submitting
            ? "Processing..."
            : enrollment?.isPaid
            ? "Continue to Dashboard"
            : `Subscribe Now - Rs ${selectedPrice}`}
        </button>

        <div className="plan-footer-note">
          <p>
            Payments powered by <strong>Razorpay</strong> | Secure and encrypted |
            Works on all devices
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
