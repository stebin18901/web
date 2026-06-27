# MINT Subscription System - Implementation Guide

## Overview
This document outlines the complete redesigned subscription system for the MINT Entrance Foundation Platform. The system uses Razorpay Subscription API for recurring payments, platform-wide access, and professional SaaS-style experience.

---

## Architecture Overview

### Core Components

1. **Frontend Components**
   - `SubscriptionCheckout.js` - Plan selection and checkout flow
   - `PricingNew.js` - Pricing page with all plans and comparisons
   - `SubscriptionStatus.js` - Subscription management dashboard

2. **Admin Components**
   - `AdminSubscriptionSettings.js` - Configure pricing and popular plan

3. **Backend (Cloud Functions)**
   - `createRazorpaySubscription()` - Create subscription
   - `verifySubscriptionWebhook()` - Handle Razorpay events
   - `cancelSubscription()` - Cancel subscription
   - `fetchSubscription()` - Get subscription status

4. **Configuration**
   - `subscriptionConfig.js` - All plans, pricing, and helpers

---

## Subscription Plans

### Available Plans

| Plan | Duration | Default Price | Access |
|------|----------|---------------|--------|
| Test | 1 week | 1 Rs | All classes 6-10 |
| Quarterly | 3 months | ₹499 | All classes 6-10 |
| Half-Yearly | 6 months | ₹899 | All classes 6-10 |
| Yearly | 12 months | ₹1,499 | All classes 6-10 |

**Key Features (All Plans)**
- ✅ Unlimited Quiz Access
- ✅ All Classes Access (6-10)
- ✅ Weekly Challenges
- ✅ Leaderboards
- ✅ Progress Tracking
- ✅ Notes & Study Materials
- ✅ Auto-Renewal (can be disabled)
- ✅ Cancel Anytime

---

## User Journey

### 1. Authentication
User logs in via phone authentication (existing system)

### 2. First Subscription
```
1. User clicks "Subscribe" button
2. System fetches user data:
   - Name (from Firebase Auth)
   - Email (from Firebase Auth)
   - Phone (from Firebase Auth)
3. Display subscription checkout page with 3 plans
4. User selects plan
5. Click "Subscribe Now"
6. Redirect to Razorpay checkout (pre-filled with user data)
7. User completes payment
8. Razorpay redirects to success page
9. Webhook updates Firebase:
   - subscriptionActive = true
   - razorpaySubscriptionId = subscription ID
   - expiryDate = calculated date
   - startDate = today
   - autoRenewal = true
```

### 3. Accessing Content
- Any active subscription unlocks ALL classes
- User can access Classes 6, 7, 8, 9, 10 without restrictions
- Class selection now available on home dashboard

### 4. Managing Subscription
User visits `/subscription-status` to:
- View current plan details
- See renewal date
- Check days remaining
- Cancel auto-renewal
- Resume auto-renewal (if cancelled)
- Upgrade/downgrade plans

### 5. Subscription Expiry
- If current date > expiryDate and autoRenewal is off:
  - subscriptionActive = false
  - User sees "Subscription Expired" message
  - User can renew from pricing page

---

## Firebase Data Structure

### Subscriptions Collection
```javascript
{
  userId: "uid",
  razorpaySubscriptionId: "sub_xxxxx",
  planId: "yearly",
  planName: "Yearly",
  amount: 1499,
  startDate: "2024-01-15T00:00:00Z",
  expiryDate: "2025-01-15T00:00:00Z",
  subscriptionActive: true,
  status: "active", // created, authenticated, active, paused, cancelled, expired
  autoRenewal: true,
  schoolId: "default",
  razorpayStatus: "active",
  lastPaymentDate: "2024-01-15T10:30:00Z",
  createdAt: "2024-01-15T00:00:00Z",
  updatedAt: "2024-01-15T00:00:00Z"
}
```

### Users Collection (Updated Fields)
```javascript
{
  // ... existing fields ...
  subscriptionActive: true,
  razorpaySubscriptionId: "sub_xxxxx",
  planType: "yearly",
  startDate: "2024-01-15T00:00:00Z",
  expiryDate: "2025-01-15T00:00:00Z",
  autoRenewal: true,
  lastPaymentDate: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T00:00:00Z"
}
```

### Subscription Settings Collection
```javascript
{
  schoolId: "default",
  quarterlyPrice: 499,
  halfYearlyPrice: 899,
  yearlyPrice: 1499,
  currency: "INR",
  popularPlan: "yearly", // Shows "Best Value" badge
  discountBanner: "Limited Time: 20% off", // Optional
  updatedAt: "2024-01-15T00:00:00Z"
}
```

### Subscription History Collection (Log)
```javascript
{
  userId: "uid",
  subscriptionId: "sub_xxxxx",
  event: "invoice.paid", // subscription.authenticated, invoice.paid, etc.
  invoiceId: "inv_xxxxx",
  amount: 1499,
  timestamp: "2024-01-15T00:00:00Z"
}
```

---

## Admin Panel Configuration

### Path: `/admin189201` → Subscriptions Tab

**Features:**
1. Set pricing for all three plans
2. Set popular plan (shows "Best Value" badge)
3. Add optional discount banner
4. View price comparisons and savings
5. Changes reflect instantly on pricing page
6. School-specific or platform-wide settings

**Settings are stored in:** `subscriptionSettings/{schoolId}`

---

## Firebase Security Rules

### Important: Protect subscription fields

```json
{
  "users": {
    "{uid}": {
      "subscriptionActive": {
        ".write": false  // Only Cloud Functions can write
      },
      "expiryDate": {
        ".write": false  // Only Cloud Functions can write
      },
      "planType": {
        ".write": false  // Only Cloud Functions can write
      },
      "razorpaySubscriptionId": {
        ".write": false  // Only Cloud Functions can write
      }
    }
  },
  "subscriptions": {
    "{subscriptionId}": {
      ".write": "root.child('uid').val() == auth.uid || root.auth.token.admin === true"
    }
  }
}
```

---

## Razorpay Webhook Events

### Supported Events

1. **subscription.authenticated**
   - First payment successful
   - Action: Activate subscription

2. **subscription.updated**
   - Plan or amount changed
   - Action: Update subscription record

3. **subscription.paused**
   - Subscription paused
   - Action: Set subscriptionActive = false

4. **subscription.resumed**
   - Subscription resumed
   - Action: Set subscriptionActive = true

5. **subscription.cancelled**
   - Subscription cancelled
   - Action: Set subscriptionActive = false, status = cancelled

6. **invoice.paid**
   - Recurring payment received
   - Action: Update expiryDate, lastPaymentDate

### Webhook URL
```
POST /verifySubscriptionWebhook
```

---

## API Endpoints

### 1. Create Subscription
```
POST /createRazorpaySubscription

Request:
{
  "userId": "uid",
  "name": "Student Name",
  "email": "user@example.com",
  "phone": "+91XXXXXXXXXX",
  "planId": "yearly", // quarterly, half_yearly, yearly
  "schoolId": "default"
}

Response:
{
  "success": true,
  "subscriptionId": "sub_xxxxx",
  "status": "created",
  "shortUrl": "https://rzp.io/l/xxxxx"
}
```

### 2. Cancel Subscription
```
POST /cancelSubscription

Request:
{
  "userId": "uid",
  "subscriptionId": "sub_xxxxx"
}

Response:
{
  "success": true,
  "message": "Subscription cancelled successfully",
  "status": "cancelled"
}
```

### 3. Fetch Subscription
```
GET /fetchSubscription?subscriptionId=sub_xxxxx

Response:
{
  "success": true,
  "subscription": {
    "id": "sub_xxxxx",
    "status": "active",
    "planId": "yearly",
    "currentStart": "2024-01-15T00:00:00Z",
    "currentEnd": "2025-01-15T00:00:00Z",
    "quantity": 1,
    "notes": {}
  }
}
```

---

## Access Control

### Platform-Wide Access
- **Old Model**: Class 6 student could only access Class 6 content
- **New Model**: Any subscription unlocks ALL classes (6-10)

### Benefits
- Better user experience
- Increased perceived value
- Easier subscription management
- Improved retention
- More flexible learning

### Implementation
- Check `subscriptionActive` field in users collection
- If true, show ALL classes
- If false or missing, show login/subscription prompt
- No class-specific restrictions

---

## Subscription Expiry Logic

### Auto-Check (Every Dashboard Load)
```javascript
if (subscription && new Date() > new Date(subscription.expiryDate)) {
  if (!subscription.autoRenewal) {
    subscriptionActive = false;
  }
  // If autoRenewal is true, Razorpay handles renewal
}
```

### User-Facing Messages
- **Active**: "✅ Active Subscription • 245 days remaining"
- **Expiring Soon (< 7 days)**: "⚠️ Expires in 5 days"
- **Expired**: "⏰ Subscription Expired • Renew Now"

---

## Configuration Steps

### Step 1: Cloud Functions Setup
```bash
cd functions
npm install razorpay
# Set environment variables:
# RAZORPAY_KEY_ID=xxxxx
# RAZORPAY_KEY_SECRET=xxxxx
firebase deploy --only functions
```

### Step 2: Create Default Subscription Settings
In Firebase Console, create document:
```
Collection: subscriptionSettings
Document ID: default
Fields:
{
  "quarterlyPrice": 499,
  "halfYearlyPrice": 899,
  "yearlyPrice": 1499,
  "currency": "INR",
  "popularPlan": "yearly"
}
```

### Step 3: Configure Razorpay Webhook
1. Go to Razorpay Dashboard
2. Settings → Webhooks
3. Add webhook URL: `https://your-domain/verifySubscriptionWebhook`
4. Select events: subscription.*, invoice.paid
5. Get webhook secret

### Step 4: Deploy Routes
Add routes to App.js:
```javascript
<Route path="/pricing" element={<PricingNew />} />
<Route path="/subscribe" element={<PrivateRoute element={<SubscriptionCheckout />} />} />
<Route path="/subscription-status" element={<PrivateRoute element={<SubscriptionStatus />} />} />
```

---

## Testing Checklist

- [ ] User can login
- [ ] /pricing shows 3 plans with correct pricing
- [ ] /subscribe shows plan selection
- [ ] Can create subscription
- [ ] Razorpay redirect works
- [ ] Payment success page works
- [ ] Webhook updates Firebase
- [ ] /subscription-status shows active subscription
- [ ] Can view subscription details
- [ ] Can cancel auto-renewal
- [ ] Can resume auto-renewal
- [ ] Expired subscriptions show renewal option
- [ ] Admin can configure pricing
- [ ] Changes reflect on pricing page instantly
- [ ] User with active subscription can access all classes
- [ ] Expired subscription blocks content

---

## Troubleshooting

### Issue: Webhook not firing
**Solution**: Check Razorpay webhook settings, verify URL is accessible

### Issue: User sees old pricing
**Solution**: Clear browser cache, check subscriptionSettings in Firebase

### Issue: Subscription shows as expired but autoRenewal is true
**Solution**: Razorpay might be processing renewal, wait 5-10 minutes or check Razorpay dashboard

### Issue: User can't see all classes
**Solution**: Check `subscriptionActive` field in user document, verify webhook processed correctly

---

## Migration from Old System

### For Existing Premium Users:
```javascript
// Cloud Function to migrate
const existingPremiumUsers = await db.collection('users').where('isPremium', '==', true).get();

existingPremiumUsers.forEach(async (doc) => {
  await db.collection('users').doc(doc.id).set({
    subscriptionActive: true,
    planType: 'yearly',
    startDate: new Date().toISOString(),
    expiryDate: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
    autoRenewal: true,
    isPremium: true // Keep old field for compatibility
  }, { merge: true });
});
```

---

## Success Metrics

✅ One-click subscription flow  
✅ No duplicate phone number entry  
✅ Auto-renewal enabled by default  
✅ All classes unlocked with any subscription  
✅ Admin-controlled pricing  
✅ Professional SaaS experience  
✅ Mobile-first design  
✅ Fast checkout completion  

---

## Support & Maintenance

### For Issues:
- Check Razorpay dashboard for payment issues
- Check Firebase for data inconsistencies
- Review Cloud Function logs in Firebase Console
- Check webhook delivery in Razorpay

### Regular Maintenance:
- Monitor failed webhooks
- Check subscription expiry rates
- Review support requests
- Update pricing based on business needs

---

## Future Enhancements

- [ ] Multiple payment methods (PayPal, Apple Pay, Google Pay)
- [ ] Promotional codes and discounts
- [ ] Family plans
- [ ] Referral bonuses
- [ ] Subscription analytics dashboard
- [ ] Email reminders for expiring subscriptions
- [ ] In-app notifications for subscription events

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: MINT Development Team
