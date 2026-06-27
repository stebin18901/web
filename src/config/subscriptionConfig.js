/**
 * Subscription Configuration for MINT Platform
 * Contains all subscription plans, constants, and API endpoints
 */

// ==================== SUBSCRIPTION PLANS ====================
export const SUBSCRIPTION_PLANS = {
  WEEKLY_TEST: {
    id: "weekly_test",
    name: "Test",
    durationInWeeks: 0,
    durationInMonths: 0,
    durationInDays: 8,
    badge: "8 Days",
    description: "8-day test subscription for Razorpay payment validation",
    billingDivisor: 1,
    billingLabel: "8 days",
    isTestPlan: true,
  },
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
export const PLAN_IDS = ["weekly_test", "quarterly", "half_yearly", "yearly"];

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
  weekly_test: 1,
  quarterly: 590,
  half_yearly: 990,
  yearly: 1599,
};

export const DEFAULT_PLAN_VISIBILITY = {
  weekly_test: false,
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

export const getSubscriptionPricingFromSettings = (settings = {}) => ({
  weekly_test: Number(settings.weeklyTestPrice) || DEFAULT_PRICING.weekly_test,
  quarterly: Number(settings.quarterlyPrice) || DEFAULT_PRICING.quarterly,
  half_yearly:
    Number(settings.halfYearlyPrice) || DEFAULT_PRICING.half_yearly,
  yearly: Number(settings.yearlyPrice) || DEFAULT_PRICING.yearly,
});

export const isPlanVisible = (planId, settings = {}) => {
  if (planId === "weekly_test") {
    return Boolean(settings.testPlanEnabled);
  }
  return true;
};

export const getVisibleSubscriptionPlans = (settings = {}) =>
  Object.values(SUBSCRIPTION_PLANS).filter((plan) =>
    isPlanVisible(plan.id, settings)
  );

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
  if (plan.durationInDays) {
    date.setDate(date.getDate() + plan.durationInDays);
    return date;
  }
  date.setMonth(date.getMonth() + plan.durationInMonths);
  return date;
};

export const getPlanBillingText = (planId, amount) => {
  const plan = getPlanById(planId);
  const divisor = plan.billingDivisor || plan.durationInMonths || 1;
  const unitPrice = Math.round(Number(amount || 0) / divisor);
  const label = plan.billingLabel || "month";
  return `${formatPrice(unitPrice)}/${label}`;
};

/**
 * Check if subscription is active
 */
export const isSubscriptionActive = (subscription) => {
  if (!subscription) return false;
  const expiryDate = new Date(subscription.expiryDate);
  if (expiryDate <= new Date()) return false;
  if (subscription.cancellationScheduled) return true;
  return subscription.subscriptionActive !== false;
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

  if (subscription.cancellationScheduled || subscription.autoRenewal === false) {
    return {
      status: "cancellation_pending",
      message: `Active - Cancels on ${renewalDate}`,
      icon: "âš ï¸",
      daysLeft,
      renewalDate,
    };
  }

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
    case "weekly_test":
      return "weekly";
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
