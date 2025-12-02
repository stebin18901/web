import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  ListChecks,
  Trash2,
  Edit2,
  Clock,
  Calendar,
  CheckCircle,
  Search,
  Save,
  BookOpen,
} from "lucide-react";
import "./ManageAssignments.css";

export default function ManageAssignments({ teacher, onEdit, setActiveTab }) {
  const [assignments, setAssignments] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [assigned, setAssigned] = useState({}); // local tracking for selected assignments per class
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // 🟢 Fetch all assignments
  useEffect(() => {
    async function fetchAssignments() {
      setLoading(true);
      try {
        const q = query(collection(db, "assignments"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAssignments(data);
      } catch (err) {
        console.error("Error fetching assignments:", err);
      }
      setLoading(false);
    }
    fetchAssignments();
  }, [teacher]);

  // 🟣 Fetch available classes (for dropdown)
  useEffect(() => {
    async function fetchClasses() {
      try {
        const q = query(collection(db, "classes"), where("schoolId", "==", teacher.schoolId));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setClasses(data);
      } catch (err) {
        console.error("Error fetching classes:", err);
      }
    }
    if (teacher?.schoolId) fetchClasses();
  }, [teacher]);

  // 🟠 Filter assignments by search
  const filtered = assignments.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  // 🟡 Toggle assign / unassign for a class
  const toggleAssign = (assignmentId) => {
    if (!selectedClass) return alert("Please select a class first!");
    setAssigned((prev) => {
      const current = new Set(prev[selectedClass] || []);
      current.has(assignmentId) ? current.delete(assignmentId) : current.add(assignmentId);
      return { ...prev, [selectedClass]: Array.from(current) };
    });
  };

  // 🔵 Save assignment-class links to Firestore
  const saveAssignments = async () => {
    if (!selectedClass) return alert("Select a class before saving!");
    setSaving(true);
    try {
      const toAssign = assigned[selectedClass] || [];
      // loop through assignments and update Firestore
      for (const id of toAssign) {
        const ref = doc(db, "assignments", id);
        await updateDoc(ref, {
          assignedClasses: [...new Set([...(assignments.find(a => a.id === id)?.assignedClasses || []), selectedClass])],
          updatedAt: new Date(),
        });
      }
      alert(`✅ Assigned ${toAssign.length} assignment(s) to ${selectedClass}`);
    } catch (err) {
      console.error("Error saving assignments:", err);
      alert("❌ Failed to save assignment-class mapping");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="manage-placeholder fade-in">
        <Clock size={22} className="icon-spin" />
        <p>Loading your assignments...</p>
      </div>
    );

  if (!assignments.length)
    return (
      <div className="manage-placeholder fade-in">
        <ListChecks size={24} />
        <p>No assignments created yet. Create one to get started!</p>
      </div>
    );

  return (
    <div className="manage-assignments fade-in">
      {/* ---------------- Header ---------------- */}
      <div className="manage-header">
        <div className="left">
          <h3>📘 Manage Assignments</h3>
          <div className="search-bar">
            <Search size={16} />
            <input
              placeholder="Search assignments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* 🔽 Class Selector */}
        <div className="right">
          <div className="class-selector">
            <BookOpen size={16} />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.className}>
                  {c.className}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-save" onClick={saveAssignments} disabled={saving}>
            <Save size={14} /> {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* ---------------- Assignment Grid ---------------- */}
      <div className="assignment-grid">
        {filtered.map((a) => {
          const isSelected = assigned[selectedClass]?.includes(a.id);
          const assignedTo = a.assignedClasses || [];

          return (
            <div
              key={a.id}
              className={`assignment-card ${a.status} ${isSelected ? "selected" : ""}`}
              onClick={() => toggleAssign(a.id)}
            >
              <div className="card-header">
                <h4>{a.title}</h4>
                <span className={`status-badge ${a.status}`}>
                  {a.status === "published" ? (
                    <>
                      <CheckCircle size={12} /> Published
                    </>
                  ) : (
                    <>
                      <Clock size={12} /> Draft
                    </>
                  )}
                </span>
              </div>

              <p className="card-instructions">
                {a.instructions?.length > 120
                  ? a.instructions.slice(0, 120) + "..."
                  : a.instructions || "No description provided."}
              </p>

              {a.dueDate && (
                <div className="card-due">
                  <Calendar size={14} /> Due:{" "}
                  <span className="due-text">{a.dueDate}</span>
                </div>
              )}

              {/* Assigned Classes Display */}
              {assignedTo.length > 0 && (
                <div className="assigned-tags">
                  <small>Assigned to: </small>
                  {assignedTo.map((cls) => (
                    <span key={cls} className="class-tag">
                      {cls}
                    </span>
                  ))}
                </div>
              )}

              <div className="card-footer">
                <button
                  className="btn-edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(a);
                    setActiveTab("create");
                  }}
                >
                  <Edit2 size={14} /> Edit
                </button>
                <button
                  className="btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    alert("Delete functionality will be added soon.");
                  }}
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
