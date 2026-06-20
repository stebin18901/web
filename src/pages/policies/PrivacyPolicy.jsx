import React from "react";
import PolicyLayout from "../../components/PolicyLayout";

const PrivacyPolicy = () => {
  return (
    <PolicyLayout title="Privacy Policy">
      <p>
        At Hepsy, your privacy is important to us. This policy explains what
        information we collect, how we use it, and how we protect it.
      </p>
      
      <h3>1. Information We Collect</h3>
      <p>We may collect your name, phone number, email address, school details, class information, and account activity when you register, subscribe, contact support, or use our educational features.</p>
      
      <h3>2. How We Use Data</h3>
      <p>Your data is used to provide quiz access, progress tracking, class content, subscription management, customer support, service updates, and transaction-related communication.</p>
      
      <h3>3. Payment & Payment Security</h3>
      <p>We do not store your full card, UPI PIN, or net banking credentials on our servers. Online payments are processed through Razorpay and related banking/payment networks.</p>
      
      <h3>4. Third-Party Sharing</h3>
      <p>Hepsy does not sell or rent your personal data. Information may be shared only with trusted service providers required for hosting, analytics, authentication, customer communication, or payment processing.</p>

      <h3>5. Data Retention and Security</h3>
      <p>We retain account and transaction data only for as long as reasonably required for service delivery, legal compliance, dispute resolution, and fraud prevention. We use reasonable technical and administrative safeguards to protect user information.</p>

      <h3>6. Contact for Privacy Requests</h3>
      <p>If you need help with your personal data, account details, or a privacy-related concern, please contact us through the details listed on the Contact Us page.</p>
    </PolicyLayout>
  );
};

export default PrivacyPolicy;
