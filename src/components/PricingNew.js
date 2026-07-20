import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase/firebaseConfig";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_FEATURES,
  DEFAULT_PRICING,
  getPlanBillingText,
  getSubscriptionPricingFromSettings,
  getVisibleSubscriptionPlans,
  isSubscriptionActive,
  getDaysRemaining,
} from "../config/subscriptionConfig";
import "./Pricing.css";
import SeoHelmet from "./SeoHelmet";
import {
  absoluteUrl,
  buildOrganizationSchema,
  buildPricingProductSchema,
  buildWebsiteSchema,
} from "../utils/schema";

export default function Pricing() {
  const navigate = useNavigate();
  const [isProcessing] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [pricing, setPricing] = useState(DEFAULT_PRICING);
  const [loading, setLoading] = useState(true);
  const [popularPlan, setPopularPlan] = useState("yearly");
  const [planSettings, setPlanSettings] = useState({});
  const [discountBanner, setDiscountBanner] = useState("");

  useEffect(() => {
    let isMounted = true;

    const applySettings = (settings = {}) => {
      if (!isMounted) return;
      setPlanSettings(settings);
      setPricing(getSubscriptionPricingFromSettings(settings));
      setPopularPlan(settings.popularPlan || "yearly");
      setDiscountBanner(settings.discountBanner || "");
    };

    const loadSettings = async (schoolId = "default") => {
      const settingsRef = doc(db, "subscriptionSettings", schoolId);
      const settingsSnap = await getDoc(settingsRef);
      return settingsSnap.exists() ? settingsSnap.data() : null;
    };

    const loadPricingPage = async (user) => {
      try {
        const defaultSettings = await loadSettings("default");
        applySettings(defaultSettings || {});

        if (!user) {
          if (isMounted) {
            setSubscription(null);
            setLoading(false);
          }
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const fetchedUserData = userSnap.exists() ? userSnap.data() : {};

        if (
          fetchedUserData.schoolId &&
          fetchedUserData.schoolId !== "default"
        ) {
          const schoolSettings = await loadSettings(fetchedUserData.schoolId);
          if (schoolSettings) {
            applySettings(schoolSettings);
          }
        }

        if (fetchedUserData.razorpaySubscriptionId) {
          const subRef = doc(
            db,
            "subscriptions",
            fetchedUserData.razorpaySubscriptionId
          );
          const subSnap = await getDoc(subRef);
          if (isMounted) {
            setSubscription(subSnap.exists() ? subSnap.data() : null);
          }
        } else if (isMounted) {
          setSubscription(null);
        }
      } catch (err) {
        console.error("Error fetching pricing data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      loadPricingPage(user);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSubscribe = (planId) => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }

    if (planId) {
      navigate(`/subscribe?plan=${encodeURIComponent(planId)}`);
      return;
    }

    navigate("/subscribe");
  };

  const isActive = isSubscriptionActive(subscription);
  const daysRemaining = subscription ? getDaysRemaining(subscription.expiryDate) : 0;
  const visiblePlans = getVisibleSubscriptionPlans(planSettings);
  const comparisonPlans = visiblePlans.filter((plan) => !plan.isTestPlan);
  const heroHighlights = [
    "All classes 6-10 in one subscription",
    "Live quiz practice and challenge rounds",
    "Cancel anytime from your dashboard",
  ];
  const pageTitle = "Hepsy Pricing | Quarterly, Mid-Season, and Championship Passes";
  const pageDescription =
    "Compare Hepsy subscription passes with INR pricing for Quarterly, Mid-Season, and Championship access across classes 6 to 10.";
  const pricingSchemas = comparisonPlans.map((plan) =>
    buildPricingProductSchema({
      plan: {
        ...plan,
        name:
          plan.id === SUBSCRIPTION_PLANS.QUARTERLY.id
            ? "Quarterly Pass"
            : plan.id === SUBSCRIPTION_PLANS.HALF_YEARLY.id
            ? "Mid-Season Pass"
            : plan.id === SUBSCRIPTION_PLANS.YEARLY.id
            ? "Championship Pass"
            : plan.name,
      },
      price: pricing[plan.id],
      features: SUBSCRIPTION_FEATURES,
    })
  );

  if (loading) {
    return (
      <div className="pricing-page-loader">
        <div className="loader-circle"></div>
        <p>Loading pricing options...</p>
      </div>
    );
  }

  return (
    <>
      <SeoHelmet
        title={pageTitle}
        description={pageDescription}
        keywords={[
          "Hepsy pricing",
          "Quarterly pass",
          "Mid-Season pass",
          "Championship pass",
          "INR subscription pricing",
        ]}
        canonicalUrl={absoluteUrl("/pricing")}
        image={absoluteUrl("/images/logo.webp")}
        schemas={[buildOrganizationSchema(), buildWebsiteSchema(), ...pricingSchemas]}
      />
      <div className="pricing-page">
        <div className="pricing-orb pricing-orb-one"></div>
        <div className="pricing-orb pricing-orb-two"></div>
        <header className="pricing-header">
        <div className="pricing-header-content">
          <span className="pricing-kicker">Subscription Plans</span>
          <h1>MINT Foundation Platform</h1>
          <p>Choose your learning journey with unlimited access to all classes.</p>
          <div className="hero-highlights">
            {heroHighlights.map((item) => (
              <span key={item} className="hero-pill">
                {item}
              </span>
            ))}
          </div>
          {discountBanner && <div className="subscription-badge">{discountBanner}</div>}
          {isActive && subscription && (
            <div className="subscription-badge">
              <span className="badge-icon">Active</span> {daysRemaining} days remaining
            </div>
          )}
        </div>
        </header>

        <main className="pricing-container">
        {isActive && subscription && (
          <section
            className="current-subscription"
            aria-labelledby="current-sub-heading"
          >
            <h2 id="current-sub-heading">Your Current Plan</h2>
            <div className="subscription-details">
              <div className="detail-item">
                <span className="label">Plan:</span>
                <span className="value">
                  {SUBSCRIPTION_PLANS[subscription.planId]?.name ||
                    subscription.planType}
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
                  {subscription.autoRenewal ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
            <button
              className="btn-manage"
              onClick={() => navigate("/subscription-status")}
            >
              Manage Subscription
            </button>
          </section>
        )}

        <section className="pricing-plans" aria-labelledby="plans-heading">
          <div className="section-heading">
            <h2 id="plans-heading" className="section-title">
              Choose Your Plan
            </h2>
            <p className="section-copy">
              Pick the access window that fits your pace. Every plan unlocks the full learning platform.
            </p>
          </div>
          <div className="plans-grid">
            {visiblePlans.map((plan) => {
              const planPrice = pricing[plan.id];
              const isPopular = popularPlan === plan.id;
              const isPlanActive = subscription?.planId === plan.id && isActive;

              return (
                <div
                  key={plan.id}
                  className={`pricing-card ${isPopular ? "popular" : ""} ${
                    isPlanActive ? "active" : ""
                  }`}
                >
                  {isPopular && <div className="popular-ribbon">Best Value</div>}
                  {isPlanActive && <div className="active-ribbon">Your Plan</div>}

                  <div className="card-content">
                    <div className="plan-topline">
                      <h3 className="plan-name">{plan.name}</h3>
                      <p className="plan-duration">{plan.badge}</p>
                    </div>
                    <p className="plan-description">{plan.description}</p>

                    <div className="plan-price-box">
                      <div className="price-primary">
                        <span className="currency">Rs</span>
                        <span className="amount">{planPrice}</span>
                      </div>
                      <span className="frequency">
                        {getPlanBillingText(plan.id, planPrice)}
                      </span>
                    </div>

                    <ul className="plan-features">
                      {SUBSCRIPTION_FEATURES.map((feature, idx) => (
                        <li key={idx} className="feature">
                          <span className="feature-check">✓</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    className={`subscribe-btn ${isPlanActive ? "current" : ""}`}
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isPlanActive || isProcessing}
                  >
                    {isPlanActive
                      ? "Your Current Plan"
                      : isProcessing
                      ? "Processing..."
                      : "Subscribe Now"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {comparisonPlans.length > 0 && (
          <section
            className="pricing-comparison"
            aria-labelledby="comparison-heading"
          >
            <div className="section-heading">
              <h2 id="comparison-heading">Plan Comparison</h2>
              <p className="section-copy">
                A quick side-by-side view of pricing and access across the main plans.
              </p>
            </div>
            <div className="table-responsive">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    {comparisonPlans.map((plan) => (
                      <th key={plan.id}>{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="feature-name">Duration</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id}>{plan.badge}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Total Price</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="price">
                        Rs {pricing[plan.id]}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Billing</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id}>{getPlanBillingText(plan.id, pricing[plan.id])}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Access to All Classes</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="check-cell">
                        Yes
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Unlimited Quizzes</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="check-cell">
                        Yes
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Leaderboard Access</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="check-cell">
                        Yes
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Auto-Renewal</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="check-cell">
                        Yes
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="feature-name">Cancel Anytime</td>
                    {comparisonPlans.map((plan) => (
                      <td key={plan.id} className="check-cell">
                        Yes
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="faq-section" aria-labelledby="faq-heading">
          <div className="section-heading">
            <h2 id="faq-heading">Frequently Asked Questions</h2>
            <p className="section-copy">
              Clear answers before you start, so checkout feels simple and predictable.
            </p>
          </div>
          <div className="faq-grid">
            <div className="faq-item">
              <h4>Can I switch plans?</h4>
              <p>Yes, plan changes can be made any time and continue smoothly on renewal.</p>
            </div>
            <div className="faq-item">
              <h4>Can I cancel my subscription?</h4>
              <p>Yes, auto-renewal can be cancelled from your dashboard at any time.</p>
            </div>
            <div className="faq-item">
              <h4>Do I get access to all classes?</h4>
              <p>Any active plan unlocks Classes 6 through 10.</p>
            </div>
            <div className="faq-item">
              <h4>What happens after expiry?</h4>
              <p>If auto-renewal stays enabled, Razorpay renews the subscription automatically.</p>
            </div>
          </div>
        </section>

        {!isActive && (
          <div className="cta-section">
            <h2>Ready to begin?</h2>
            <p>Start with the plan that matches your study cycle and upgrade later if needed.</p>
            <button className="cta-button" onClick={() => handleSubscribe()}>
              Choose Your Plan Now
            </button>
          </div>
        )}

        <footer className="security-footer">
          <p className="security-lock">Secure payments powered by Razorpay</p>
          <p className="security-subtext">
            Automatic lifecycle updates and full platform coverage
          </p>
        </footer>
        </main>
      </div>
    </>
  );
}
