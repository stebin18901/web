import React from "react";
import PolicyLayout from "../../components/PolicyLayout";

const TermsAndConditions = () => {
  return (
    <PolicyLayout title="Terms & Conditions">
      <p>
        Welcome to Hepsy. By accessing our website, registering a student, or
        purchasing a subscription, you agree to the terms below.
      </p>
      
      <h3>1. Acceptance of Terms</h3>
      <p>By creating an account, accessing, or purchasing services on Hepsy, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.</p>
      
      <h3>2. Use of Services</h3>
      <p>You agree to use our educational platform, quizzes, notes, and school communication tools solely for lawful educational purposes. Any unauthorized scraping, duplication, resale, or distribution of our platform content is strictly prohibited.</p>
      
      <h3>3. User Accounts</h3>
      <p>You are responsible for maintaining the confidentiality of your account credentials, OTP access, and school-issued login details. Hepsy cannot be liable for losses arising from a user's failure to protect their credentials.</p>
      
      <h3>4. Subscription Plans and Billing</h3>
      <p>Paid plans, durations, included features, and pricing are displayed on the public pricing page before checkout. Access is activated after successful payment confirmation through our payment partner Razorpay.</p>
      
      <h3>5. Auto-Renewal and Cancellation</h3>
      <p>Some subscription plans may renew automatically unless cancelled before the next billing cycle. Users can contact support for cancellation help. Cancellation stops future renewals, and already-paid access remains available until the end of the active billing period unless otherwise stated.</p>

      <h3>6. Modifications to Service</h3>
      <p>We may update features, content, pricing, or plan structure from time to time. Material changes will be reflected on the website before new purchases are completed.</p>

      <h3>7. Governing Law</h3>
      <p>These terms are governed by the laws of India. Any disputes will be subject to the jurisdiction of the competent courts in Kerala, India.</p>
    </PolicyLayout>
  );
};

export default TermsAndConditions;
