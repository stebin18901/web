import React from "react";

const AttendanceFilters = ({
  classes = [],
  selectedClass = "",
  selectedDate = "",
  searchTerm = "",
  onClassChange,
  onDateChange,
  onSearchChange,
  onMarkAllPresent,
  onMarkAllAbsent,
  onReset,
  onExport,
}) => {
  return (
    <section className="academic-card">
      <div className="academic-card-head">
        <div>
          <h3>Attendance Filters</h3>
          <p>Choose the class roster and date, then quickly mark attendance without extra steps.</p>
        </div>
        <div className="academic-actions">
          <button type="button" className="academic-btn-secondary" onClick={onMarkAllPresent}>
            Mark all Present
          </button>
          <button type="button" className="academic-btn-danger" onClick={onMarkAllAbsent}>
            Mark all Absent
          </button>
          <button type="button" className="academic-btn-ghost" onClick={onReset}>
            Reset
          </button>
          <button type="button" className="academic-btn-ghost" onClick={onExport}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="academic-filter-grid">
        <div className="academic-field">
          <label>Class</label>
          <select className="academic-select" value={selectedClass} onChange={(e) => onClassChange(e.target.value)}>
            <option value="">Select class</option>
            {Array.from(new Set(classes.map((entry) => entry.className))).map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>
        <div className="academic-field">
          <label>Date</label>
          <input className="academic-input" type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} />
        </div>
        <div className="academic-field">
          <label>Search</label>
          <input
            className="academic-input"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by roll or name"
          />
        </div>
      </div>
    </section>
  );
};

export default AttendanceFilters;
