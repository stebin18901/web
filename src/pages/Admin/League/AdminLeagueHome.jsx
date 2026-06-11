import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import AdminCreateLeague from "./AdminCreateLeague";
import AdminLeagueDetails from "./AdminLeagueDetails";

export default function AdminLeagueHome() {
  const [leagues, setLeagues] = useState([]);
  const [activeLeagueId, setActiveLeagueId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    fetchLeagues();
  }, []);

  const fetchLeagues = async () => {
    const snap = await getDocs(collection(db, "leagues"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setLeagues(data);
  };

  if (showCreate) {
    return (
      <AdminCreateLeague
        onCreated={() => {
          setShowCreate(false);
          fetchLeagues();
        }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  if (activeLeagueId) {
    return (
      <AdminLeagueDetails
        leagueId={activeLeagueId}
        onBack={() => setActiveLeagueId(null)}
      />
    );
  }

  return (
    <div>
      <h2>Leagues</h2>

      <button onClick={() => setShowCreate(true)}>
        + Create League
      </button>

      <ul>
        {leagues.map((league) => (
          <li key={league.id}>
            <strong>{league.name}</strong> — {league.status}
            <button onClick={() => setActiveLeagueId(league.id)}>
              Manage
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
