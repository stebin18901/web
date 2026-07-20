import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { Mail, Phone, Plus, Trash2, UserRound, Pencil } from "lucide-react";
import { db } from "../../../../firebase/firebaseConfig";
import { matchesAcademicYearScope, normalizeAcademicYear } from "../schoolYearUtils";
import "./SchoolTeachersManager.css";

const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  employeeId: "",
};

const buildCandidateIds = (schoolId, school) =>
  Array.from(new Set([normalize(schoolId), normalizeLower(schoolId), normalize(school?.schoolId), normalizeLower(school?.schoolId)].filter(Boolean)));

export default function SchoolTeachersManager({ schoolId, school, academicYear = "" }) {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const normalizedYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  const candidateSchoolIds = useMemo(() => buildCandidateIds(schoolId, school), [schoolId, school]);

  const loadTeachers = useCallback(async () => {
    if (!candidateSchoolIds.length) {
      setTeachers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snapshots = await Promise.all(
        candidateSchoolIds.map((candidateId) =>
          getDocs(query(collection(db, "users"), where("schoolId", "==", candidateId)))
        )
      );

      const seen = new Map();
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((entry) => {
          const data = entry.data() || {};
          if (!["teacher", "class_teacher"].includes(normalizeLower(data.role))) return;
          if (!matchesAcademicYearScope(data, normalizedYear)) return;
          seen.set(entry.id, { id: entry.id, ...data });
        });
      });

      setTeachers(
        Array.from(seen.values()).sort((left, right) =>
          normalize(left.name || left.email).localeCompare(normalize(right.name || right.email), undefined, {
            sensitivity: "base",
            numeric: true,
          })
        )
      );
    } catch (error) {
      console.error("Failed to load teachers", error);
      setStatusMessage("Could not load teachers right now.");
    } finally {
      setLoading(false);
    }
  }, [candidateSchoolIds, normalizedYear]);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  const filteredTeachers = useMemo(() => {
    const search = normalizeLower(searchTerm);
    if (!search) return teachers;
    return teachers.filter((teacher) =>
      [teacher.name, teacher.email, teacher.phone, teacher.subject, teacher.employeeId]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search)
    );
  }, [searchTerm, teachers]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const name = normalize(form.name);
    const email = normalizeLower(form.email);
    if (!name || !email) {
      setStatusMessage("Teacher name and email are required.");
      return;
    }

    setSaving(true);
    setStatusMessage("");
    try {
      const docRef = editingId ? doc(db, "users", editingId) : doc(collection(db, "users"));
      const payload = {
        name,
        email,
        phone: normalize(form.phone),
        subject: normalize(form.subject),
        employeeId: normalize(form.employeeId),
        role: "teacher",
        schoolId: normalizeLower(schoolId) || normalize(schoolId),
        academicYear: normalizedYear,
        academicYears: normalizedYear ? [normalizedYear] : [],
        schoolName: school?.schoolName || "",
        assignedClass: "",
        assignedClasses: [],
        updatedAt: serverTimestamp(),
      };

      await setDoc(
        docRef,
        {
          ...payload,
          ...(editingId ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true }
      );

      setStatusMessage(editingId ? "Teacher updated successfully." : "Teacher added successfully.");
      resetForm();
      await loadTeachers();
    } catch (error) {
      console.error("Failed to save teacher", error);
      setStatusMessage("Teacher could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (teacher) => {
    setEditingId(teacher.id);
    setForm({
      name: normalize(teacher.name),
      email: normalize(teacher.email),
      phone: normalize(teacher.phone),
      subject: normalize(teacher.subject),
      employeeId: normalize(teacher.employeeId),
    });
  };

  const handleDelete = async (teacher) => {
    if (!window.confirm(`Delete teacher "${teacher.name || teacher.email}"?`)) return;
    setSaving(true);
    setStatusMessage("");
    try {
      await deleteDoc(doc(db, "users", teacher.id));
      setStatusMessage("Teacher deleted successfully.");
      if (editingId === teacher.id) resetForm();
      await loadTeachers();
    } catch (error) {
      console.error("Failed to delete teacher", error);
      setStatusMessage("Teacher could not be deleted.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="school-teachers-page">
      <section className="school-teachers-hero">
        <div>
          <p className="school-teachers-kicker">School Team</p>
          <h2>Teachers</h2>
          <p>Add, edit, and review teacher records from one clean workspace inside school admin.</p>
        </div>
        <div className="school-teachers-hero-badge">
          <span>Teacher Records</span>
          <strong>{teachers.length}</strong>
        </div>
      </section>

      <div className="school-teachers-grid">
        <section className="school-teachers-card">
          <div className="school-teachers-card-head">
            <div>
              <h3>{editingId ? "Edit Teacher" : "Add Teacher"}</h3>
              <p>Keep the basic teacher profile ready for class assignment and timetable planning.</p>
            </div>
          </div>

          <form className="school-teachers-form" onSubmit={handleSubmit}>
            <label>
              <span>Full Name</span>
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </label>
            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </label>
            <label>
              <span>Phone</span>
              <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
            </label>
            <label>
              <span>Subject</span>
              <input value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} />
            </label>
            <label className="span-2">
              <span>Employee ID</span>
              <input
                value={form.employeeId}
                onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))}
              />
            </label>
            <div className="school-teachers-actions span-2">
              {editingId ? (
                <button type="button" className="school-teachers-btn ghost" onClick={resetForm}>
                  Cancel Edit
                </button>
              ) : null}
              <button type="submit" className="school-teachers-btn primary" disabled={saving}>
                <Plus size={16} />
                {saving ? "Saving..." : editingId ? "Update Teacher" : "Add Teacher"}
              </button>
            </div>
          </form>
          {statusMessage ? <p className="school-teachers-status">{statusMessage}</p> : null}
        </section>

        <section className="school-teachers-card">
          <div className="school-teachers-card-head">
            <div>
              <h3>Manage Teachers</h3>
              <p>Search through all teachers added for this school and update details any time.</p>
            </div>
          </div>

          <div className="school-teachers-search">
            <input
              type="text"
              placeholder="Search by name, email, phone, subject, or employee ID"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          {loading ? (
            <div className="school-teachers-empty">Loading teachers...</div>
          ) : !filteredTeachers.length ? (
            <div className="school-teachers-empty">No teachers found for this school yet.</div>
          ) : (
            <div className="school-teachers-list">
              {filteredTeachers.map((teacher) => (
                <article key={teacher.id} className="school-teachers-list-card">
                  <div className="school-teachers-list-top">
                    <div className="school-teachers-avatar">
                      {normalize(teacher.name || teacher.email).charAt(0).toUpperCase() || "T"}
                    </div>
                    <div className="school-teachers-meta">
                      <strong>{teacher.name || "Teacher"}</strong>
                      <span>{teacher.subject || "Subject not added"}</span>
                    </div>
                    <div className="school-teachers-tags">
                      <span className={`role ${normalizeLower(teacher.role) === "class_teacher" ? "active" : ""}`}>
                        {normalizeLower(teacher.role) === "class_teacher" ? "Class Teacher" : "Teacher"}
                      </span>
                    </div>
                  </div>

                  <div className="school-teachers-details">
                    {teacher.email ? (
                      <span>
                        <Mail size={14} />
                        {teacher.email}
                      </span>
                    ) : null}
                    {teacher.phone ? (
                      <span>
                        <Phone size={14} />
                        {teacher.phone}
                      </span>
                    ) : null}
                    {teacher.employeeId ? (
                      <span>
                        <UserRound size={14} />
                        {teacher.employeeId}
                      </span>
                    ) : null}
                    {teacher.assignedClass ? <span>Assigned class: {teacher.assignedClass}</span> : null}
                  </div>

                  <div className="school-teachers-list-actions">
                    <button type="button" className="school-teachers-btn ghost" onClick={() => handleEdit(teacher)}>
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button type="button" className="school-teachers-btn danger" onClick={() => handleDelete(teacher)}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
