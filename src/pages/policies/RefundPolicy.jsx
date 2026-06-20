import React from "react";
import PolicyLayout from "../../components/PolicyLayout";

const RefundPolicy = () => {
  return (
    <PolicyLayout title="Cancellation & Refund Policy">
      <p>
        Thank you for subscribing to Hepsy. This page explains how
        cancellations, renewals, and refunds are handled for our digital
        education services.
      </p>
      
      <h3>1. Cancellation of Subscription</h3>
      <p>Users may request cancellation of future renewals for an active subscription at any time before the next billing cycle. Cancellation stops the next recurring charge and the current paid access remains active until the end of the already-paid period.</p>
      
      <h3>2. Refund Eligibility</h3>
      <p>Because Hepsy provides instant access to digital educational content and subscription services, payments are generally non-refundable once a plan is successfully activated. Refund requests may be reviewed in cases such as duplicate payment, accidental double charge, or a confirmed technical issue that prevented service activation.</p>
      
      <h3>3. How to Request Support</h3>
      <p>To request cancellation help or report a payment issue, contact Hepsy support with your registered phone number, payment date, amount paid, and transaction reference so our team can verify and review the request quickly.</p>

      <h3>4. Refund Timelines</h3>
      <p>If a refund is approved, the amount will be returned to the original payment method used during checkout. Refund settlement timelines typically depend on the banking channel and are usually completed within <strong>5 to 7 business days</strong>.</p>

      <h3>5. Contact Details</h3>
      <p>For payment support, write to <strong>hepsyenterpriseinfo@gmail.com</strong> or call <strong>+91 7560874833</strong>.</p>
    </PolicyLayout>
  );
};

export default RefundPolicy;
