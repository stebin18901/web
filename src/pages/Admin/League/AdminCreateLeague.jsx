import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

export default function AdminCreateLeague({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [season, setSeason] = useState("");

  const createLeague = async () => {
    if (!name) return alert("League name required");

    await addDoc(collection(db, "leagues"), {
      name,
      season,
      status: "DRAFT",
      createdAt: serverTimestamp(),
      startedAt: null,
    });

    onCreated();
  };

  return (
    <div>
      <h2>Create League</h2>

      <input
        placeholder="League Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Season (optional)"
        value={season}
        onChange={(e) => setSeason(e.target.value)}
      />

      <button onClick={createLeague}>Create</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}
