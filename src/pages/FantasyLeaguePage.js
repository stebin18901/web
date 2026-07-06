import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import LeagueSimulator from "../components/LeagueSimulator";
import "./FantasyLeaguePage.css";

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export default function FantasyLeaguePage() {
  const navigate = useNavigate();
  const session = useMemo(
    () => safeJsonParse(localStorage.getItem("schoolStudentSession")),
    []
  );

  if (!session?.id || !session?.schoolId) {
    return (
      <div className="fantasy-league-page">
        <div className="fantasy-page-orb fantasy-page-orb-one" aria-hidden="true" />
        <div className="fantasy-page-orb fantasy-page-orb-two" aria-hidden="true" />
        <div className="fantasy-league-shell">
          <div className="fantasy-league-topbar">
            <div>
              <span>hepsy fantasy league</span>
              <h1>Fantasy League Access</h1>
              <p>Your school session is missing. Return to the dashboard and reopen the league from your student account.</p>
            </div>

            <button
              type="button"
              className="fantasy-league-back"
              onClick={() => navigate("/dashboard")}
            >
              Back To Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fantasy-league-page">
      <div className="fantasy-page-orb fantasy-page-orb-one" aria-hidden="true" />
      <div className="fantasy-page-orb fantasy-page-orb-two" aria-hidden="true" />
      <div className="fantasy-league-shell">
        <div className="fantasy-league-topbar">
          <div className="fantasy-league-topbar-copy">
            <span>hepsy fantasy league</span>
            <h1>{session?.schoolName || "School"} Fantasy Arena</h1>
            <p>Pick your five, lock the vice captain, and play the full fantasy league on a dedicated screen.</p>
            <div className="fantasy-league-topbar-badges" aria-label="Fantasy league highlights">
              <span>Captain auto locked</span>
              <span>Responsive live lineup</span>
              <span>Practice driven scoring</span>
            </div>
          </div>

          <div className="fantasy-league-topbar-actions">
            <div className="fantasy-league-status-card">
              <small>Live Format</small>
              <strong>5 Student Fantasy Draft</strong>
            </div>
            <button
              type="button"
              className="fantasy-league-back"
              onClick={() => navigate("/dashboard")}
            >
              Back To Dashboard
            </button>
          </div>
        </div>

        <LeagueSimulator session={session} />
      </div>
    </div>
  );
}
