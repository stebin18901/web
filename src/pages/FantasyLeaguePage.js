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
        <LeagueSimulator session={session} />
      </div>
    </div>
  );
}
