import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_FEATURES,
  DEFAULT_PRICING,
  formatPrice,
  convertToSmallestUnit,
  API_ENDPOINTS,
  getPlanById,
} from "../config/subscriptionConfig";
import "./SubscriptionCheckout.css";

const SubscriptionCheckout = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState(null);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [schoolId, setSchoolId] = useState("default");

  // Fetch user data and pricing on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Please log in first");
          setLoading(false);
          return;
        }

        // Get user data from Firebase
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserData(userData);
          if (userData.schoolId) {
            setSchoolId(userData.schoolId);
          }
        } else {
          setUserData({
            uid: user.uid,
            name: user.displayName || "User",
            email: user.email || "",
            phone: user.phoneNumber || "",
          });
        }

        // Get subscription pricing from Firestore
        const settingsRef = doc(db, "subscriptionSettings", schoolId || "default");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          setPricing({
            quarterly: settings.quarterlyPrice || DEFAULT_PRICING.quarterly,
            half_yearly: settings.halfYearlyPrice || DEFAULT_PRICING.half_yearly,
            yearly: settings.yearlyPrice || DEFAULT_PRICING.yearly,
          });
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user information");
        setLoading(false);
      }
    };

    fetchUserData();
    // If plan query param is provided, preselect it
    const planParam = searchParams.get("plan");
    if (planParam) {
      const planObj = getPlanById(planParam);
      if (planObj && planObj.id) setSelectedPlan(planObj.id);
    }
  }, [schoolId]);

  const handleSubscribe = async () => {
    if (!userData) {
      setError("User data not available");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const user = auth.currentUser;

      // Get fresh user data to ensure we have latest info
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const freshUserData = userSnap.exists() ? userSnap.data() : userData;

      // Prepare subscription payload
      const payload = {
        userId: user.uid,
        name: freshUserData.name || user.displayName || "User",
        email: freshUserData.email || user.email || "",
        phone: freshUserData.phone || user.phoneNumber || "",
        planId: selectedPlan,
        schoolId: schoolId || "default",
      };

      // Call Cloud Function to create subscription
      const response = await fetch(API_ENDPOINTS.CREATE_SUBSCRIPTION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create subscription");
      }

      const data = await response.json();

      if (!data.success || !data.shortUrl) {
        throw new Error("No checkout URL received");
      }

      // Save pending subscription to Firebase
      await setDoc(
        doc(db, "subscriptions", data.subscriptionId),
        {
          userId: user.uid,
          planId: selectedPlan,
          status: "created",
          subscriptionActive: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Redirect to Razorpay checkout
      window.location.href = data.shortUrl;
    } catch (err) {
      console.error("Subscription creation error:", err);
      setError(err.message || "Failed to process subscription");
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="subscription-checkout">
        <div className="checkout-loader">
          <div className="loader-circle"></div>
          <p>Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="subscription-checkout">
        <div className="error-card">
          <h2>Unable to Load Subscription</h2>
          <p>{error}</p>
          <button onClick={() => navigate("/login")} className="btn-primary">
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="subscription-checkout">
      <div className="checkout-container">
        {/* Header */}
        <div className="checkout-header">
          <h1>🎓 Choose Your Learning Path</h1>
          <p>Unlimited access to all MINT classes and content</p>
        </div>

        {/* User Info */}
        {userData && (
          <div className="checkout-user-info">
            <div className="user-badge">👤</div>
            <div className="user-details">
              <p className="user-name">{userData.name || "Student"}</p>
              <p className="user-email">{userData.email || "email@example.com"}</p>
              {userData.phone && <p className="user-phone">📱 {userData.phone}</p>}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && <div className="error-message">{error}</div>}

        {/* Plans Grid */}
        <div className="plans-grid">
          {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
            const isSelected = selectedPlan === plan.id;
            const planPrice = pricing[plan.id];

            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {/* Popular Badge */}
                {plan.id === "yearly" && (
                  <div className="popular-badge">Best Value</div>
                )}

                {/* Plan Header */}
                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <p className="plan-duration">{plan.badge}</p>
                </div>

                {/* Price */}
                <div className="plan-price">
                  <span className="currency">₹</span>
                  <span className="amount">{planPrice}</span>
                  <span className="period">for {plan.durationInMonths} months</span>
                </div>

                {/* Features */}
                <div className="plan-features">
                  {SUBSCRIPTION_FEATURES.map((feature, idx) => (
                    <p key={idx} className="feature-item">
                      {feature}
                    </p>
                  ))}
                </div>

                {/* Select Button */}
                <button
                  type="button"
                  className={`plan-select-btn ${isSelected ? "selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan.id);
                  }}
                  disabled={isProcessing}
                >
                  {isSelected ? "✓ Selected" : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>

        {/* Monthly Breakdown */}
        <div className="checkout-comparison">
          <h3>Monthly Breakdown</h3>
          <div className="comparison-grid">
            {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
              const planPrice = pricing[plan.id];
              const monthlyPrice = (planPrice / plan.durationInMonths).toFixed(0);
              return (
                <div key={plan.id} className="comparison-item">
                  <p className="comp-plan">{plan.name}</p>
                  <p className="comp-total">₹{planPrice}</p>
                  <p className="comp-monthly">
                    ₹{monthlyPrice}/month
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="checkout-actions">
          <button
            className="btn-secondary"
            onClick={() => navigate("/pricing")}
            disabled={isProcessing}
          >
            View Pricing Details
          </button>
          <button
            className="btn-primary btn-large"
            onClick={handleSubscribe}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="spinner"></span>
                Processing...
              </>
            ) : (
              `Subscribe to ${SUBSCRIPTION_PLANS[selectedPlan].name}`
            )}
          </button>
        </div>

        {/* Security Note */}
        <div className="security-note">
          <p>🔒 Secure payment powered by Razorpay</p>
          <p>Auto-renewal enabled • Cancel anytime</p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCheckout;
