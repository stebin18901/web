import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import "./AnnouncementGmailView.css";

export default function AnnouncementGmailView({ schoolId, teacher }) {
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("all");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef(null);

  const isImageAttachment = (attachment) => {
    const type = String(attachment?.type || "").toLowerCase();
    const name = String(attachment?.name || "");
    return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);
  };

  const imageAttachments = attachments.filter(isImageAttachment);
  const fileAttachments = attachments.filter((attachment) => !isImageAttachment(attachment));

  // Load announcements
  useEffect(() => {
    const q = query(
      collection(db, "announcements"),
      where("schoolId", "==", schoolId),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAnnouncements(data);
      setLoading(false);
    });
    return () => unsub();
  }, [schoolId]);

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setAudience("all");
    setAttachments([]);
    setSelected(null);
    setCreating(true);
  };

  const handleSelect = (a) => {
    setSelected(a);
    setTitle(a.title);
    setMessage(a.message);
    setAudience(a.audience);
    setAttachments(a.attachments || []);
    setCreating(false);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) {
      const newFiles = files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type || "",
        file: f,
        previewUrl: URL.createObjectURL(f),
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
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

      const data = {
        title,
        message,
        audience,
        attachments: uploadedAttachments.filter((attachment) => attachment.url),
        imageUrl: firstImage?.url || "",
        schoolId,
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
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="ann-view-container">
      {/* LEFT SIDE */}
      <aside className="ann-sidebar">
        <div className="ann-sidebar-header">
          <h2>📢 Announcements</h2>
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
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`ann-item ${
                  selected?.id === a.id ? "active" : ""
                }`}
                onClick={() => handleSelect(a)}
              >
                <div className="ann-item-top">
                  <h4 className="ann-item-title">{a.title}</h4>
                  <span className="aud-tag">{a.audience}</span>
                </div>
                <p className="ann-item-msg">
                  {a.message.length > 70
                    ? a.message.slice(0, 70) + "..."
                    : a.message}
                </p>
                <small className="ann-item-time">
                  {formatDate(a.createdAt)}
                </small>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* RIGHT SIDE */}
      <section1 className="ann-detail">
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

            <div className="ann-field-row">
              <label>Send to:</label>
              <select
                className="ann-select"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">All</option>
                <option value="parents">Parents</option>
                <option value="teachers">Teachers</option>
                <option value="both">Parents & Teachers</option>
              </select>
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
                onClick={() => fileInputRef.current.click()}
              >
                <Upload size={15} /> Add Files
              </button>

              {imageAttachments.length > 0 && (
                <div className="ann-inline-media">
                  <div className="ann-inline-media-head">
                    <span>
                      <ImagePlus size={15} /> Inline images in body
                    </span>
                    <small>{imageAttachments.length} image{imageAttachments.length > 1 ? "s" : ""}</small>
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
                <span className="aud-tag">{audience}</span>
              </div>

              <div className="ann-mail-preview-body">
                {(message || "Your message will appear here.")
                  .split("\n")
                  .filter((line, index, arr) => line.trim() || arr.length === 1)
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
      </section1>
    </div>
  );
}
