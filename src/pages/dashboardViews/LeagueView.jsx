import React from "react";

export default function LeagueView({ leagueBannerImage, navigate }) {
  return (
    <section className="league-launch-banner">
      <div className="league-launch-orb league-launch-orb-one" aria-hidden="true" />
      <div className="league-launch-orb league-launch-orb-two" aria-hidden="true" />

      <div className="league-launch-copy">
        <span className="dashboard-view-kicker">Quiz Fantasy League</span>
        <h2>Draft your school squad and enter the fantasy arena.</h2>
        <p>
          Your full fantasy league experience is now on its own dedicated page for a cleaner,
          wider, and more immersive game flow.
        </p>
        <div className="league-launch-badges" aria-label="League highlights">
          <span>5 student lineup</span>
          <span>Captain always locked</span>
          <span>Live fantasy scoring</span>
        </div>
        <button
          type="button"
          className="league-launch-cta"
          onClick={() => navigate("/league/fantasy")}
        >
          <span>Play Now</span>
          <strong>Fantasy Arena</strong>
        </button>
      </div>

      <div className="league-launch-art" aria-hidden="true">
        <div className="league-launch-art-frame">
          <img src={leagueBannerImage} alt="" />
        </div>
        <div className="league-launch-floating-card league-launch-floating-card-top">
          <small>Lineup Power</small>
          <strong>Boosted by practice</strong>
        </div>
        <div className="league-launch-floating-card league-launch-floating-card-bottom">
          <small>School League</small>
          <strong>Ready for matchday</strong>
        </div>
      </div>
    </section>
  );
}
