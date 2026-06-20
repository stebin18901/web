import React from "react";
import PolicyLayout from "../../components/PolicyLayout";

const ContactUs = () => {
  return (
    <PolicyLayout title="Contact Us">
      <p>
        If you have any questions about subscriptions, payments, cancellations,
        or platform access, you can contact Hepsy using the details below.
      </p>
      
      <div style={{ marginTop: "20px", background: "#F9FAFB", padding: "20px", borderRadius: "8px" }}>
        <p><strong>Business Name:</strong> Hepsy Enterprise Private Limited</p>
        <p><strong>Support Email:</strong> hepsyenterpriseinfo@gmail.com</p>
        <p><strong>Operational Address:</strong> Holy spirit, Kizhakkevila, Pozhiyoor P.O., Trivandrum, Kerala, India</p>
        <p><strong>Contact Number:</strong> +91 7560874833</p>
      </div>
      
      <h3>Support Hours</h3>
      <p>Our team aims to respond to customer queries within 24 to 48 business hours.</p>

      <h3>Payment and Subscription Queries</h3>
      <p>
        For Razorpay payment issues, duplicate charges, invoice requests, or
        subscription cancellation assistance, please contact us from your
        registered phone number or email address so we can verify the account
        and assist faster.
      </p>
    </PolicyLayout>
  );
};

export default ContactUs;
