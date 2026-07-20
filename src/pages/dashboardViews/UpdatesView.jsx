import React from "react";

export default function UpdatesView({ adminNotifications, navigate }) {
  return (
    <>
      <section className="dashboard-view-hero dashboard-glass-card">
        <span className="dashboard-view-kicker">Admin Updates</span>
        <h2>Announcements, new releases, fantasy drops, and school notices in one stream.</h2>
        <p>These updates are published from the admin workspace and automatically filtered for your school when needed.</p>
      </section>
      <section className="dashboard-updates-feed">
        {adminNotifications.length ? (
          adminNotifications.map((item) => (
            <article key={item.id} className={`dashboard-update-card tone-${item.tone || "general"}`}>
              <div className="dashboard-update-copy">
                <div className="dashboard-update-meta">
                  <span>{item.schoolId ? item.schoolName || item.schoolId : "All Schools"}</span>
                  {item.pinned ? <strong>Pinned</strong> : null}
                </div>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
                {item.ctaLabel && item.ctaLink ? (
                  <button
                    type="button"
                    className="dashboard-update-cta"
                    onClick={() => {
                      if (String(item.ctaLink).startsWith("/")) {
                        navigate(item.ctaLink);
                        return;
                      }
                      window.open(item.ctaLink, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {item.ctaLabel}
                  </button>
                ) : null}
              </div>
              {item.imageUrl ? (
                <div className="dashboard-update-art">
                  <img src={item.imageUrl} alt={item.title} />
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="empty-note">No admin updates available yet.</div>
        )}
      </section>
    </>
  );
}
