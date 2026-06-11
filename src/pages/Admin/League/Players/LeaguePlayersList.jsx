import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import AssignPlayers from "./AssignPlayers";

export default function LeaguePlayersList({ leagueId }) {
  const [players, setPlayers] = useState([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchPlayers();
  }, [leagueId]);

  const fetchPlayers = async () => {
    const q = query(
      collection(db, "leaguePlayers"),
      where("leagueId", "==", leagueId)
    );
    const snap = await getDocs(q);
    setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  if (assigning) {
    return (
      <AssignPlayers
        leagueId={leagueId}
        onDone={() => {
          setAssigning(false);
          fetchPlayers();
        }}
      />
    );
  }

  return (
    <div>
      <h3>Players</h3>

      <button onClick={() => setAssigning(true)}>
        Assign Players
      </button>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Name</th>
            <th>Team</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id}>
              <td>{p.userName}</td>
              <td>{p.teamName || "Unassigned"}</td>
              <td>{p.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
