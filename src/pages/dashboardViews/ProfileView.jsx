import React from "react";

export default function ProfileView({
  session,
  selectedClasses,
  activePlan,
  formatDateLabel,
}) {
  return (
    <>
      <section className="dashboard-view-hero dashboard-glass-card">
        <span className="dashboard-view-kicker">Profile</span>
        <h2>Your student details, plan access, and account status in one place.</h2>
        <p>Review your active plan, expiry date, linked school details, and current registration status without leaving the dashboard.</p>
      </section>
      <section className="leader-card profile-details-panel">
        <div className="row-head row-head-stack">
          <div>
            <div className="panel-title">Student Details</div>
            <p className="panel-support-copy">Basic account and subscription details pulled from your active session.</p>
          </div>
        </div>
        <div className="profile-details-grid">
          <article className="profile-detail-card">
            <span>Student Name</span>
            <strong>{session.name || "Student"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>School</span>
            <strong>{session.schoolName || session.schoolId || "Not available"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Current Class</span>
            <strong>{session.className || "Not available"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Selected Classes</span>
            <strong>{selectedClasses.length ? selectedClasses.join(", ") : "Not available"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Current Plan</span>
            <strong>{session.planName || activePlan.name || session.planId || "Default"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Plan Access</span>
            <strong>{session.accessMode || "default-school"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Payment Status</span>
            <strong>{session.paymentStatus || "Not available"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Registration Status</span>
            <strong>{session.registrationStatus || "Not available"}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Expiry Date</span>
            <strong>{formatDateLabel(session.expiryDate)}</strong>
          </article>
          <article className="profile-detail-card">
            <span>Logged In Device</span>
            <strong>{session.deviceLabel || "Unknown device"}</strong>
          </article>
        </div>
      </section>
    </>
  );
}
