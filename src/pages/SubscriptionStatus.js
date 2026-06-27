import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase/firebaseConfig";
import {
  SUBSCRIPTION_PLANS,
  getSubscriptionStatusMessage,
  getDaysRemaining,
  isSubscriptionActive,
} from "../config/subscriptionConfig";
import "./SubscriptionStatus.css";

const SubscriptionStatus = () => {
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch subscription data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate("/login");
          return;
        }

        // Get user data
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};
        setUserData(userData);

        // Get subscription
        if (userData.razorpaySubscriptionId) {
          const subRef = doc(db, "subscriptions", userData.razorpaySubscriptionId);
          const subSnap = await getDoc(subRef);
          if (subSnap.exists()) {
            setSubscription(subSnap.data());
          }
        }

        setLoading(false);
      } catch (err) {
        console.error("Error fetching subscription:", err);
        setError("Failed to load subscription details");
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleCancelSubscription = async () => {
    if (!subscription) return;

    if (
      !window.confirm(
        "Are you sure you want to cancel your subscription? You'll lose access after the current billing period ends."
      )
    ) {
      return;
    }

    setCancelling(true);
    setError("");
    setSuccess("");

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Please log in again to manage your subscription.");
      }
      const idToken = await user.getIdToken();
      const response = await fetch(
        "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/cancelSubscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            subscriptionId: subscription.razorpaySubscriptionId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel subscription");
      }

      const data = await response.json();
      const cancelSuccessMessage =
        data.message ||
        "Subscription cancellation scheduled for the end of your current billing period.";

      setSuccess("✅ Subscription cancelled. You'll maintain access until renewal date.");
      
      setSuccess(cancelSuccessMessage);

      // Update local state
      setSubscription({
        ...subscription,
        autoRenewal: false,
        cancellationScheduled: !!data.cancellationScheduled,
        cancellationEffectiveAt:
          data.cancellationEffectiveAt || subscription.expiryDate,
        subscriptionActive: data.cancellationScheduled
          ? true
          : subscription.subscriptionActive,
        status: data.status || subscription.status,
        razorpayStatus: data.razorpayStatus || subscription.razorpayStatus,
        expiryDate: data.cancellationEffectiveAt || subscription.expiryDate,
      });

      setCancelling(false);
    } catch (err) {
      console.error("Error cancelling subscription:", err);
      setError(err.message || "Failed to cancel subscription");
      setCancelling(false);
    }
  };

  const handleResumeSubscription = async () => {
    if (!subscription) return;

    if (
      !window.confirm(
        "Resume auto-renewal? Your subscription will continue after the current period ends."
      )
    ) {
      return;
    }

    setResuming(true);
    setError("");
    setSuccess("");

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error("Please log in again to manage your subscription.");
      }
      const idToken = await user.getIdToken();

      const response = await fetch(
        "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/resumeSubscription",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            subscriptionId: subscription.razorpaySubscriptionId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to resume subscription");
      }

      const data = await response.json();

      setSuccess("✅ Subscription resumed successfully!");
      
      setSubscription({
        ...subscription,
        autoRenewal: true,
        status: data.subscription?.status || "active",
        razorpayStatus: data.subscription?.status || "active",
        subscriptionActive: data.subscription?.status === "active",
        ...(data.subscription?.currentStart
          ? { startDate: data.subscription.currentStart }
          : {}),
        ...(data.subscription?.currentEnd
          ? { expiryDate: data.subscription.currentEnd }
          : {}),
      });

      setResuming(false);
    } catch (err) {
      console.error("Error resuming subscription:", err);
      setError(err.message || "Failed to resume subscription");
      setResuming(false);
    }
  };

  if (loading) {
    return (
      <div className="subscription-status-page">
        <div className="status-loader">
          <div className="loader-circle"></div>
          <p>Loading your subscription...</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="subscription-status-page">
        <div className="no-subscription">
          <h2>No Active Subscription</h2>
          <p>You don't have an active subscription yet.</p>
          <button className="btn-subscribe" onClick={() => navigate("/subscribe")}>
            Get Started
          </button>
        </div>
      </div>
    );
  }

  const statusInfo = getSubscriptionStatusMessage(subscription);
  const daysRemaining = getDaysRemaining(subscription.expiryDate);
  const isActive = isSubscriptionActive(subscription);

  return (
    <div className="subscription-status-page">
      <div className="status-container">
        <div className="status-header">
          <h1>💳 Subscription Details</h1>
          <p>Manage your MINT Platform subscription</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Status Card */}
        <div className={`status-card ${statusInfo.status}`}>
          <div className="status-icon">{statusInfo.icon}</div>
          <div className="status-info">
            <h2>{statusInfo.message}</h2>
            {statusInfo.daysLeft && (
              <p>{statusInfo.daysLeft} days remaining in your current plan</p>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="details-grid">
          {/* Plan Details */}
          <div className="detail-card">
            <h3>📋 Plan Details</h3>
            <div className="detail-row">
              <span className="label">Plan Type:</span>
              <span className="value">
                {SUBSCRIPTION_PLANS[subscription.planId]?.name || subscription.planType}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Duration:</span>
              <span className="value">
                {SUBSCRIPTION_PLANS[subscription.planId]?.badge}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Amount:</span>
              <span className="value">₹{subscription.amount}</span>
            </div>
            <div className="detail-row">
              <span className="label">Auto-Renewal:</span>
              <span className={`value ${subscription.autoRenewal ? "active" : "inactive"}`}>
                {subscription.autoRenewal ? "✅ Enabled" : "❌ Disabled"}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="detail-card">
            <h3>📅 Timeline</h3>
            <div className="detail-row">
              <span className="label">Started:</span>
              <span className="value">
                {new Date(subscription.startDate).toLocaleDateString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Expires:</span>
              <span className="value">
                {new Date(subscription.expiryDate).toLocaleDateString()}
              </span>
            </div>
            <div className="detail-row">
              <span className="label">Days Left:</span>
              <span className={`value ${daysRemaining > 30 ? "" : "warning"}`}>
                {daysRemaining} days
              </span>
            </div>
            {subscription.lastPaymentDate && (
              <div className="detail-row">
                <span className="label">Last Payment:</span>
                <span className="value">
                  {new Date(subscription.lastPaymentDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          {/* Features */}
          <div className="detail-card features-card">
            <h3>✨ Your Benefits</h3>
            <ul className="benefits-list">
              <li>✅ Access to Classes 6-10</li>
              <li>✅ Unlimited Quiz Access</li>
              <li>✅ Leaderboard & Competition</li>
              <li>✅ Progress Tracking</li>
              <li>✅ Study Materials</li>
              <li>✅ Weekly Challenges</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="actions-section">
          <h3>Manage Subscription</h3>
          <div className="action-buttons">
            <button
              className="btn-primary"
              onClick={() => navigate("/pricing")}
              disabled={cancelling || resuming}
            >
              View Other Plans
            </button>

            {isActive && subscription.autoRenewal && (
              <button
                className="btn-danger"
                onClick={handleCancelSubscription}
                disabled={cancelling || resuming}
              >
                {cancelling ? "Cancelling..." : "Cancel Auto-Renewal"}
              </button>
            )}

            {isActive && !subscription.autoRenewal && (
              <button
                className="btn-secondary"
                onClick={handleResumeSubscription}
                disabled={cancelling || resuming}
              >
                {resuming ? "Resuming..." : "Resume Auto-Renewal"}
              </button>
            )}

            {!isActive && (
              <button
                className="btn-primary"
                onClick={() => navigate("/pricing")}
              >
                Renew Now
              </button>
            )}
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <h3>❓ Frequently Asked Questions</h3>
          <div className="faq-items">
            <div className="faq-item">
              <h4>Can I upgrade my plan?</h4>
              <p>Yes! You can upgrade anytime. Changes take effect on the next billing cycle.</p>
            </div>
            <div className="faq-item">
              <h4>What happens if I cancel?</h4>
              <p>Your access continues until the end of your current billing period. After that, you'll need to subscribe again.</p>
            </div>
            <div className="faq-item">
              <h4>Can I get a refund?</h4>
              <p>Refunds are processed based on our policy. Contact support for specific cases.</p>
            </div>
            <div className="faq-item">
              <h4>How do I contact support?</h4>
              <p>Email us at support@mintplatform.com or use the in-app chat support.</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="nav-buttons">
          <button
            className="btn-secondary"
            onClick={() => navigate("/dashboard")}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionStatus;
