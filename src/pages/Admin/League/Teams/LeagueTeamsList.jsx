import React, { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import CreateTeam from "./CreateTeam";

export default function LeagueTeamsList({ leagueId }) {
  const [teams, setTeams] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [leagueId]);

  const fetchTeams = async () => {
    const q = query(
      collection(db, "teams"),
      where("leagueId", "==", leagueId)
    );
    const snap = await getDocs(q);
    setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  if (showCreate) {
    return (
      <CreateTeam
        leagueId={leagueId}
        onCreated={() => {
          setShowCreate(false);
          fetchTeams();
        }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  return (
    <div>
      <h3>Teams</h3>

      <button onClick={() => setShowCreate(true)}>
        + Add Team
      </button>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Name</th>
            <th>Short</th>
            <th>Captain</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.shortName}</td>
              <td>{t.captainName || "Not assigned"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
