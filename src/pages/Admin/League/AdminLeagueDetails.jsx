import React from "react";
import LeagueTeamsList from "./Teams/LeagueTeamsList";
import StartLeague from "./Controls/StartLeague";
import LeaguePlayersList from "./Players/LeaguePlayersList";

export default function AdminLeagueDetails({ leagueId, onBack }) {
  return (
    <div>
      <button onClick={onBack}>← Back</button>

      <h2>League Control</h2>

      <LeagueTeamsList leagueId={leagueId} />

      <hr />
      <LeaguePlayersList leagueId={leagueId} />

      <StartLeague leagueId={leagueId} />
    </div>
  );
}
