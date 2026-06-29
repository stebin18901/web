import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import {
  SUBSCRIPTION_FEATURES,
  DEFAULT_PRICING,
  API_ENDPOINTS,
  getPlanById,
  getPlanBillingText,
  getSubscriptionPricingFromSettings,
  getVisibleSubscriptionPlans,
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
  const [planSettings, setPlanSettings] = useState({});

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Please log in first");
          setLoading(false);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        let nextSchoolId = "default";

        if (userSnap.exists()) {
          const fetchedUserData = userSnap.data();
          setUserData(fetchedUserData);
          if (fetchedUserData.schoolId) {
            nextSchoolId = fetchedUserData.schoolId;
            setSchoolId(fetchedUserData.schoolId);
          }
        } else {
          setUserData({
            uid: user.uid,
            name: user.displayName || "User",
            email: user.email || "",
            phone: user.phoneNumber || "",
          });
        }

        const settingsRef = doc(db, "subscriptionSettings", nextSchoolId);
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          setPlanSettings(settings);
          setPricing(getSubscriptionPricingFromSettings(settings));
        }

        const planParam = searchParams.get("plan");
        const visiblePlans = getVisibleSubscriptionPlans(
          settingsSnap.exists() ? settingsSnap.data() : {}
        );
        const defaultPlanId = visiblePlans[0]?.id || "yearly";

        if (planParam) {
          const planObj = getPlanById(planParam);
          const isVisible = visiblePlans.some((plan) => plan.id === planObj.id);
          setSelectedPlan(isVisible ? planObj.id : defaultPlanId);
        } else {
          setSelectedPlan(defaultPlanId);
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to load user information");
        setLoading(false);
      }
    };

    fetchUserData();
  }, [searchParams]);

  const visiblePlans = getVisibleSubscriptionPlans(planSettings);

  const handleSubscribe = async () => {
    if (!userData) {
      setError("User data not available");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Please log in again to continue");
      }
      const idToken = await user.getIdToken();

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      const freshUserData = userSnap.exists() ? userSnap.data() : userData;

      const payload = {
        name: freshUserData.name || user.displayName || "User",
        email: freshUserData.email || user.email || "",
        phone: freshUserData.phone || user.phoneNumber || "",
        planId: selectedPlan,
        schoolId: schoolId || "default",
      };

      const response = await fetch(API_ENDPOINTS.CREATE_SUBSCRIPTION, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
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

  const selectedPlanMeta = getPlanById(selectedPlan);

  return (
    <div className="subscription-checkout">
      <div className="checkout-container">
        <div className="checkout-header">
          <h1>Choose Your Learning Path</h1>
          <p>Unlimited access to all MINT classes and content</p>
        </div>

        {userData && (
          <div className="checkout-user-info">
            <div className="user-badge">User</div>
            <div className="user-details">
              <p className="user-name">{userData.name || "Student"}</p>
              <p className="user-email">{userData.email || "email@example.com"}</p>
              {userData.phone && <p className="user-phone">Phone: {userData.phone}</p>}
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="plans-grid">
          {visiblePlans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const planPrice = pricing[plan.id];

            return (
              <div
                key={plan.id}
                className={`plan-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.id === "yearly" && <div className="popular-badge">Best Value</div>}

                <div className="plan-header">
                  <h3>{plan.name}</h3>
                  <p className="plan-duration">{plan.badge}</p>
                </div>

                <div className="plan-price">
                  <span className="currency">Rs</span>
                  <span className="amount">{planPrice}</span>
                  <span className="period">{getPlanBillingText(plan.id, planPrice)}</span>
                </div>

                <div className="plan-features">
                  {SUBSCRIPTION_FEATURES.map((feature, idx) => (
                    <p key={idx} className="feature-item">
                      {feature}
                    </p>
                  ))}
                </div>

                <button
                  type="button"
                  className={`plan-select-btn ${isSelected ? "selected" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan.id);
                  }}
                  disabled={isProcessing}
                >
                  {isSelected ? "Selected" : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="checkout-comparison">
          <h3>Billing Breakdown</h3>
          <div className="comparison-grid">
            {visiblePlans.map((plan) => {
              const planPrice = pricing[plan.id];
              return (
                <div key={plan.id} className="comparison-item">
                  <p className="comp-plan">{plan.name}</p>
                  <p className="comp-total">Rs {planPrice}</p>
                  <p className="comp-monthly">{getPlanBillingText(plan.id, planPrice)}</p>
                </div>
              );
            })}
          </div>
        </div>

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
            {isProcessing ? "Processing..." : `Subscribe to ${selectedPlanMeta.name}`}
          </button>
        </div>

        <div className="security-note">
          <p>Secure payment powered by Razorpay</p>
          <p>Auto-renewal enabled and cancel any time</p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionCheckout;
