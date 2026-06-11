import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

export default function AssignPlayers({ leagueId, onDone }) {
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, []);

  const fetchUsers = async () => {
    const snap = await getDocs(collection(db, "users"));
    setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const fetchTeams = async () => {
    const q = query(
      collection(db, "teams"),
      where("leagueId", "==", leagueId)
    );
    const snap = await getDocs(q);
    setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const assignPlayer = async (user) => {
    if (!selectedTeam) return alert("Select a team first");

    const team = teams.find(t => t.id === selectedTeam);

    await addDoc(collection(db, "leaguePlayers"), {
      leagueId,
      userId: user.id,
      userName: user.name,
      userImage: user.photoURL || null,
      teamId: team.id,
      teamName: team.name,
      role: "PLAYER",
      createdAt: serverTimestamp()
    });
  };

  return (
    <div>
      <h3>Assign Players</h3>

      <select onChange={e => setSelectedTeam(e.target.value)}>
        <option value="">Select Team</option>
        {teams.map(t => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      <ul>
        {users.map(u => (
          <li key={u.id}>
            {u.name}
            <button onClick={() => assignPlayer(u)}>
              Add
            </button>
          </li>
        ))}
      </ul>

      <button onClick={onDone}>Done</button>
    </div>
  );
}
