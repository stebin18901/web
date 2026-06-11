import React from "react";
import "./TeacherList.css";
import { CheckSquare, Square } from "lucide-react";

const TeacherList = ({
  teachers = [],
  selectedTeachers = [], // Changed to array
  setSelectedTeachers,   // Changed to setter for array
  setDraggedTeacher,
  searchTerm,
  setSearchTerm,
  title = "Teachers",
}) => {
  const filteredTeachers = teachers
    .filter((t) => ["teacher", "class_teacher"].includes(t.role))
    .filter(
      (t) =>
        (t.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  const toggleSelect = (teacher) => {
    setSelectedTeachers((prev) => {
      const isSelected = prev.find((t) => t.id === teacher.id);
      if (isSelected) {
        return prev.filter((t) => t.id !== teacher.id);
      } else {
        return [...prev, teacher];
      }
    });
  };

  return (
    <div className="teacher-list-container">
      <div className="list-header">
        <h3>{title}</h3>
        {selectedTeachers.length > 0 && (
          <span className="selection-count">
            {selectedTeachers.length} selected
          </span>
        )}
      </div>

      <input
        type="text"
        className="teacher-search"
        placeholder="Search by name or email"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="teacher-scroll">
        {filteredTeachers.length === 0 ? (
          <div className="no-teachers">No teachers found</div>
        ) : (
          filteredTeachers.map((t) => {
            const isSelected = selectedTeachers.some((st) => st.id === t.id);
            return (
              <div
                key={t.id}
                className={`teacher-card ${isSelected ? "selected" : ""}`}
                draggable
                onDragStart={() => setDraggedTeacher(t)}
                onDragEnd={() => setDraggedTeacher(null)}
                onClick={() => toggleSelect(t)}
              >
                <div className="selection-indicator">
                  {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                </div>
                <div className="avatar">
                  {t.name?.[0]?.toUpperCase() || "T"}
                </div>
                <div className="teacher-meta">
                  <div className="teacher-name">{t.name}</div>
                  <div className="teacher-email">{t.email}</div>
                  {t.role === "class_teacher" && (
                    <span className="teacher-role-tag">Class Teacher</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="right-footer">
        {selectedTeachers.length > 0 ? (
          <div className="bulk-hint">
            Drag any selected teacher to add all <strong>{selectedTeachers.length}</strong>
          </div>
        ) : (
          "Click to select multiple"
        )}
      </div>
    </div>
  );
};

export default TeacherList;
