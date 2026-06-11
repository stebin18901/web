import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc,
  doc,
  orderBy,
  deleteDoc,
  writeBatch,   // ✅ ADD THIS
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebaseConfig";
import "./AdminCreateLeague.css";
import { generateRoundRobinSchedule } from "./matchEngine";


// Config for the engine
const MATCH_DAYS = [2, 4, 0]; // Tue, Thu, Sun (JS Date.getDay(): 0 is Sunday)

/* ===========================
    LEAGUE CONTROL MODAL
=========================== */
function LeagueModal({ league, onClose, onActivateLeague, onResetLeague }) {
  const [teamsInLeague, setTeamsInLeague] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [processing, setProcessing] = useState(false);

  // Form Fields
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [members, setMembers] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [capLeftFile, setCapLeftFile] = useState(null);
  const [capRightFile, setCapRightFile] = useState(null);

  useEffect(() => {
    fetchData();
  }, [league.id]);

  const fetchData = async () => {
    const snap = await getDocs(collection(db, "teams"));
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setTeamsInLeague(all.filter((t) => t.leagueId === league.id));
    setAvailableTeams(all.filter((t) => t.leagueId !== league.id));
  };

  const assignExistingTeam = async (teamId) => {
    if (teamsInLeague.length >= league.numberOfTeams) return alert("League Full");
    setProcessing(true);
    try {
      await updateDoc(doc(db, "teams", teamId), { leagueId: league.id });
      fetchData();
    } finally { setProcessing(false); }
  };

  const uploadImage = async (file, path) => {
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, file);
    return getDownloadURL(fileRef);
  };

  const saveTeam = async () => {
    if (!teamName || !captainName) return alert("Names required");
    setProcessing(true);
    try {
      let teamId;
      if (teamsInLeague.length >= league.numberOfTeams) throw new Error("Full");
      
      const docRef = await addDoc(collection(db, "teams"), {
        leagueId: league.id,
        name: teamName,
        baseStrength: 70,
        captain: { name: captainName },
        createdAt: serverTimestamp(),
      });
      teamId = docRef.id;

      const updates = { members: members.split(",").map(m => m.trim()).filter(Boolean) };
      const path = `leagues/${league.id}/teams/${teamId}`;
      if (logoFile) updates.logoUrl = await uploadImage(logoFile, `${path}/logo.png`);
      if (capLeftFile) updates["captain.imageLeftUrl"] = await uploadImage(capLeftFile, `${path}/cap_left.png`);
      if (capRightFile) updates["captain.imageRightUrl"] = await uploadImage(capRightFile, `${path}/cap_right.png`);

      await updateDoc(doc(db, "teams", teamId), updates);
      setTeamName(""); setCaptainName(""); setMembers("");
      setLogoFile(null); setCapLeftFile(null); setCapRightFile(null);
      fetchData();
    } catch (e) { alert(e.message); } finally { setProcessing(false); }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>{league.name} ({league.status})</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="available-teams-section">
          <h4>Available Teams (Click to Add)</h4>
          <div className="horizontal-scroll-list">
            {availableTeams.map(t => (
              <div key={t.id} className="mini-team-card" onClick={() => assignExistingTeam(t.id)}>
                <img src={t.logoUrl || "https://via.placeholder.com/30"} alt="" />
                <span>{t.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-container card mt">
          <h3>Create Team</h3>
          <div className="form-grid">
            <input placeholder="Team Name" value={teamName} onChange={e => setTeamName(e.target.value)} />
            <input placeholder="Captain Name" value={captainName} onChange={e => setCaptainName(e.target.value)} />
            <textarea placeholder="Members (comma separated)" value={members} onChange={e => setMembers(e.target.value)} className="full-width" />
          </div>
          <button className="primary-btn mt" onClick={saveTeam} disabled={processing}>Save Team</button>
        </div>

        <h3 className="mt">Teams in League ({teamsInLeague.length}/{league.numberOfTeams})</h3>
        <div className="team-grid-list">
          {teamsInLeague.map(t => (
            <div key={t.id} className="team-card-expanded">
              <div className="team-main-info">
                <img src={t.logoUrl || "https://via.placeholder.com/50"} className="team-logo-preview" />
                <div><b>{t.name}</b><br/><small>Cap: {t.captain?.name}</small></div>
              </div>
              <button className="delete-link" onClick={async () => {
                await updateDoc(doc(db, "teams", t.id), { leagueId: null });
                fetchData();
              }}>Remove</button>
            </div>
          ))}
        </div>

        <div className="modal-actions mt">
          {league.status === "SCHEDULED" && teamsInLeague.length >= 2 && (
            <button className="activate-btn" onClick={() => onActivateLeague(league, teamsInLeague)}>
              Generate Balanced Schedule
            </button>
          )}

          {league.status === "ACTIVE" && (
            <button className="danger-btn" onClick={() => onResetLeague(league.id)}>
              Reset League (Delete Matches)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===========================
    ADMIN CREATE LEAGUE
=========================== */
export default function AdminCreateLeague() {
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState(null);
  const [form, setForm] = useState({ name: "", total: "", startDate: "", startTime: "" });

  useEffect(() => { fetchLeagues(); }, []);

  const fetchLeagues = async () => {
    const snap = await getDocs(query(collection(db, "leagues"), orderBy("createdAt", "desc")));
    setLeagues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const createLeague = async () => {
    if (!form.name || !form.startDate) return alert("Fill fields");
    await addDoc(collection(db, "leagues"), {
      name: form.name,
      numberOfTeams: Number(form.total),
      startDate: form.startDate,
      startTime: form.startTime || "20:00",
      status: "SCHEDULED",
      createdAt: serverTimestamp()
    });
    setForm({ name: "", total: "", startDate: "", startTime: "" });
    fetchLeagues();
  };

  // --- NEW BALANCED ACTIVATION (ROUND ROBIN) ---
  const activateLeague = async (league, teamsInLeague) => {
  if (!window.confirm("Generate schedule?")) return;

  try {
    let teams = [...teamsInLeague].sort(() => Math.random() - 0.5);

    if (teams.length % 2 !== 0) {
      teams.push({ id: "BYE", name: "BYE", isBye: true });
    }

    const totalTeams = teams.length;
    const rounds = totalTeams - 1;
    const matchesPerRound = totalTeams / 2;

    // 🔴 CRITICAL FIX: parse date manually (LOCAL)
    const [y, m, d] = league.startDate.split("-").map(Number);
    let matchDate = new Date(y, m - 1, d, 12, 0, 0);

    // Match days: Sun, Tue, Thu
    const MATCH_DAYS = [0, 2, 4];

    // Align to first valid match day
    while (!MATCH_DAYS.includes(matchDate.getDay())) {
      matchDate.setDate(matchDate.getDate() + 1);
    }

    const batch = writeBatch(db);

    for (let round = 0; round < rounds; round++) {
      // ONE DATE PER ROUND
      const roundDate = new Date(matchDate);

      const formattedDate =
        roundDate.getFullYear() +
        "-" +
        String(roundDate.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(roundDate.getDate()).padStart(2, "0");

      for (let i = 0; i < matchesPerRound; i++) {
        const teamA = teams[i];
        const teamB = teams[totalTeams - 1 - i];

        if (teamA.isBye || teamB.isBye) continue;

        const ref = doc(collection(db, "leagueFixtures"));
        batch.set(ref, {
          leagueId: league.id,
          round: round + 1,
          date: formattedDate, // ✅ NOT toISOString
          startTime: league.startTime || "20:00",
          status: "UPCOMING",
          teamA: { id: teamA.id, name: teamA.name },
          teamB: { id: teamB.id, name: teamB.name },
          createdAt: serverTimestamp(),
        });
      }

      // Rotate teams
      teams.splice(1, 0, teams.pop());

      // Move to NEXT valid match day
      do {
        matchDate.setDate(matchDate.getDate() + 1);
      } while (!MATCH_DAYS.includes(matchDate.getDay()));
    }

    batch.update(doc(db, "leagues", league.id), { status: "ACTIVE" });
    await batch.commit();

    alert("Schedule generated correctly");
    setSelectedLeague(null);
    fetchLeagues();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};



  // --- NEW RESET FUNCTION ---
  const resetLeague = async (leagueId) => {
    if (!window.confirm("This will PERMANENTLY delete all matches. Continue?")) return;

    try {
      const q = query(collection(db, "leagueFixtures"), where("leagueId", "==", leagueId));
      const snap = await getDocs(q);
      const deletes = snap.docs.map(d => deleteDoc(doc(db, "leagueFixtures", d.id)));
      await Promise.all(deletes);

      await updateDoc(doc(db, "leagues", leagueId), { status: "SCHEDULED" });
      alert("League reset. You can now generate a new schedule.");
      setSelectedLeague(null);
      fetchLeagues();
    } catch (err) {
      alert("Error resetting: " + err.message);
    }
  };

  return (
    <div className="league-admin">
      <div className="league-form card">
        <input placeholder="Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        <input type="number" placeholder="Teams" value={form.total} onChange={e => setForm({...form, total: e.target.value})} />
        <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
        <input type="time" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
        <button className="primary-btn" onClick={createLeague}>Create League</button>
      </div>

      <table className="league-table">
        <thead><tr><th>League</th><th>Teams</th><th>Status</th><th>Manage</th></tr></thead>
        <tbody>
          {leagues.map(l => (
            <tr key={l.id}>
              <td>{l.name}</td><td>{l.numberOfTeams}</td>
              <td><span className={`status-badge ${l.status.toLowerCase()}`}>{l.status}</span></td>
              <td><button className="secondary-btn" onClick={() => setSelectedLeague(l)}>Manage</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {selectedLeague && (
        <LeagueModal 
          league={selectedLeague} 
          onClose={() => setSelectedLeague(null)} 
          onActivateLeague={activateLeague}
          onResetLeague={resetLeague}
        />
      )}
    </div>
  );
}