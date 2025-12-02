import React, { useState } from "react";
import { fees as initFees, students } from "../data/dummyData";

export default function Fees() {
  const [list, setList] = useState(initFees);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");

  const paidCount = list.filter((f) => f.status === "Paid").length;
  const pendingCount = list.length - paidCount;
  const collectionRate = ((paidCount / list.length) * 100).toFixed(0);

  function toggle(id) {
    setList(
      list.map((f) =>
        f.id === id
          ? { ...f, status: f.status === "Paid" ? "Pending" : "Paid" }
          : f
      )
    );
  }

  function addFee() {
    if (!studentId || !amount)
      return alert("Select student and enter amount");
    const id = Math.max(0, ...list.map((f) => f.id)) + 1;
    setList([
      ...list,
      { id, studentId: Number(studentId), amount: Number(amount), status: "Pending" },
    ]);
    setStudentId("");
    setAmount("");
  }

  const styles = {
    container: { padding: "20px", fontFamily: "system-ui, sans-serif" },
    title: { marginBottom: "20px" },
    tableWrap: {
      background: "white",
      borderRadius: "10px",
      boxShadow: "0 4px 10px rgba(0,0,0,0.06)",
      overflowX: "auto",
    },
    th: {
      padding: "12px",
      background: "#f9fafb",
      color: "#374151",
      textAlign: "left",
      borderBottom: "1px solid #e5e7eb",
    },
    td: {
      padding: "10px",
      borderBottom: "1px solid #f3f4f6",
      verticalAlign: "middle",
    },
    btn: {
      background: "linear-gradient(90deg,#2563eb,#3b82f6)",
      color: "white",
      border: "none",
      padding: "7px 14px",
      borderRadius: "6px",
      cursor: "pointer",
      fontSize: "0.9rem",
      fontWeight: 500,
    },
    cardGrid: {
      display: "flex",
      gap: "16px",
      flexWrap: "wrap",
      marginTop: "24px",
    },
    card: (bg) => ({
      flex: "1 1 200px",
      background: bg,
      color: "#1e293b",
      borderRadius: "12px",
      padding: "20px",
      textAlign: "center",
      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
    }),
    formRow: {
      display: "flex",
      gap: "10px",
      margin: "20px 0",
      flexWrap: "wrap",
      alignItems: "center",
    },
    input: {
      flex: "1 1 150px",
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "0.95rem",
    },
    progressBarOuter: {
      width: "100%",
      height: "10px",
      background: "#f1f5f9",
      borderRadius: "10px",
      marginTop: "10px",
    },
    progressBarInner: (percent) => ({
      width: `${percent}%`,
      height: "100%",
      background: "#10b981",
      borderRadius: "10px",
      transition: "width 0.3s ease",
    }),
    badge: (status) => ({
      background: status === "Paid" ? "#dcfce7" : "#fee2e2",
      color: status === "Paid" ? "#166534" : "#991b1b",
      padding: "4px 10px",
      borderRadius: "20px",
      fontSize: "0.85rem",
      fontWeight: 500,
    }),
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>💰 Fees & Payments</h2>

      {/* Add New Fee Form */}
      <div style={styles.formRow}>
        <select
          style={styles.input}
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="">Select Student</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.class})
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Amount (₹)"
          style={styles.input}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button style={styles.btn} onClick={addFee}>
          ➕ Add Fee Record
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={styles.th}>Student</th>
              <th style={styles.th}>Class</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => {
              const s = students.find((st) => st.id === f.studentId) || {};
              return (
                <tr key={f.id}>
                  <td style={styles.td}>{s.name || "Unknown"}</td>
                  <td style={styles.td}>{s.class || "N/A"}</td>
                  <td style={styles.td}>₹{f.amount}</td>
                  <td style={styles.td}>
                    <span style={styles.badge(f.status)}>{f.status}</span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.btn}
                      onClick={() => toggle(f.id)}
                    >
                      {f.status === "Paid" ? "Mark Pending" : "Mark Paid"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div style={styles.cardGrid}>
        <div style={styles.card("linear-gradient(135deg,#fef9c3,#fef08a)")}>
          <h4>Total Fee Records</h4>
          <p style={{ fontSize: "1.4rem", fontWeight: "600" }}>{list.length}</p>
        </div>
        <div style={styles.card("linear-gradient(135deg,#d1fae5,#a7f3d0)")}>
          <h4>Paid</h4>
          <p style={{ fontSize: "1.4rem", fontWeight: "600" }}>{paidCount}</p>
        </div>
        <div style={styles.card("linear-gradient(135deg,#fee2e2,#fecaca)")}>
          <h4>Pending</h4>
          <p style={{ fontSize: "1.4rem", fontWeight: "600" }}>{pendingCount}</p>
        </div>
      </div>

      {/* Collection Progress */}
      <div
        style={{
          marginTop: "30px",
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
        }}
      >
        <h4 style={{ margin: "0 0 6px" }}>Collection Rate</h4>
        <div style={styles.progressBarOuter}>
          <div style={styles.progressBarInner(collectionRate)}></div>
        </div>
        <p style={{ marginTop: "6px", color: "#374151", fontWeight: 500 }}>
          {collectionRate}% of fees collected
        </p>
      </div>
    </div>
  );
}
