import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../../../firebase/firebaseConfig";
import {
  Upload,
  Send,
  Trash2,
  Paperclip,
  Users,
  Loader2,
  X,
  ImagePlus,
  GraduationCap,
  UserRound,
} from "lucide-react";
import {
  loadStudentsForClass,
  normalizeClassName,
  normalizeSection,
  resolveSchoolClasses,
} from "./academicUtils";
import { normalizeAcademicYear } from "./schoolYearUtils";
import "./AnnouncementGmailView.css";

const TARGET_TABS = [
  { key: "all", label: "Whole School", icon: Users },
  { key: "teachers", label: "Teachers", icon: GraduationCap },
  { key: "class", label: "Single Class", icon: Users },
  { key: "parents", label: "Parents", icon: UserRound },
];

const buildClassKey = (className, section) =>
  `${normalizeClassName(className)}__${normalizeSection(section || "")}`;

const parseClassKey = (value) => {
  const [className = "", section = ""] = String(value || "").split("__");
  return {
    className: normalizeClassName(className),
    section: normalizeSection(section),
  };
};

const formatClassLabel = (className, section) => {
  const normalizedClass = normalizeClassName(className);
  const normalizedSection = normalizeSection(section);
  if (!normalizedClass) return "Unknown class";
  if (!normalizedSection) return normalizedClass;
  if (normalizedClass.endsWith(normalizedSection)) return normalizedClass;
  return `${normalizedClass} - ${normalizedSection}`;
};

const getModeFromAnnouncement = (item = {}) => {
  const explicitMode = String(item.targetMode || "").trim().toLowerCase();
  if (explicitMode) return explicitMode;

  const audience = String(item.audience || "all").trim().toLowerCase();
  if (audience === "teachers") return "teachers";
  if (audience === "parents") return "parents";
  if (audience === "class") return "class";
  return "all";
};

const buildTargetLabel = ({ targetMode, className, section, selectedStudents = [] }) => {
  if (targetMode === "teachers") return "Teachers";
  if (targetMode === "class") return `Class ${formatClassLabel(className, section)}`;
  if (targetMode === "parents") {
    const classLabel = formatClassLabel(className, section);
    if (!selectedStudents.length) return `Parents - ${classLabel}`;
    if (selectedStudents.length === 1) return `Parent - ${selectedStudents[0].fullName || selectedStudents[0].studentId}`;
    return `${selectedStudents.length} Parents - ${classLabel}`;
  }
  return "Whole School";
};

export default function AnnouncementGmailView({ schoolId, academicYear = "" }) {
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetMode, setTargetMode] = useState("all");
  const [classOptions, setClassOptions] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [classStudents, setClassStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const normalizedAcademicYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  const fileInputRef = useRef(null);

  const selectedClassMeta = useMemo(() => parseClassKey(selectedClassKey), [selectedClassKey]);
  const selectedStudents = useMemo(
    () => classStudents.filter((student) => selectedStudentIds.includes(student.studentId)),
    [classStudents, selectedStudentIds]
  );
  const allParentsSelected = Boolean(classStudents.length) && selectedStudentIds.length === classStudents.length;

  const isImageAttachment = (attachment) => {
    const type = String(attachment?.type || "").toLowerCase();
    const name = String(attachment?.name || "");
    return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  };

  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

  useEffect(() => {
    let alive = true;

    const loadClasses = async () => {
      setClassesLoading(true);
      try {
        const data = await resolveSchoolClasses(schoolId, normalizedAcademicYear);
        if (!alive) return;
        setClassOptions(
          data.map((entry) => ({
            ...entry,
            key: buildClassKey(entry.className, entry.section),
            label: formatClassLabel(entry.className, entry.section),
          }))
        );
      } catch (error) {
        console.error("Failed to load classes for announcements", error);
      } finally {
        if (alive) setClassesLoading(false);
      }
    };

    if (schoolId) loadClasses();
    return () => {
      alive = false;
    };
  }, [normalizedAcademicYear, schoolId]);

  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((entry) => !normalizedAcademicYear || normalizeAcademicYear(entry.academicYear) === normalizedAcademicYear);
      setAnnouncements(data);
      setLoading(false);
    });
    return () => unsub();
  }, [normalizedAcademicYear, schoolId]);

  useEffect(() => {
    let alive = true;

    const loadStudents = async () => {
      if (!schoolId || !selectedClassMeta.className || !["class", "parents"].includes(targetMode)) {
        setClassStudents([]);
        if (targetMode !== "parents") setSelectedStudentIds([]);
        return;
      }

      setStudentsLoading(true);
      try {
        const rows = await loadStudentsForClass({
          schoolId,
          className: selectedClassMeta.className,
          section: selectedClassMeta.section,
          academicYear: normalizedAcademicYear,
        });
        if (!alive) return;
        setClassStudents(rows);
        setSelectedStudentIds((prev) => prev.filter((id) => rows.some((student) => student.studentId === id)));
      } catch (error) {
        console.error("Failed to load class students for announcement", error);
        if (alive) {
          setClassStudents([]);
          setSelectedStudentIds([]);
        }
      } finally {
        if (alive) setStudentsLoading(false);
      }
    };

    loadStudents();
    return () => {
      alive = false;
    };
  }, [normalizedAcademicYear, schoolId, selectedClassMeta.className, selectedClassMeta.section, targetMode]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setTargetMode("all");
    setSelectedClassKey("");
    setClassStudents([]);
    setSelectedStudentIds([]);
    setAttachments([]);
    setSelected(null);
    setCreating(true);
  };

  const handleTargetModeChange = (nextMode) => {
    setTargetMode(nextMode);
    if (!["class", "parents"].includes(nextMode)) {
      setSelectedClassKey("");
      setClassStudents([]);
      setSelectedStudentIds([]);
    } else if (nextMode === "class") {
      setSelectedStudentIds([]);
    }
  };

  const handleSelect = (announcement) => {
    const mode = getModeFromAnnouncement(announcement);
    setSelected(announcement);
    setTitle(announcement.title || "");
    setMessage(announcement.message || "");
    setTargetMode(mode);
    setSelectedClassKey(
      announcement.targetClassName
        ? buildClassKey(announcement.targetClassName, announcement.targetSection)
        : ""
    );
    setSelectedStudentIds(Array.isArray(announcement.targetStudentIds) ? announcement.targetStudentIds : []);
    setAttachments(announcement.attachments || []);
    setCreating(false);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      const newFiles = files.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type || "",
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const uploadAttachment = async (attachment) => {
    if (!attachment?.file) {
      const existingUrl =
        attachment?.url && !String(attachment.url).startsWith("blob:")
          ? attachment.url
          : "";
      return {
        name: attachment?.name || "Attachment",
        size: attachment?.size || 0,
        type: attachment?.type || "",
        url: existingUrl,
      };
    }

    const safeName = String(attachment.file.name || "attachment").replace(/\s+/g, "_");
    const storagePath = `announcements/${schoolId}/${Date.now()}_${safeName}`;
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

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please fill in title and message.");
      return;
    }

    if (targetMode === "class" && !selectedClassMeta.className) {
      alert("Please choose a class for this announcement.");
      return;
    }

    if (targetMode === "parents") {
      if (!selectedClassMeta.className) {
        alert("Please choose a class before selecting parents.");
        return;
      }
      if (!selectedStudentIds.length) {
        alert("Please select at least one student to notify that parent.");
        return;
      }
    }

    setUploading(true);
    try {
      const uploadedAttachments = await Promise.all(
        attachments.map((attachment) => uploadAttachment(attachment))
      );

      const firstImage =
        uploadedAttachments.find((attachment) =>
          String(attachment.type || "").toLowerCase().startsWith("image/")
        ) ||
        uploadedAttachments.find((attachment) =>
          /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(attachment.name || ""))
        ) ||
        null;

      const targetStudentsPayload = selectedStudents.map((student) => ({
        studentId: student.studentId,
        fullName: student.fullName,
        rollNumber: student.rollNumber,
        className: student.className || selectedClassMeta.className,
        section: student.section || selectedClassMeta.section,
      }));

      const targetLabel = buildTargetLabel({
        targetMode,
        className: selectedClassMeta.className,
        section: selectedClassMeta.section,
        selectedStudents: targetStudentsPayload,
      });

      const data = {
        title: title.trim(),
        message: message.trim(),
        audience:
          targetMode === "teachers"
            ? "teachers"
            : targetMode === "parents"
              ? "parents"
              : targetMode === "class"
                ? "class"
                : "all",
        targetMode,
        targetLabel,
        targetClassName: ["class", "parents"].includes(targetMode) ? selectedClassMeta.className : "",
        targetSection: ["class", "parents"].includes(targetMode) ? selectedClassMeta.section : "",
        targetStudentIds: targetMode === "parents" ? selectedStudentIds : [],
        targetStudents: targetMode === "parents" ? targetStudentsPayload : [],
        attachments: uploadedAttachments.filter((attachment) => attachment.url),
        imageUrl: firstImage?.url || "",
        schoolId,
        academicYear: normalizedAcademicYear,
        updatedAt: serverTimestamp(),
      };

      if (selected) {
        await updateDoc(doc(db, "announcements", selected.id), data);
      } else {
        await addDoc(collection(db, "announcements"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
    } catch (error) {
      console.error("Failed to save announcement", error);
      alert("Announcement could not be saved. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this announcement?")) return;
    await deleteDoc(doc(db, "announcements", id));
    if (selected?.id === id) setSelected(null);
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const previewTargetLabel = buildTargetLabel({
    targetMode,
    className: selectedClassMeta.className,
    section: selectedClassMeta.section,
    selectedStudents,
  });

  return (
    <div className="ann-view-container">
      <aside className="ann-sidebar">
        <div className="ann-sidebar-header">
          <h2>Announcements</h2>
          <button className="ann-btn-primary" onClick={resetForm}>
            + New
          </button>
        </div>

        {loading ? (
          <div className="ann-loading">
            <Loader2 className="spin" /> Loading...
          </div>
        ) : announcements.length === 0 ? (
          <div className="ann-empty">No announcements yet</div>
        ) : (
          <div className="ann-list">
            {announcements.map((announcement) => (
              <div
                key={announcement.id}
                className={`ann-item ${selected?.id === announcement.id ? "active" : ""}`}
                onClick={() => handleSelect(announcement)}
              >
                <div className="ann-item-top">
                  <h4 className="ann-item-title">{announcement.title}</h4>
                  <span className="aud-tag">
                    {announcement.targetLabel || announcement.audience || "all"}
                  </span>
                </div>
                <p className="ann-item-msg">
                  {announcement.message?.length > 70
                    ? `${announcement.message.slice(0, 70)}...`
                    : announcement.message}
                </p>
                <small className="ann-item-time">{formatDate(announcement.createdAt)}</small>
              </div>
            ))}
          </div>
        )}
      </aside>

      <section className="ann-detail">
        {!selected && !creating && (
          <div className="ann-placeholder">
            <Users size={42} />
            <p>Select or create an announcement</p>
          </div>
        )}

        {(selected || creating) && (
          <div className="ann-form">
            <div className="ann-form-header">
              <h3>{selected ? "Edit Announcement" : "New Announcement"}</h3>
              {selected && (
                <button
                  className="ann-btn-icon"
                  title="Close"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <input
              className="ann-input"
              placeholder="Title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="ann-textarea"
              placeholder="Write message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className="ann-target-panel">
              <div className="ann-target-head">
                <label>Send to</label>
                <span>{previewTargetLabel}</span>
              </div>

              <div className="ann-target-tabs">
                {TARGET_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={`ann-target-tab ${targetMode === tab.key ? "active" : ""}`}
                      onClick={() => handleTargetModeChange(tab.key)}
                    >
                      <Icon size={15} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {["class", "parents"].includes(targetMode) && (
                <div className="ann-target-card">
                  <div className="ann-target-card-head">
                    <label htmlFor="announcement-class-target">Choose class</label>
                    {classesLoading ? <small>Loading classes...</small> : null}
                  </div>
                  <select
                    id="announcement-class-target"
                    className="ann-select"
                    value={selectedClassKey}
                    onChange={(e) => {
                      setSelectedClassKey(e.target.value);
                      setSelectedStudentIds([]);
                    }}
                  >
                    <option value="">Select class</option>
                    {classOptions.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetMode === "parents" && selectedClassKey && (
                <div className="ann-target-card">
                  <div className="ann-target-card-head">
                    <label>Select parents by student</label>
                    <div className="ann-target-actions-inline">
                      <button
                        type="button"
                        className="ann-chip-btn"
                        onClick={() => setSelectedStudentIds(classStudents.map((student) => student.studentId))}
                        disabled={!classStudents.length}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="ann-chip-btn"
                        onClick={() => setSelectedStudentIds([])}
                        disabled={!selectedStudentIds.length}
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {studentsLoading ? (
                    <div className="ann-target-empty">
                      <Loader2 className="spin" size={16} /> Loading students...
                    </div>
                  ) : !classStudents.length ? (
                    <div className="ann-target-empty">
                      No students found in this class yet.
                    </div>
                  ) : (
                    <>
                      <p className="ann-target-helper">
                        {allParentsSelected
                          ? `All parents in ${formatClassLabel(
                              selectedClassMeta.className,
                              selectedClassMeta.section
                            )} will receive this announcement.`
                          : "Choose one or more students. Their linked parent accounts will receive this announcement."}
                      </p>
                      <div className="ann-student-grid">
                        {classStudents.map((student) => {
                          const isChecked = selectedStudentIds.includes(student.studentId);
                          return (
                            <button
                              key={student.studentId}
                              type="button"
                              className={`ann-student-card ${isChecked ? "selected" : ""}`}
                              onClick={() => toggleStudentSelection(student.studentId)}
                            >
                              <div>
                                <strong>{student.fullName || "Student"}</strong>
                                <span>Roll {student.rollNumber || "-"}</span>
                              </div>
                              <input type="checkbox" readOnly checked={isChecked} />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="ann-attachments">
              <label>
                <Paperclip size={15} /> Attach Files
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                onChange={handleFileChange}
              />
              <button
                className="ann-btn-outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={15} /> Add Files
              </button>

              {imageAttachments.length > 0 && (
                <div className="ann-inline-media">
                  <div className="ann-inline-media-head">
                    <span>
                      <ImagePlus size={15} /> Inline images in body
                    </span>
                    <small>
                      {imageAttachments.length} image{imageAttachments.length > 1 ? "s" : ""}
                    </small>
                  </div>
                  <div className="ann-inline-media-grid">
                    {attachments.map((file, index) =>
                      isImageAttachment(file) ? (
                        <div key={`${file.name}-${index}`} className="ann-inline-media-card">
                          <img
                            src={file.url || file.previewUrl}
                            alt={file.name}
                            className="ann-inline-media-image"
                          />
                          <div className="ann-inline-media-meta">
                            <span>{file.name}</span>
                            <button
                              type="button"
                              className="ann-chip-btn"
                              onClick={() => handleRemoveAttachment(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {fileAttachments.length > 0 && (
                <div className="ann-attach-list">
                  {attachments.map((file, index) =>
                    !isImageAttachment(file) ? (
                      <div key={`${file.name}-${index}`} className="ann-file-item">
                        <div className="ann-file-main">
                          <Paperclip size={13} />
                          <a href={file.url || file.previewUrl} target="_blank" rel="noreferrer">
                            {file.name}
                          </a>
                        </div>
                        <button
                          type="button"
                          className="ann-chip-btn"
                          onClick={() => handleRemoveAttachment(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            </div>

            <div className="ann-mail-preview">
              <div className="ann-mail-preview-head">
                <div>
                  <p className="ann-preview-label">Message Preview</p>
                  <h4>{title || "Untitled announcement"}</h4>
                </div>
                <span className="aud-tag">{previewTargetLabel}</span>
              </div>

              <div className="ann-mail-preview-body">
                {(message || "Your message will appear here.")
                  .split("\n")
                  .filter((line, index, lines) => line.trim() || lines.length === 1)
                  .map((line, index) => (
                    <p key={`${line}-${index}`}>{line || "\u00A0"}</p>
                  ))}

                {imageAttachments.length > 0 && (
                  <div className="ann-preview-image-stack">
                    {imageAttachments.map((file, index) => (
                      <img
                        key={`${file.name}-${index}`}
                        src={file.url || file.previewUrl}
                        alt={file.name}
                        className="ann-preview-body-image"
                      />
                    ))}
                  </div>
                )}

                {fileAttachments.length > 0 && (
                  <div className="ann-preview-files">
                    {fileAttachments.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="ann-preview-file-chip">
                        <Paperclip size={12} />
                        <span>{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ann-actions">
              <button
                className="ann-btn-primary"
                onClick={handleSave}
                disabled={uploading}
              >
                <Send size={15} /> {uploading ? "Uploading..." : selected ? "Update" : "Publish"}
              </button>
              {selected && (
                <button
                  className="ann-btn-danger"
                  onClick={() => handleDelete(selected.id)}
                >
                  <Trash2 size={15} /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
