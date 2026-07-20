import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  Paperclip,
  PencilLine,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { db, storage } from "../../../firebase/firebaseConfig";
import {
  normalizeClassName,
  normalizeSchoolId,
  normalizeSection,
  resolveSchoolClasses,
} from "./academicUtils";
import { normalizeAcademicYear } from "./schoolYearUtils";
import "./AcademicManagement.css";

const HOMEWORK_STATUS_OPTIONS = [
  { value: "assigned", label: "Assigned" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
];

const HOMEWORK_TYPE_OPTIONS = [
  "Written Work",
  "Worksheet",
  "Reading",
  "Project",
  "Practice Test",
  "Revision",
];

const emptyForm = {
  title: "",
  subject: "",
  className: "",
  section: "",
  dueDate: "",
  type: "Written Work",
  status: "assigned",
  instructions: "",
};

const formatClassLabel = (className, section) => {
  const normalizedClass = normalizeClassName(className);
  const normalizedSection = normalizeSection(section || "");
  if (!normalizedClass) return "Unknown class";
  if (!normalizedSection || normalizedClass.endsWith(normalizedSection)) return normalizedClass;
  return `${normalizedClass} - ${normalizedSection}`;
};

const formatDateLabel = (value) => {
  if (!value) return "No due date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function HomeworksPage({ schoolId, academicYear = "", actorName = "School Admin" }) {
  const normalizedSchoolId = useMemo(() => normalizeSchoolId(schoolId), [schoolId]);
  const normalizedAcademicYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);
  const [classes, setClasses] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({
    classKey: "all",
    status: "all",
    search: "",
  });
  const [form, setForm] = useState({
    ...emptyForm,
    className: "",
    section: "",
  });
  const fileInputRef = useRef(null);

  useEffect(() => {
    let alive = true;

    const loadClasses = async () => {
      try {
        const data = await resolveSchoolClasses(normalizedSchoolId, normalizedAcademicYear);
        if (!alive) return;
        setClasses(data);
        setForm((prev) => {
          if (prev.className) return prev;
          return {
            ...prev,
            className: data[0]?.className || "",
            section: data[0]?.section || "",
          };
        });
      } catch (error) {
        console.error("Failed to load homework classes", error);
        if (alive) {
          setToast({ type: "error", message: "Unable to load classes for homework setup." });
        }
      }
    };

    loadClasses();
    return () => {
      alive = false;
    };
  }, [normalizedAcademicYear, normalizedSchoolId]);

  useEffect(() => {
    if (!normalizedSchoolId) return undefined;

    const q = query(
      collection(db, "schools", normalizedSchoolId, "homeworks"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => !normalizedAcademicYear || normalizeAcademicYear(entry.academicYear) === normalizedAcademicYear);
        setHomeworks(rows);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to load homeworks", error);
        setToast({ type: "error", message: "Unable to load homework list right now." });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [normalizedAcademicYear, normalizedSchoolId]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredHomeworks = useMemo(() => {
    const searchTerm = String(filters.search || "").trim().toLowerCase();
    return homeworks.filter((entry) => {
      const classKey = `${normalizeClassName(entry.className)}__${normalizeSection(entry.section || "")}`;
      if (filters.classKey !== "all" && classKey !== filters.classKey) return false;
      if (filters.status !== "all" && String(entry.status || "").toLowerCase() !== filters.status) return false;
      if (!searchTerm) return true;
      const haystack = [
        entry.title,
        entry.subject,
        entry.instructions,
        entry.className,
        entry.section,
        entry.type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [filters.classKey, filters.search, filters.status, homeworks]);

  const summary = useMemo(() => {
    const assigned = filteredHomeworks.filter((entry) => entry.status === "assigned").length;
    const draft = filteredHomeworks.filter((entry) => entry.status === "draft").length;
    const completed = filteredHomeworks.filter((entry) => entry.status === "completed").length;
    return {
      total: filteredHomeworks.length,
      assigned,
      draft,
      completed,
    };
  }, [filteredHomeworks]);

  const isImageAttachment = (attachment) => {
    const type = String(attachment?.type || "").toLowerCase();
    const name = String(attachment?.name || "");
    return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  };

  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

  const handleFormChange = (field, value) => {
    if (field === "classKey") {
      const [className = "", section = ""] = String(value || "").split("__");
      setForm((prev) => ({
        ...prev,
        className: normalizeClassName(className),
        section: normalizeSection(section),
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setEditingId("");
    setAttachments([]);
    setForm({
      ...emptyForm,
      className: classes[0]?.className || "",
      section: classes[0]?.section || "",
    });
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setAttachments(Array.isArray(entry.attachments) ? entry.attachments : []);
    setForm({
      title: entry.title || "",
      subject: entry.subject || "",
      className: normalizeClassName(entry.className),
      section: normalizeSection(entry.section || ""),
      dueDate: entry.dueDate || "",
      type: entry.type || "Written Work",
      status: entry.status || "assigned",
      instructions: entry.instructions || "",
    });
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const nextFiles = files.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "",
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setAttachments((prev) => [...prev, ...nextFiles]);
    event.target.value = "";
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) =>
      prev.filter((attachment, index) => {
        if (index === indexToRemove && attachment?.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
        return index !== indexToRemove;
      })
    );
  };

  const uploadAttachment = async (attachment) => {
    if (!attachment?.file) {
      const existingUrl =
        attachment?.url && !String(attachment.url).startsWith("blob:")
          ? attachment.url
          : "";

      return existingUrl
        ? {
            name: attachment?.name || "Attachment",
            size: attachment?.size || 0,
            type: attachment?.type || "",
            url: existingUrl,
            storagePath: attachment?.storagePath || "",
          }
        : null;
    }

    const safeName = String(attachment.file.name || "homework-file").replace(/\s+/g, "_");
    const storagePath = `homeworks/${normalizedSchoolId}/${Date.now()}_${safeName}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, attachment.file);
    const url = await getDownloadURL(fileRef);

    return {
      name: attachment.file.name,
      size: attachment.file.size,
      type: attachment.file.type || "",
      url,
      storagePath,
    };
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this homework item?")) return;
    try {
      await deleteDoc(doc(db, "schools", normalizedSchoolId, "homeworks", id));
      if (editingId === id) resetForm();
      setToast({ type: "success", message: "Homework deleted." });
    } catch (error) {
      console.error("Failed to delete homework", error);
      setToast({ type: "error", message: "Unable to delete homework." });
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.subject.trim() || !form.className) {
      setToast({ type: "error", message: "Add title, subject, and class before saving homework." });
      return;
    }

    const payload = {
      schoolId: normalizedSchoolId,
      academicYear: normalizedAcademicYear,
      title: form.title.trim(),
      subject: form.subject.trim(),
      className: normalizeClassName(form.className),
      section: normalizeSection(form.section || ""),
      dueDate: form.dueDate || "",
      type: form.type,
      status: form.status,
      instructions: form.instructions.trim(),
      updatedAt: serverTimestamp(),
      updatedBy: actorName,
    };

    setSaving(true);
    try {
      const uploadedAttachments = (
        await Promise.all(attachments.map((attachment) => uploadAttachment(attachment)))
      ).filter(Boolean);

      if (editingId) {
        await updateDoc(doc(db, "schools", normalizedSchoolId, "homeworks", editingId), {
          ...payload,
          attachments: uploadedAttachments,
        });
        setToast({ type: "success", message: "Homework updated." });
      } else {
        await addDoc(collection(db, "schools", normalizedSchoolId, "homeworks"), {
          ...payload,
          attachments: uploadedAttachments,
          createdAt: serverTimestamp(),
          createdBy: actorName,
        });
        setToast({ type: "success", message: "Homework assigned successfully." });
      }
      resetForm();
    } catch (error) {
      console.error("Failed to save homework", error);
      setToast({ type: "error", message: "Unable to save homework right now." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="academic-page">
      {toast ? <div className={`academic-toast ${toast.type}`}>{toast.message}</div> : null}

      <section className="academic-card">
        <div className="academic-card-head">
          <div>
            <h3>{editingId ? "Edit Homework" : "Assign Homework"}</h3>
            <p>Create year-specific homework plans for each class and keep all issued work in one list.</p>
          </div>
        </div>

        <form className="academic-homework-form" onSubmit={handleSubmit}>
          <div className="academic-filter-grid">
            <div className="academic-field">
              <label>Title</label>
              <input
                className="academic-input"
                value={form.title}
                onChange={(event) => handleFormChange("title", event.target.value)}
                placeholder="Homework title"
              />
            </div>
            <div className="academic-field">
              <label>Subject</label>
              <input
                className="academic-input"
                value={form.subject}
                onChange={(event) => handleFormChange("subject", event.target.value)}
                placeholder="Subject"
              />
            </div>
            <div className="academic-field">
              <label>Class</label>
              <select
                className="academic-select"
                value={`${form.className}__${form.section}`}
                onChange={(event) => handleFormChange("classKey", event.target.value)}
              >
                {classes.map((entry) => (
                  <option
                    key={`${entry.className}__${entry.section}`}
                    value={`${entry.className}__${entry.section}`}
                  >
                    {formatClassLabel(entry.className, entry.section)}
                  </option>
                ))}
              </select>
            </div>
            <div className="academic-field">
              <label>Due Date</label>
              <input
                type="date"
                className="academic-input"
                value={form.dueDate}
                onChange={(event) => handleFormChange("dueDate", event.target.value)}
              />
            </div>
            <div className="academic-field">
              <label>Status</label>
              <select
                className="academic-select"
                value={form.status}
                onChange={(event) => handleFormChange("status", event.target.value)}
              >
                {HOMEWORK_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="academic-filter-grid compact academic-homework-form-secondary">
            <div className="academic-field">
              <label>Homework Type</label>
              <select
                className="academic-select"
                value={form.type}
                onChange={(event) => handleFormChange("type", event.target.value)}
              >
                {HOMEWORK_TYPE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="academic-field">
            <label>Instructions</label>
            <textarea
              rows={5}
              className="academic-textarea"
              value={form.instructions}
              onChange={(event) => handleFormChange("instructions", event.target.value)}
              placeholder="Add the actual homework instructions, exercises, chapters, or submission notes."
            />
          </div>

          <div className="academic-field">
            <label>Attachments</label>
            <div className="academic-homework-upload-bar">
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="academic-btn-ghost"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={16} />
                Upload Images / PDFs
              </button>
              <span className="academic-homework-upload-note">
                Attach worksheets, question papers, reference images, or PDF instructions.
              </span>
            </div>

            {imageAttachments.length ? (
              <div className="academic-homework-attachment-grid">
                {attachments.map((attachment, index) =>
                  isImageAttachment(attachment) ? (
                    <div key={`${attachment.name}-${index}`} className="academic-homework-attachment-card">
                      <img
                        src={attachment.url || attachment.previewUrl}
                        alt={attachment.name}
                        className="academic-homework-attachment-image"
                      />
                      <div className="academic-homework-attachment-meta">
                        <span>{attachment.name}</span>
                        <button
                          type="button"
                          className="academic-btn-ghost academic-homework-remove-btn"
                          onClick={() => handleRemoveAttachment(index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            ) : null}

            {fileAttachments.length ? (
              <div className="academic-homework-file-list">
                {attachments.map((attachment, index) =>
                  !isImageAttachment(attachment) ? (
                    <div key={`${attachment.name}-${index}`} className="academic-homework-file-item">
                      <div className="academic-homework-file-main">
                        <Paperclip size={14} />
                        <a href={attachment.url || attachment.previewUrl} target="_blank" rel="noreferrer">
                          {attachment.name}
                        </a>
                      </div>
                      <button
                        type="button"
                        className="academic-btn-ghost academic-homework-remove-btn"
                        onClick={() => handleRemoveAttachment(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null
                )}
              </div>
            ) : null}
          </div>

          <div className="academic-actions">
            <button type="submit" className="academic-btn" disabled={saving}>
              {editingId ? <Save size={16} /> : <Plus size={16} />}
              {saving ? "Saving..." : editingId ? "Update Homework" : "Assign Homework"}
            </button>
            {editingId ? (
              <button type="button" className="academic-btn-ghost" onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>

      <section className="academic-summary-grid">
        <div className="academic-summary-card">
          <span>Total Visible</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="academic-summary-card">
          <span>Assigned</span>
          <strong>{summary.assigned}</strong>
        </div>
        <div className="academic-summary-card">
          <span>Draft</span>
          <strong>{summary.draft}</strong>
        </div>
        <div className="academic-summary-card">
          <span>Completed</span>
          <strong>{summary.completed}</strong>
        </div>
      </section>

      <section className="academic-card">
        <div className="academic-card-head">
          <div>
            <h3>Given Homeworks</h3>
            <p>Review all homework items issued for the selected academic year, then filter by class or status.</p>
          </div>
        </div>

        <div className="academic-filter-grid compact academic-homework-filters">
          <div className="academic-field">
            <label>Class Filter</label>
            <select
              className="academic-select"
              value={filters.classKey}
              onChange={(event) => setFilters((prev) => ({ ...prev, classKey: event.target.value }))}
            >
              <option value="all">All classes</option>
              {classes.map((entry) => (
                <option
                  key={`${entry.className}__${entry.section}`}
                  value={`${entry.className}__${entry.section}`}
                >
                  {formatClassLabel(entry.className, entry.section)}
                </option>
              ))}
            </select>
          </div>
          <div className="academic-field">
            <label>Status Filter</label>
            <select
              className="academic-select"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="all">All statuses</option>
              {HOMEWORK_STATUS_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="academic-field academic-homework-search">
            <label>Search</label>
            <input
              className="academic-input"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search title, subject, instructions..."
            />
          </div>
        </div>

        {loading ? (
          <div className="academic-empty-state">Loading homework list...</div>
        ) : filteredHomeworks.length ? (
          <div className="academic-homework-list">
            {filteredHomeworks.map((entry) => (
              <article key={entry.id} className="academic-homework-item">
                <div className="academic-homework-item-head">
                  <div>
                    <div className="academic-homework-title-row">
                      <h4>{entry.title || "Untitled Homework"}</h4>
                      <span className={`academic-status-chip ${String(entry.status || "assigned").toLowerCase()}`}>
                        {String(entry.status || "assigned").replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="academic-homework-meta">
                      <span><BookOpen size={14} /> {entry.subject || "General"}</span>
                      <span><ClipboardList size={14} /> {entry.type || "Homework"}</span>
                      <span><CalendarDays size={14} /> {formatDateLabel(entry.dueDate)}</span>
                    </div>
                  </div>
                  <div className="academic-subject-actions">
                    <button type="button" className="academic-icon-btn" onClick={() => handleEdit(entry)} aria-label="Edit homework">
                      <PencilLine size={16} />
                    </button>
                    <button
                      type="button"
                      className="academic-icon-btn academic-icon-btn-danger"
                      onClick={() => handleDelete(entry.id)}
                      aria-label="Delete homework"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="academic-homework-class-row">
                  <span>{formatClassLabel(entry.className, entry.section)}</span>
                  <span>{entry.academicYear || normalizedAcademicYear || "Academic year not set"}</span>
                </div>

                <p className="academic-homework-instructions">
                  {entry.instructions || "No instructions added for this homework item yet."}
                </p>

                {Array.isArray(entry.attachments) && entry.attachments.length ? (
                  <div className="academic-homework-saved-files">
                    {entry.attachments.map((attachment, index) => (
                      <a
                        key={`${attachment.url || attachment.name}-${index}`}
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                        className="academic-homework-saved-file"
                      >
                        <Paperclip size={14} />
                        <span>{attachment.name || `Attachment ${index + 1}`}</span>
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="academic-empty-state">
            No homework items found for the current filters.
          </div>
        )}
      </section>
    </div>
  );
}
