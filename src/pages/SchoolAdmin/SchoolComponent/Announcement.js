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
import { db } from "../../../firebase/firebaseConfig";
import {
  Upload,
  Send,
  Trash2,
  Edit3,
  Paperclip,
  Users,
  Loader2,
  X,
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

  const fileInputRef = useRef(null);

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
        url: URL.createObjectURL(f),
      }));
      setAttachments((prev) => [...prev, ...newFiles]);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !message.trim()) {
      alert("Please fill in title and message.");
      return;
    }
    const data = {
      title,
      message,
      audience,
      attachments,
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

              {attachments.length > 0 && (
                <div className="ann-attach-list">
                  {attachments.map((f, i) => (
                    <div key={i} className="ann-file-item">
                      <Paperclip size={13} />
                      <a href={f.url} target="_blank" rel="noreferrer">
                        {f.name}
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="ann-actions">
              <button className="ann-btn-primary" onClick={handleSave}>
                <Send size={15} /> {selected ? "Update" : "Publish"}
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
