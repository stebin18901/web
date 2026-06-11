import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

export default function CreateTeam({ leagueId, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");

  const createTeam = async () => {
    if (!name || !shortName) {
      return alert("Name and short name required");
    }

    await addDoc(collection(db, "teams"), {
      leagueId,
      name,
      shortName,
      captainId: null,
      captainName: null,
      captainImage: null,
      createdAt: serverTimestamp(),
    });

    onCreated();
  };

  return (
    <div>
      <h3>Create Team</h3>

      <input
        placeholder="Team Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Short Name (e.g. RCB)"
        value={shortName}
        onChange={(e) => setShortName(e.target.value.toUpperCase())}
      />

      <button onClick={createTeam}>Create</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
