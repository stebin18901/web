import React, { useEffect, useState } from "react";
import "./Calendar.css";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebase/firebaseConfig"; // <- your firebase exports

const AdminCalendar = () => {
  const [events, setEvents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  // form state
  const [form, setForm] = useState({
    id: null,
    title: "",
    date: "",
    time: "",
    description: "",
    subject: "",
    type: "task", // task or quiz
    quizLink: ""
  });
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoadingList(true);
    try {
      const q = query(collection(db, "calendarEvents"), orderBy("date", "asc"));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(arr);
    } catch (err) {
      console.error("loadEvents:", err);
    } finally {
      setLoadingList(false);
    }
  };

  const resetForm = () => {
    setForm({
      id: null,
      title: "",
      date: "",
      time: "",
      description: "",
      subject: "",
      type: "task",
      quizLink: ""
    });
    setImageFile(null);
  };

  const handleEdit = (ev) => {
    setForm({
      id: ev.id,
      title: ev.title || "",
      date: ev.date?.seconds ? new Date(ev.date.seconds * 1000).toISOString().slice(0,10) : (ev.date || ""),
      time: ev.time || "",
      description: ev.description || "",
      subject: ev.subject || "",
      type: ev.type || "task",
      quizLink: ev.quizLink || ""
    });
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this event?")) return;
    try {
      await deleteDoc(doc(db, "calendarEvents", id));
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error("delete event", err);
      alert("Delete failed");
    }
  };

  const handleUploadImage = async (file, id) => {
    if (!file) return null;
    const fileRef = ref(storage, `calendar/${Date.now()}_${file.name}`);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return url;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.date) {
      alert("Please fill title and date.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await handleUploadImage(imageFile);
      }

      const payload = {
        title: form.title,
        date: form.date, // ISO string (yyyy-mm-dd). You may convert to Timestamp on server if you want
        time: form.time || "",
        description: form.description || "",
        subject: form.subject || "",
        type: form.type,
        quizLink: form.quizLink || "",
        imageUrl: imageUrl || null,
        updatedAt: serverTimestamp()
      };

      if (form.id) {
        // update
        const refDoc = doc(db, "calendarEvents", form.id);
        await updateDoc(refDoc, payload);
        alert("Updated event");
      } else {
        // create
        await addDoc(collection(db, "calendarEvents"), { ...payload, createdAt: serverTimestamp() });
        alert("Event created");
      }

      resetForm();
      await loadEvents();
    } catch (err) {
      console.error("save event", err);
      alert("Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-calendar">
      <h3>Calendar Admin</h3>

      <form className="admin-form" onSubmit={handleSave}>
        <div className="row">
          <input placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} />
          <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          <input type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
        </div>

        <div className="row">
          <input placeholder="Subject (optional)" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} />
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="task">Task</option>
            <option value="quiz">Quiz</option>
            <option value="announcement">Announcement</option>
          </select>
        </div>

        <div className="row">
          <input placeholder="Quiz link (if type=quiz)" value={form.quizLink} onChange={e => setForm({...form, quizLink: e.target.value})} />
        </div>

        <div className="row">
          <textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
        </div>

        <div className="row">
          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0] || null)} />
          <div className="file-hint muted">{imageFile ? imageFile.name : "No image selected"}</div>
        </div>

        <div className="row">
          <button type="submit" disabled={saving}>{saving ? "Saving..." : (form.id ? "Update Event" : "Create Event")}</button>
          <button type="button" onClick={resetForm} className="muted">Reset</button>
        </div>
      </form>

      <hr />

      <div className="admin-list">
        <h4>Existing events</h4>
        {loadingList ? <div className="muted">Loading…</div> : (
          events.length === 0 ? <div className="muted">No events yet</div> : events.map(ev => (
            <div key={ev.id} className="admin-item">
              <div className="left">
                {ev.imageUrl && <img src={ev.imageUrl} alt={ev.title} className="thumb" />}
                <div>
                  <div className="ev-title">{ev.title}</div>
                  <div className="muted small">{ev.subject} • {ev.date} {ev.time || ""}</div>
                </div>
              </div>

              <div className="actions">
                <button onClick={() => handleEdit(ev)}>Edit</button>
                <button onClick={() => handleDelete(ev.id)} className="danger">Delete</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminCalendar;
