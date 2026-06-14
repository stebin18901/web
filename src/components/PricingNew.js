import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_FEATURES,
  DEFAULT_PRICING,
  isSubscriptionActive,
  getDaysRemaining,
  formatPrice,
} from "../config/subscriptionConfig";
import "./Pricing.css";

export default function Pricing() {
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [userData, setUserData] = useState(null);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [popularPlan, setPopularPlan] = useState("yearly");

  // Fetch user subscription and pricing
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }

        // Get user data
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        setUserData(userData);

        // Get subscription if exists
        if (userData.razorpaySubscriptionId) {
          const subRef = doc(db, "subscriptions", userData.razorpaySubscriptionId);
          const subSnap = await getDoc(subRef);
          if (subSnap.exists()) {
            setSubscription(subSnap.data());
          }
        }

        // Get pricing
        const settingsRef = doc(
          db,
          "subscriptionSettings",
          userData.schoolId || "default"
        );
        const settingsSnap = await getDoc(settingsRef);
        if (settingsSnap.exists()) {
          const settings = settingsSnap.data();
          setPricing({
            quarterly: settings.quarterlyPrice || DEFAULT_PRICING.quarterly,
            half_yearly: settings.halfYearlyPrice || DEFAULT_PRICING.half_yearly,
            yearly: settings.yearlyPrice || DEFAULT_PRICING.yearly,
          });
          setPopularPlan(settings.popularPlan || "yearly");
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching pricing data:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSubscribe = (planId) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }
    // Debug log
    // eslint-disable-next-line no-console
    console.debug("PricingNew: handleSubscribe", { planId, userId: user.uid });
    // Navigate to checkout and pass selected plan as query param
    if (planId) {
      navigate(`/subscribe?plan=${encodeURIComponent(planId)}`);
    } else {
      navigate("/subscribe");
    }
  };

  const isActive = isSubscriptionActive(subscription);
  const daysRemaining = subscription ? getDaysRemaining(subscription.expiryDate) : 0;

  if (loading) {
    return (
      <div className="pricing-page">
        <div className="pricing-loader">
          <div className="loader-circle"></div>
          <p>Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pricing-page">
      {/* Header */}
      <div className="pricing-header">
        <div className="pricing-header-content">
          <h1>🎓 MINT Foundation Platform</h1>
          <p>Choose your learning journey - Unlimited access to all classes</p>
          {isActive && subscription && (
            <div className="subscription-badge">
              ✅ Active Subscription • {daysRemaining} days remaining
            </div>
          )}
        </div>
      </div>

      <div className="pricing-container">
        {/* Current Subscription */}
        {isActive && subscription && (
          <div className="current-subscription">
            <h2>💳 Your Current Plan</h2>
            <div className="subscription-details">
              <div className="detail-item">
                <span className="label">Plan:</span>
                <span className="value">
                  {SUBSCRIPTION_PLANS[subscription.planId]?.name || subscription.planType}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Started:</span>
                <span className="value">
                  {new Date(subscription.startDate).toLocaleDateString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Expires:</span>
                <span className="value">
                  {new Date(subscription.expiryDate).toLocaleDateString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">Auto-Renewal:</span>
                <span className="value">
                  {subscription.autoRenewal ? "✅ Enabled" : "❌ Disabled"}
                </span>
              </div>
            </div>
            <button className="btn-manage" onClick={() => navigate("/subscription-status")}>
              Manage Subscription
            </button>
          </div>
        )}

        {/* Plans Grid */}
        <div className="pricing-plans">
          <h2>📋 Choose Your Plan</h2>
          <div className="plans-grid">
            {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
              const planPrice = pricing[plan.id];
              const isPopular = popularPlan === plan.id;
              const isPlanActive = subscription?.planId === plan.id && isActive;

              // eslint-disable-next-line no-console
              console.debug("PricingNew: rendering plan", { planId: plan.id, isPopular, isPlanActive });
              return (
                <div
                  key={plan.id}
                  className={`pricing-card ${isPopular ? "popular" : ""} ${
                    isPlanActive ? "active" : ""
                  }`}
                >
                  {/* Popular Badge */}
                  {isPopular && (
                    <div className="popular-ribbon">Best Value</div>
                  )}

                  {/* Active Badge */}
                  {isPlanActive && (
                    <div className="active-ribbon">Your Plan</div>
                  )}

                  {/* Plan Content */}
                  <div className="card-content">
                    <h3 className="plan-name">{plan.name}</h3>
                    <p className="plan-duration">{plan.badge}</p>

                    {/* Price */}
                    <div className="plan-price-box">
                      <span className="currency">₹</span>
                      <span className="amount">{planPrice}</span>
                      <span className="frequency">
                        ₹{Math.round(planPrice / plan.durationInMonths)}/month
                      </span>
                    </div>

                    {/* Features */}
                    <div className="plan-features">
                      {SUBSCRIPTION_FEATURES.map((feature, idx) => (
                        <p key={idx} className="feature">{feature}</p>
                      ))}
                    </div>
                  </div>

                  {/* Button */}
                  <button
                    className={`subscribe-btn ${isPlanActive ? "current" : ""}`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isPlanActive || isProcessing}
                  >
                    {isPlanActive
                      ? "✓ Your Current Plan"
                      : isProcessing
                      ? "Processing..."
                      : "Subscribe Now"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison Table */}
        <div className="pricing-comparison">
          <h2>💰 Plan Comparison</h2>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>{SUBSCRIPTION_PLANS.QUARTERLY.name}</th>
                <th>{SUBSCRIPTION_PLANS.HALF_YEARLY.name}</th>
                <th>{SUBSCRIPTION_PLANS.YEARLY.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="feature-name">Duration</td>
                <td>{SUBSCRIPTION_PLANS.QUARTERLY.badge}</td>
                <td>{SUBSCRIPTION_PLANS.HALF_YEARLY.badge}</td>
                <td>{SUBSCRIPTION_PLANS.YEARLY.badge}</td>
              </tr>
              <tr>
                <td className="feature-name">Total Price</td>
                <td className="price">₹{pricing.quarterly}</td>
                <td className="price">₹{pricing.half_yearly}</td>
                <td className="price">₹{pricing.yearly}</td>
              </tr>
              <tr>
                <td className="feature-name">Per Month</td>
                <td>₹{Math.round(pricing.quarterly / 3)}</td>
                <td>₹{Math.round(pricing.half_yearly / 6)}</td>
                <td>₹{Math.round(pricing.yearly / 12)}</td>
              </tr>
              <tr>
                <td className="feature-name">Access to All Classes</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
              <tr>
                <td className="feature-name">Unlimited Quizzes</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
              <tr>
                <td className="feature-name">Leaderboard Access</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
              <tr>
                <td className="feature-name">Auto-Renewal</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
              <tr>
                <td className="feature-name">Cancel Anytime</td>
                <td>✅</td>
                <td>✅</td>
                <td>✅</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FAQ Section */}
        <div className="faq-section">
          <h2>❓ Frequently Asked Questions</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>Can I switch plans?</h4>
              <p>Yes! You can change your plan anytime. Changes take effect on your next renewal.</p>
            </div>
            <div className="faq-item">
              <h4>Can I cancel my subscription?</h4>
              <p>Absolutely! Cancel auto-renewal anytime without contacting support.</p>
            </div>
            <div className="faq-item">
              <h4>Do I get access to all classes?</h4>
              <p>Yes! Any subscription plan gives you access to Classes 6, 7, 8, 9, and 10.</p>
            </div>
            <div className="faq-item">
              <h4>What happens after expiry?</h4>
              <p>Your subscription will auto-renew on the expiry date if renewal is enabled.</p>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        {!isActive && (
          <div className="cta-section">
            <h2>Ready to get started?</h2>
            <button className="cta-button" onClick={handleSubscribe}>
              Choose Your Plan →
            </button>
          </div>
        )}

        {/* Security Note */}
        <div className="security-footer">
          <p>🔒 Secure payment powered by Razorpay</p>
          <p>Auto-renewal • Cancel anytime • Full access to MINT platform</p>
        </div>
      </div>
    </div>
  );
}
