import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import "./AdminNotifications.css";

const initialDraft = {
  title: "",
  summary: "",
  message: "",
  imageUrl: "",
  tone: "general",
  schoolId: "",
  schoolName: "",
  ctaLabel: "",
  ctaLink: "",
  pinned: false,
  active: true,
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export default function AdminNotifications() {
  const [draft, setDraft] = useState(initialDraft);
  const [items, setItems] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const loadNotifications = async () => {
    const snap = await getDocs(collection(db, "adminNotifications"));
    const nextItems = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => {
        if (Boolean(b.pinned) !== Boolean(a.pinned)) return Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        return toMillis(b.updatedAt || b.createdAt) - toMillis(a.updatedAt || a.createdAt);
      });
    setItems(nextItems);
  };

  useEffect(() => {
    loadNotifications().catch((error) => {
      console.error("Failed to load admin notifications:", error);
      setStatus("Unable to load notifications right now.");
    });
  }, []);

  const activeCount = useMemo(
    () => items.filter((item) => item.active !== false).length,
    [items]
  );

  const resetDraft = () => {
    setDraft(initialDraft);
    setEditingId("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.message.trim()) {
      setStatus("Title and full message are required.");
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      const payload = {
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        message: draft.message.trim(),
        imageUrl: draft.imageUrl.trim(),
        tone: draft.tone,
        schoolId: draft.schoolId.trim().toLowerCase(),
        schoolName: draft.schoolName.trim(),
        ctaLabel: draft.ctaLabel.trim(),
        ctaLink: draft.ctaLink.trim(),
        pinned: draft.pinned === true,
        active: draft.active !== false,
        updatedAt: serverTimestamp(),
        createdBy: "admin189201",
      };

      if (editingId) {
        await updateDoc(doc(db, "adminNotifications", editingId), payload);
        setStatus("Notification updated.");
      } else {
        await addDoc(collection(db, "adminNotifications"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setStatus("Notification published.");
      }

      await loadNotifications();
      resetDraft();
    } catch (error) {
      console.error("Failed to save notification:", error);
      setStatus("Failed to save notification.");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = (item) => {
    setDraft({
      title: item.title || "",
      summary: item.summary || "",
      message: item.message || "",
      imageUrl: item.imageUrl || "",
      tone: item.tone || "general",
      schoolId: item.schoolId || "",
      schoolName: item.schoolName || "",
      ctaLabel: item.ctaLabel || "",
      ctaLink: item.ctaLink || "",
      pinned: item.pinned === true,
      active: item.active !== false,
    });
    setEditingId(item.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleActive = async (item) => {
    setBusy(true);
    try {
      await updateDoc(doc(db, "adminNotifications", item.id), {
        active: item.active === false,
        updatedAt: serverTimestamp(),
      });
      await loadNotifications();
      setStatus(item.active === false ? "Notification activated." : "Notification paused.");
    } catch (error) {
      console.error("Failed to toggle notification status:", error);
      setStatus("Could not update notification status.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notification?")) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, "adminNotifications", id));
      await loadNotifications();
      if (editingId === id) resetDraft();
      setStatus("Notification deleted.");
    } catch (error) {
      console.error("Failed to delete notification:", error);
      setStatus("Could not delete notification.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-notifications-page">
      <section className="admin-notifications-hero">
        <div>
          <p className="admin-notifications-kicker">Dashboard Notifications</p>
          <h1>Push notices, updates, images, and banners straight into the student dashboard.</h1>
          <p>Use this space for school announcements, new feature drops, fantasy league alerts, and update cards.</p>
        </div>
        <div className="admin-notifications-stats">
          <div>
            <span>Live</span>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <span>Total</span>
            <strong>{items.length}</strong>
          </div>
        </div>
      </section>

      <div className="admin-notifications-grid">
        <form className="admin-notifications-form" onSubmit={handleSubmit}>
          <div className="admin-notifications-form-head">
            <h2>{editingId ? "Edit notification" : "Create notification"}</h2>
            {editingId ? (
              <button type="button" className="admin-notifications-secondary" onClick={resetDraft}>
                Cancel Edit
              </button>
            ) : null}
          </div>

          <div className="admin-notifications-fields">
            <label>
              <span>Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="New fantasy league is live"
              />
            </label>
            <label>
              <span>Summary</span>
              <input
                value={draft.summary}
                onChange={(event) => setDraft((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Short line for sidebar preview"
              />
            </label>
            <label className="full">
              <span>Message</span>
              <textarea
                value={draft.message}
                onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
                placeholder="Full notification body for the student updates feed"
                rows={6}
              />
            </label>
            <label>
              <span>Image URL</span>
              <input
                value={draft.imageUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, imageUrl: event.target.value }))}
                placeholder="https://..."
              />
            </label>
            <label>
              <span>Tone</span>
              <select
                value={draft.tone}
                onChange={(event) => setDraft((prev) => ({ ...prev, tone: event.target.value }))}
              >
                <option value="general">General</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="feature">Feature</option>
                <option value="league">League</option>
              </select>
            </label>
            <label>
              <span>Target School ID</span>
              <input
                value={draft.schoolId}
                onChange={(event) => setDraft((prev) => ({ ...prev, schoolId: event.target.value }))}
                placeholder="Leave blank for all schools"
              />
            </label>
            <label>
              <span>Target School Name</span>
              <input
                value={draft.schoolName}
                onChange={(event) => setDraft((prev) => ({ ...prev, schoolName: event.target.value }))}
                placeholder="Optional label for admin clarity"
              />
            </label>
            <label>
              <span>CTA Label</span>
              <input
                value={draft.ctaLabel}
                onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: event.target.value }))}
                placeholder="Open Fantasy League"
              />
            </label>
            <label className="full">
              <span>CTA Link</span>
              <input
                value={draft.ctaLink}
                onChange={(event) => setDraft((prev) => ({ ...prev, ctaLink: event.target.value }))}
                placeholder="/league/fantasy"
              />
            </label>
          </div>

          <div className="admin-notifications-toggles">
            <label>
              <input
                type="checkbox"
                checked={draft.pinned}
                onChange={(event) => setDraft((prev) => ({ ...prev, pinned: event.target.checked }))}
              />
              Pin to top
            </label>
            <label>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((prev) => ({ ...prev, active: event.target.checked }))}
              />
              Active now
            </label>
          </div>

          {status ? <p className="admin-notifications-status">{status}</p> : null}

          <button type="submit" className="admin-notifications-primary" disabled={busy}>
            {editingId ? "Update Notification" : "Publish Notification"}
          </button>
        </form>

        <section className="admin-notifications-list">
          <div className="admin-notifications-form-head">
            <h2>Published notifications</h2>
          </div>

          <div className="admin-notifications-cards">
            {items.map((item) => (
              <article key={item.id} className={`admin-notification-card tone-${item.tone || "general"}`}>
                <div className="admin-notification-card-head">
                  <div>
                    <strong>{item.title}</strong>
                    <span>
                      {item.schoolId ? `${item.schoolName || item.schoolId}` : "All schools"}
                      {item.pinned ? " • pinned" : ""}
                    </span>
                  </div>
                  <span className={`admin-notification-badge ${item.active === false ? "off" : ""}`}>
                    {item.active === false ? "Paused" : "Live"}
                  </span>
                </div>
                <p>{item.summary || item.message}</p>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : null}
                <div className="admin-notification-actions">
                  <button type="button" onClick={() => handleEdit(item)}>Edit</button>
                  <button type="button" onClick={() => handleToggleActive(item)}>
                    {item.active === false ? "Activate" : "Pause"}
                  </button>
                  <button type="button" className="danger" onClick={() => handleDelete(item.id)}>Delete</button>
                </div>
              </article>
            ))}
            {!items.length ? <div className="admin-notification-empty">No notifications published yet.</div> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
