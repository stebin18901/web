/**
 * Subscription Configuration for MINT Platform
 * Contains all subscription plans, constants, and API endpoints
 */

// ==================== SUBSCRIPTION PLANS ====================
export const SUBSCRIPTION_PLANS = {
  QUARTERLY: {
    id: "quarterly",
    name: "Quarterly",
    duration: 3,
    durationInMonths: 3,
    durationInDays: 90,
    badge: "3 Months",
    description: "3-month full platform access",
  },
  HALF_YEARLY: {
    id: "half_yearly",
    name: "Half-Yearly",
    duration: 6,
    durationInMonths: 6,
    durationInDays: 180,
    badge: "6 Months",
    description: "6-month full platform access",
  },
  YEARLY: {
    id: "yearly",
    name: "Yearly",
    duration: 12,
    durationInMonths: 12,
    durationInDays: 365,
    badge: "12 Months",
    description: "12-month full platform access",
  },
};

// Plan IDs array for iteration
export const PLAN_IDS = ["quarterly", "half_yearly", "yearly"];

// ==================== FEATURES INCLUDED ====================
export const SUBSCRIPTION_FEATURES = [
  "✔ Unlimited Quiz Access",
  "✔ All Classes Access (6-10)",
  "✔ Weekly Challenges",
  "✔ Leaderboards",
  "✔ Progress Tracking",
  "✔ Notes & Study Materials",
  "✔ New Content Updates",
];

// ==================== DEFAULT PRICING ====================
export const DEFAULT_PRICING = {
  quarterly: 499,
  half_yearly: 899,
  yearly: 1499,
};

// ==================== FIREBASE COLLECTIONS ====================
export const FIREBASE_COLLECTIONS = {
  USERS: "users",
  SUBSCRIPTIONS: "subscriptions",
  SUBSCRIPTION_SETTINGS: "subscriptionSettings",
  PAYMENT_WEBHOOKS: "paymentWebhooks",
  SUBSCRIPTION_HISTORY: "subscriptionHistory",
};

// ==================== API ENDPOINTS ====================
export const API_ENDPOINTS = {
  CREATE_SUBSCRIPTION: "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/createRazorpaySubscription",
  VERIFY_SUBSCRIPTION: "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/verifySubscriptionWebhook",
  CANCEL_SUBSCRIPTION: "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/cancelSubscription",
  FETCH_SUBSCRIPTION: "https://us-central1-dreamprojects-cda5b.cloudfunctions.net/fetchSubscription",
};

// ==================== SUBSCRIPTION STATUSES ====================
export const SUBSCRIPTION_STATUS = {
  CREATED: "created",
  AUTHENTICATED: "authenticated",
  ACTIVE: "active",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  PENDING: "pending",
};

// ==================== ALL ACCESSIBLE CLASSES ====================
export const ALL_CLASSES = ["6", "7", "8", "9", "10"];

// ==================== HELPER FUNCTIONS ====================

/**
 * Get plan by ID
 */
export const getPlanById = (planId) => {
  const plan = Object.values(SUBSCRIPTION_PLANS).find((p) => p.id === planId);
  return plan || SUBSCRIPTION_PLANS.YEARLY;
};

/**
 * Format duration for display
 */
export const formatDuration = (planId) => {
  const plan = getPlanById(planId);
  return plan ? plan.badge : "12 Months";
};

/**
 * Calculate expiry date from start date
 */
export const calculateExpiryDate = (startDate, planId) => {
  const plan = getPlanById(planId);
  if (!plan) return new Date();
  const date = new Date(startDate);
  date.setMonth(date.getMonth() + plan.durationInMonths);
  return date;
};

/**
 * Check if subscription is active
 */
export const isSubscriptionActive = (subscription) => {
  if (!subscription) return false;
  if (subscription.subscriptionActive === false) return false;
  
  const expiryDate = new Date(subscription.expiryDate);
  return expiryDate > new Date();
};

/**
 * Get days remaining
 */
export const getDaysRemaining = (expiryDate) => {
  const expiry = new Date(expiryDate);
  const today = new Date();
  const timeDiff = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return Math.max(0, daysRemaining);
};

/**
 * Get subscription status message
 */
export const getSubscriptionStatusMessage = (subscription) => {
  if (!subscription) {
    return {
      status: "inactive",
      message: "No active subscription",
      icon: "🔓",
    };
  }

  if (!subscription.subscriptionActive) {
    return {
      status: "expired",
      message: "Subscription Expired",
      icon: "⏰",
    };
  }

  const daysLeft = getDaysRemaining(subscription.expiryDate);
  const renewalDate = new Date(subscription.expiryDate).toLocaleDateString();

  if (daysLeft <= 7) {
    return {
      status: "expiring_soon",
      message: `Expires in ${daysLeft} days`,
      icon: "⚠️",
      renewalDate,
    };
  }

  return {
    status: "active",
    message: `Active - Renews on ${renewalDate}`,
    icon: "✅",
    daysLeft,
    renewalDate,
  };
};

/**
 * Parse Razorpay plan period (e.g., "monthly", "quarterly")
 */
export const getPeriodFromPlanId = (planId) => {
  switch (planId) {
    case "quarterly":
      return "3monthly";
    case "half_yearly":
      return "6monthly";
    case "yearly":
      return "yearly";
    default:
      return "yearly";
  }
};

/**
 * Convert pricing to smallest currency unit (paise for INR)
 */
export const convertToSmallestUnit = (amount) => {
  return Math.round(amount * 100);
};

/**
 * Format price for display
 */
export const formatPrice = (amount, currency = "INR") => {
  const symbol = currency === "INR" ? "₹" : "$";
  return `${symbol}${amount}`;
};
