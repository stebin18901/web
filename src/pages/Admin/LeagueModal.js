// src/pages/admin/LeagueModal.js
import React from "react";
import "./AdminCreateLeague.css";

export default function LeagueModal({
  league,
  onClose,
  onActivateLeague,
  onResetLeague,
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>{league.name}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <p><b>Status:</b> {league.status}</p>
          <p><b>Total Slots:</b> {league.numberOfTeams}</p>
          <p><b>Start Date:</b> {league.startDate}</p>
          <p><b>Start Time:</b> {league.startTime}</p>
        </div>

        <div className="modal-actions mt">
          {league.status === "SCHEDULED" && (
            <button
              className="activate-btn"
              onClick={() => onActivateLeague(league)}
            >
              Generate Schedule
            </button>
          )}

          {league.status === "ACTIVE" && (
            <button
              className="danger-btn"
              onClick={() => onResetLeague(league.id)}
            >
              Reset League (Delete Matches)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
