import React, { useState } from "react";
import "./Leads.css";
import { leads as initialLeads } from "../data/dummyData";

export default function Leads() {
  const [list, setList] = useState(initialLeads);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  // Add new lead
  function add() {
    if (!name || !contact) return alert("Fill all fields");

    const id = Math.max(0, ...list.map((l) => l.id)) + 1;

    const newLead = {
      id,
      name,
      contact,
      status: "New",
      score: "Warm", // Default lead score
      createdAt: new Date().toISOString(),
    };

    setList([newLead, ...list]);
    setName("");
    setContact("");
  }

  // Convert lead
  function convert(id) {
    setList(
      list.map((l) =>
        l.id === id ? { ...l, status: "Converted", score: "Hot" } : l
      )
    );
    alert("Lead converted!");
  }

  // Lead scoring color UI
  const scoreColor = {
    Hot: "#ff4757",
    Warm: "#ffa502",
    Cold: "#1e90ff",
  };

  // Status colors
  const statusColor = {
    New: "#6c5ce7",
    "In Follow-up": "#0984e3",
    Converted: "#00b894",
  };

  // Filtering logic
  const filtered = list.filter((lead) => {
    if (filter !== "All" && lead.status !== filter) return false;
    if (!lead.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="leads-wrapper">

      {/* HEADER */}
      <div className="leads-header">
        <h1 className="leads-title">LEADS & ADMISSIONS</h1>
        <div className="lead-stat-box">
          <div>
            <h3>Total Leads</h3>
            <p>{list.length}</p>
          </div>
          <div>
            <h3>Converted</h3>
            <p>{list.filter((l) => l.status === "Converted").length}</p>
          </div>
          <div>
            <h3>New</h3>
            <p>{list.filter((l) => l.status === "New").length}</p>
          </div>
        </div>
      </div>

      {/* INPUT BAR */}
      <div className="lead-input-bar">
        <input
          className="lead-input"
          placeholder="Parent Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="lead-input"
          placeholder="Contact No"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        />
        <button className="lead-add-btn" onClick={add}>
          ＋ Add Lead
        </button>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="lead-filters">
        <input
          className="lead-search"
          placeholder="Search leads…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="filter-buttons">
          {["All", "New", "In Follow-up", "Converted"].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* LEAD LIST */}
      <div className="lead-list">
        {filtered.length === 0 ? (
          <p className="empty">No leads found.</p>
        ) : (
          filtered.map((l) => (
            <div key={l.id} className="lead-card">
              <div
                className="lead-score-bar"
                style={{ background: scoreColor[l.score] }}
              ></div>

              <div className="lead-main">
                <h2 className="lead-name">{l.name}</h2>
                <p className="lead-contact">📞 {l.contact}</p>

                <span
                  className="lead-status"
                  style={{
                    background: statusColor[l.status],
                  }}
                >
                  {l.status}
                </span>

                <span
                  className="lead-badge"
                  style={{ background: scoreColor[l.score] }}
                >
                  {l.score} Lead
                </span>
              </div>

              <div className="lead-actions">
                {l.status !== "Converted" && (
                  <button className="convert-btn" onClick={() => convert(l.id)}>
                    Convert
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
