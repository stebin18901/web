import React from "react";
import "./TeacherList.css";

const TeacherList = ({
  teachers = [],
  selectedTeacher,
  setSelectedTeacher,
  draggedTeacher,
  setDraggedTeacher,
  searchTerm,
  setSearchTerm,
  title = "Teachers",
}) => {
  const filteredTeachers = teachers
    .filter((t) => ["teacher", "class_teacher"].includes(t.role)) // ✅ Only show teachers
    .filter(
      (t) =>
        (t.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="teacher-list-container">
      <h3>{title}</h3>

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
          filteredTeachers.map((t) => (
            <div
              key={t.id}
              className={`teacher-card ${
                selectedTeacher?.id === t.id ? "selected" : ""
              }`}
              draggable
              onDragStart={() => setDraggedTeacher(t)}
              onDragEnd={() => setDraggedTeacher(null)}
              onClick={() =>
                setSelectedTeacher((prev) =>
                  prev?.id === t.id ? null : t
                )
              }
            >
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
          ))
        )}
      </div>

      <div className="right-footer">
        Selected:{" "}
        <strong>{selectedTeacher ? selectedTeacher.name : "None"}</strong>
      </div>
    </div>
  );
};

export default TeacherList;
