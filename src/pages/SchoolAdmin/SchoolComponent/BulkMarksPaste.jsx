import React, { useState } from "react";

const BulkMarksPaste = ({ subjects = [], onApply }) => {
  const [value, setValue] = useState("");

  const handleApply = () => {
    const rows = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split("\t"));
    if (!rows.length) return;
    onApply(rows);
  };

  return (
    <section className="academic-card">
      <div className="academic-card-head">
        <div>
          <h3>Bulk Paste</h3>
          <p>Paste rows copied from Excel or Google Sheets. Expected order: Roll No, Student Name, {subjects.join(", ")}.</p>
          <p>Leave any subject cell blank in the pasted sheet when marks are optional or not entered yet.</p>
        </div>
      </div>
      <textarea
        className="academic-textarea"
        rows="8"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Paste tab-separated rows here"
      />
      <div className="academic-actions" style={{ marginTop: "1rem" }}>
        <button type="button" className="academic-btn-secondary" onClick={handleApply}>
          Apply Bulk Paste
        </button>
      </div>
    </section>
  );
};

export default BulkMarksPaste;
