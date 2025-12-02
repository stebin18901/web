// CreateTutor.js
import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  writeBatch,
  setDoc,
} from "firebase/firestore";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import "./CreateTutor.css";

/**
 * CreateTutor (three-pane admin) - with batched imports
 *
 * - Uses chunked writeBatch for global imports and parts import
 * - Shows simple progress while importing
 *
 * Firestore structure:
 * /classes/{classId}/subjects/{subjectId}/chapters/{chapterId}/parts/{partId}
 */

const CHUNK_SIZE = 450; // safe margin under 500 limit

const CreateTutor = () => {
  // TOP-LEVEL IMPORT JSON (single-file paste)
  const [globalJsonText, setGlobalJsonText] = useState("");
  const [isGlobalJsonValid, setIsGlobalJsonValid] = useState(true);
  const [isImportingGlobal, setIsImportingGlobal] = useState(false);
  const [globalImportProgress, setGlobalImportProgress] = useState({ done: 0, total: 0 });

  // CLASSES
  const [classesList, setClassesList] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [newClassName, setNewClassName] = useState("");

  // SUBJECTS
  const [subjects, setSubjects] = useState([]);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(null);

  // CHAPTERS
  const [chapters, setChapters] = useState([]);
  const [newChapterTitle, setNewChapterTitle] = useState("");
  const [selectedChapter, setSelectedChapter] = useState(null);

  // PARTS
  const [parts, setParts] = useState([]);
  const [newPartType, setNewPartType] = useState("prereq");
  const [partsJsonText, setPartsJsonText] = useState("");
  const [isPartsJsonValid, setIsPartsJsonValid] = useState(true);
  const [isImportingParts, setIsImportingParts] = useState(false);
  const [partsImportProgress, setPartsImportProgress] = useState({ done: 0, total: 0 });

  // VIEW / EDIT part modal
  const [viewingPart, setViewingPart] = useState(null);
  const [isEditingPart, setIsEditingPart] = useState(false);
  const [editPartDraft, setEditPartDraft] = useState(null);

  // ----------------- Helpers: chunk & commit -----------------
  const chunkArray = (arr, size) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
    return chunks;
  };

  // commit operations: ops = [{ ref: DocumentReference, data: {} }, ...]
  const commitBatches = async (ops, onProgress) => {
    const chunks = chunkArray(ops, CHUNK_SIZE);
    let done = 0;
    const total = ops.length;
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((op) => {
        batch.set(op.ref, op.data);
      });
      await batch.commit();
      done += chunk.length;
      if (onProgress) onProgress(done, total);
    }
  };

  // ----------------- REALTIME: CLASSES -----------------
  useEffect(() => {
    const classesRef = collection(db, "classes");
    const q = query(classesRef, orderBy("name", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setClassesList(arr);
      },
      (err) => {
        console.error("classes onSnapshot error:", err);
        alert("Failed to load classes");
      }
    );
    return () => unsub();
  }, []);

  const createClass = async () => {
    const name = (newClassName || "").trim();
    if (!name) return alert("Enter class name");
    try {
      const classesRef = collection(db, "classes");
      const docRef = await addDoc(classesRef, { name, createdAt: serverTimestamp() });
      setNewClassName("");
      setSelectedClass({ id: docRef.id, name });
    } catch (err) {
      console.error("createClass error:", err);
      alert("Failed to create class");
    }
  };

  const deleteClassAndChildren = async (cls) => {
    if (!cls) return;
    const ok = window.confirm(`Delete class "${cls.name}" and ALL subjects/chapters/parts under it? This cannot be undone.`);
    if (!ok) return;
    try {
      // sequential deletion (may be slow). For large datasets consider Cloud Function deletion.
      const subjectsRef = collection(db, "classes", cls.id, "subjects");
      const subjectsSnap = await getDocs(subjectsRef);
      for (const sDoc of subjectsSnap.docs) {
        const sId = sDoc.id;
        const chaptersRef = collection(db, "classes", cls.id, "subjects", sId, "chapters");
        const chSnap = await getDocs(chaptersRef);
        for (const chDoc of chSnap.docs) {
          const chId = chDoc.id;
          const partsRef = collection(db, "classes", cls.id, "subjects", sId, "chapters", chId, "parts");
          const partsSnap = await getDocs(partsRef);
          for (const pDoc of partsSnap.docs) await deleteDoc(doc(db, "classes", cls.id, "subjects", sId, "chapters", chId, "parts", pDoc.id));
          await deleteDoc(doc(db, "classes", cls.id, "subjects", sId, "chapters", chId));
        }
        await deleteDoc(doc(db, "classes", cls.id, "subjects", sId));
      }
      await deleteDoc(doc(db, "classes", cls.id));
      if (selectedClass?.id === cls.id) {
        setSelectedClass(null);
        setSubjects([]);
        setSelectedSubject(null);
      }
    } catch (err) {
      console.error("deleteClassAndChildren error:", err);
      alert("Failed to fully delete class and children (see console).");
    }
  };

  // ----------------- SUBJECTS for selected class -----------------
  useEffect(() => {
    setSubjects([]);
    setSelectedSubject(null);
    setChapters([]);
    setSelectedChapter(null);
    setParts([]);
    if (!selectedClass) return;

    const subsRef = collection(db, "classes", selectedClass.id, "subjects");
    const q = query(subsRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setSubjects(arr);
      },
      (err) => {
        console.error("subjects onSnapshot error:", err);
        alert("Failed to load subjects");
      }
    );
    return () => unsub();
  }, [selectedClass]);

  const createSubject = async () => {
    if (!selectedClass) return alert("Select a class first");
    const name = (newSubjectName || "").trim();
    if (!name) return alert("Enter subject name");
    try {
      const subsRef = collection(db, "classes", selectedClass.id, "subjects");
      const docRef = await addDoc(subsRef, { name, createdAt: serverTimestamp() });
      setNewSubjectName("");
      setSelectedSubject({ id: docRef.id, name });
    } catch (err) {
      console.error("createSubject error:", err);
      alert("Failed to create subject");
    }
  };

  const updateSubject = async (s) => {
    const newName = window.prompt("Edit subject name", s.name);
    if (!newName || newName.trim() === "") return;
    try {
      await updateDoc(doc(db, "classes", selectedClass.id, "subjects", s.id), { name: newName.trim() });
    } catch (err) {
      console.error("updateSubject error:", err);
      alert("Failed to update subject");
    }
  };

  const deleteSubject = async (s) => {
    if (!selectedClass) return;
    const ok = window.confirm(`Delete subject "${s.name}" and ALL chapters/parts under it?`);
    if (!ok) return;
    try {
      const chaptersRef = collection(db, "classes", selectedClass.id, "subjects", s.id, "chapters");
      const chSnap = await getDocs(chaptersRef);
      for (const chDoc of chSnap.docs) {
        const chId = chDoc.id;
        const partsRef = collection(db, "classes", selectedClass.id, "subjects", s.id, "chapters", chId, "parts");
        const partsSnap = await getDocs(partsRef);
        for (const pDoc of partsSnap.docs) {
          await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", s.id, "chapters", chId, "parts", pDoc.id));
        }
        await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", s.id, "chapters", chId));
      }
      await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", s.id));
      if (selectedSubject?.id === s.id) {
        setSelectedSubject(null);
        setChapters([]);
      }
    } catch (err) {
      console.error("deleteSubject error:", err);
      alert("Failed to delete subject and children");
    }
  };

  // ----------------- CHAPTERS for selected subject -----------------
  useEffect(() => {
    setChapters([]);
    setSelectedChapter(null);
    setParts([]);
    if (!selectedClass || !selectedSubject) return;

    const chRef = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters");
    const q = query(chRef, orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setChapters(arr);
      },
      (err) => {
        console.error("chapters onSnapshot error:", err);
        alert("Failed to load chapters");
      }
    );
    return () => unsub();
  }, [selectedClass, selectedSubject]);

  const createChapter = async () => {
    if (!selectedClass || !selectedSubject) return alert("Select class & subject first");
    const title = (newChapterTitle || "").trim();
    if (!title) return alert("Enter chapter title");
    try {
      const chRef = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters");
      const docRef = await addDoc(chRef, { title, order: chapters.length + 1, description: "", createdAt: serverTimestamp() });
      setNewChapterTitle("");
      setSelectedChapter({ id: docRef.id, title });
    } catch (err) {
      console.error("createChapter error:", err);
      alert("Failed to create chapter");
    }
  };

  const updateChapter = async (ch) => {
    const newTitle = window.prompt("Edit chapter title", ch.title);
    if (!newTitle || newTitle.trim() === "") return;
    try {
      await updateDoc(doc(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", ch.id), { title: newTitle.trim() });
    } catch (err) {
      console.error("updateChapter error:", err);
      alert("Failed to update chapter");
    }
  };

  const deleteChapter = async (ch) => {
    if (!selectedClass || !selectedSubject) return;
    const ok = window.confirm(`Delete chapter "${ch.title}" and ALL parts under it?`);
    if (!ok) return;
    try {
      const partsRef = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", ch.id, "parts");
      const partsSnap = await getDocs(partsRef);
      for (const pDoc of partsSnap.docs) {
        await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", ch.id, "parts", pDoc.id));
      }
      await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", ch.id));
      if (selectedChapter?.id === ch.id) {
        setSelectedChapter(null);
        setParts([]);
      }
    } catch (err) {
      console.error("deleteChapter error:", err);
      alert("Failed to delete chapter and parts");
    }
  };

  // ----------------- PARTS for selected chapter -----------------
  useEffect(() => {
    setParts([]);
    if (!selectedClass || !selectedSubject || !selectedChapter) return;

    const partsRef = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", selectedChapter.id, "parts");
    const q = query(partsRef, orderBy("order", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((d) => arr.push({ id: d.id, ...d.data() }));
        setParts(arr);
      },
      (err) => {
        console.error("parts onSnapshot error:", err);
        alert("Failed to load parts");
      }
    );
    return () => unsub();
  }, [selectedClass, selectedSubject, selectedChapter]);

  // create minimal part (no title)
  const createPart = async () => {
    if (!selectedClass || !selectedSubject || !selectedChapter) return alert("Select class, subject & chapter first");
    try {
      const partsRef = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", selectedChapter.id, "parts");
      await addDoc(partsRef, { title: "", order: parts.length + 1, type: newPartType, content: { text: "" }, createdAt: serverTimestamp() });
    } catch (err) {
      console.error("createPart error:", err);
      alert("Failed to create part");
    }
  };

  // parts JSON import per chapter (batching)
  useEffect(() => {
    if (!partsJsonText) {
      setIsPartsJsonValid(true);
      return;
    }
    try {
      JSON.parse(partsJsonText);
      setIsPartsJsonValid(true);
    } catch {
      setIsPartsJsonValid(false);
    }
  }, [partsJsonText]);

  const importPartsFromJson = async () => {
    if (!selectedClass || !selectedSubject || !selectedChapter) return alert("Select class/subject/chapter first");
    if (!partsJsonText) return alert("Paste parts JSON");
    if (!isPartsJsonValid) return alert("Invalid JSON");
    setIsImportingParts(true);
    setPartsImportProgress({ done: 0, total: 0 });

    try {
      const parsed = JSON.parse(partsJsonText);
      const arr = Array.isArray(parsed) ? parsed : parsed.parts;
      if (!Array.isArray(arr)) {
        alert('Parts JSON should be an array or { "parts": [...] }');
        setIsImportingParts(false);
        return;
      }

      const partsRefBase = collection(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", selectedChapter.id, "parts");
      const existingCountSnap = await getDocs(partsRefBase);
      const existingCount = existingCountSnap.size;

      // build ops
      const ops = arr.map((p, idx) => {
        const ref = doc(partsRefBase); // new doc ref with generated id
        const data = {
          title: p.title ?? "",
          order: p.order ?? existingCount + idx + 1,
          type: p.type ?? newPartType,
          content: p.content ?? {},
          createdAt: serverTimestamp(),
        };
        return { ref, data };
      });

      setPartsImportProgress({ done: 0, total: ops.length });
      await commitBatches(ops, (done, total) => setPartsImportProgress({ done, total }));

      setPartsJsonText("");
      alert(`Imported ${ops.length} parts (type default: '${newPartType}').`);
    } catch (err) {
      console.error("importPartsFromJson error:", err);
      alert("Failed to import parts JSON (see console)");
    } finally {
      setIsImportingParts(false);
    }
  };

  // ----------------- VIEW / EDIT / DELETE part -----------------
  const viewPart = (p) => {
    setViewingPart(p);
    setIsEditingPart(false);
    setEditPartDraft(null);
  };

  const closeView = () => {
    setViewingPart(null);
    setIsEditingPart(false);
    setEditPartDraft(null);
  };

  const startEditPart = () => {
    setIsEditingPart(true);
    setEditPartDraft({ ...viewingPart });
  };

  const saveEditedPart = async () => {
    if (!viewingPart || !editPartDraft) return;
    try {
      const partRef = doc(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", selectedChapter.id, "parts", viewingPart.id);
      const payload = {
        title: editPartDraft.title ?? "",
        order: editPartDraft.order ?? viewingPart.order ?? 0,
        content: editPartDraft.content ?? {},
        type: editPartDraft.type ?? viewingPart.type ?? newPartType,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(partRef, payload);
      closeView();
    } catch (err) {
      console.error("saveEditedPart error:", err);
      alert("Failed to save part changes");
    }
  };

  const deletePart = async (p) => {
    if (!selectedClass || !selectedSubject || !selectedChapter) return alert("No selection");
    const ok = window.confirm(`Delete part "${p.title || "Untitled"}"?`);
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "classes", selectedClass.id, "subjects", selectedSubject.id, "chapters", selectedChapter.id, "parts", p.id));
      if (viewingPart?.id === p.id) closeView();
    } catch (err) {
      console.error("deletePart error:", err);
      alert("Failed to delete part");
    }
  };

  // ----------------- TOP-LEVEL GLOBAL IMPORT (batched) -----------------
  useEffect(() => {
    if (!globalJsonText) {
      setIsGlobalJsonValid(true);
      return;
    }
    try {
      JSON.parse(globalJsonText);
      setIsGlobalJsonValid(true);
    } catch {
      setIsGlobalJsonValid(false);
    }
  }, [globalJsonText]);

  const importGlobalJson = async () => {
    if (!globalJsonText) return alert("Paste global JSON first");
    if (!isGlobalJsonValid) return alert("Invalid JSON");
    setIsImportingGlobal(true);
    setGlobalImportProgress({ done: 0, total: 0 });

    try {
      const parsed = JSON.parse(globalJsonText);
      const classesArr = Array.isArray(parsed) ? parsed : parsed.classes ?? parsed.data?.classes ?? [];
      if (!Array.isArray(classesArr) || classesArr.length === 0) {
        alert('Global JSON should be an array of classes OR { "classes": [...] }');
        setIsImportingGlobal(false);
        return;
      }

      // Build ops for all levels: class, subject, chapter, part
      const ops = [];

      for (const cls of classesArr) {
        const clsName = (cls.name || cls.class || "Unnamed Class").toString();
        const classesRef = collection(db, "classes");
        const clsRef = doc(classesRef); // new class docRef
        const clsData = { name: clsName, createdAt: serverTimestamp() };
        ops.push({ ref: clsRef, data: clsData });

        const subjectsArr = cls.subjects ?? cls.topics ?? [];
        if (Array.isArray(subjectsArr)) {
          for (const s of subjectsArr) {
            const sName = (s.name || s.subject || "Untitled Subject").toString();
            const subsRef = collection(db, "classes", clsRef.id, "subjects");
            const sRef = doc(subsRef);
            ops.push({ ref: sRef, data: { name: sName, createdAt: serverTimestamp() } });

            const chaptersArr = s.chapters ?? s.units ?? [];
            if (Array.isArray(chaptersArr)) {
              for (const ch of chaptersArr) {
                const chTitle = (ch.title || ch.name || "Untitled Chapter").toString();
                const chOrder = ch.order ?? null;
                const chRefCol = collection(db, "classes", clsRef.id, "subjects", sRef.id, "chapters");
                const chRef = doc(chRefCol);
                ops.push({
                  ref: chRef,
                  data: {
                    title: chTitle,
                    order: chOrder ?? 0,
                    description: ch.description ?? "",
                    createdAt: serverTimestamp(),
                  },
                });

                const partsArr = ch.parts ?? [];
                if (Array.isArray(partsArr)) {
                  const partsRefCol = collection(db, "classes", clsRef.id, "subjects", sRef.id, "chapters", chRef.id, "parts");
                  for (const p of partsArr) {
                    const pRef = doc(partsRefCol);
                    ops.push({
                      ref: pRef,
                      data: {
                        title: p.title ?? "",
                        order: p.order ?? 0,
                        type: p.type ?? "prereq",
                        content: p.content ?? {},
                        createdAt: serverTimestamp(),
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }

      // commit in batches with progress
      setGlobalImportProgress({ done: 0, total: ops.length });
      await commitBatches(ops, (done, total) => setGlobalImportProgress({ done, total }));

      alert(`Global import finished. Committed ${ops.length} writes. For very large imports consider running server-side processes (Cloud Function).`);
      setGlobalJsonText("");
    } catch (err) {
      console.error("importGlobalJson error:", err);
      alert("Global import failed (see console)");
    } finally {
      setIsImportingGlobal(false);
    }
  };

  // ----------------- utilities -----------------
  const formatTimestamp = (ts) => {
    try {
      if (!ts) return "";
      if (typeof ts.toDate === "function") return ts.toDate().toLocaleString();
      if (ts instanceof Date) return ts.toLocaleString();
      if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
      return String(ts);
    } catch {
      return "";
    }
  };

  const renderMixedText = (text) => {
    if (!text) return null;
    const partsArr = text.split(/(\$[^$]+\$)/g);
    return partsArr.map((part, idx) => {
      if (part.startsWith("$") && part.endsWith("$")) return <InlineMath key={idx} math={part.replace(/\$/g, "")} />;
      return <span key={idx}>{part}</span>;
    });
  };

  // ----------------- JSX -----------------
  return (
    <div className="create-tutor-container three-pane">
      <h1>Create / Manage Class → Subject → Chapter → Parts</h1>

      {/* TOP: Global JSON paste area */}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 6, color: "#334155" }}>
          Paste single JSON (classes → subjects → chapters → parts) and click Import
        </label>
        <textarea
          rows={6}
          placeholder={`{\n  "classes": [\n    { "name":"Class 6", "subjects":[ { "name":"Math", "chapters":[ { "title":"Knowing Numbers", "order":1, "parts":[ { "title":"Prereq 1", "order":1, "type":"prereq", "content":{ "text":"..." } } ] } ] } ] }\n  ]\n}`}
          value={globalJsonText}
          onChange={(e) => setGlobalJsonText(e.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: 10, fontFamily: "ui-monospace,monospace" }}
        />
        {!isGlobalJsonValid && <div style={{ color: "#ef4444", marginTop: 6 }}>Invalid JSON</div>}
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={importGlobalJson} disabled={!isGlobalJsonValid || !globalJsonText || isImportingGlobal}>
            {isImportingGlobal ? `Importing global... (${globalImportProgress.done}/${globalImportProgress.total})` : "Import Global JSON (batched)"}
          </button>
          {isImportingGlobal && <div style={{ color: "#334155" }}>{globalImportProgress.done}/{globalImportProgress.total} writes committed</div>}
        </div>
      </div>

      <div className="three-pane-layout">
        {/* LEFT: Class + Subjects */}
        <div className="pane left-pane">
          <div className="pane-header">
            <h3>Classes</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input placeholder="New class name" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
              <button onClick={createClass}>+ Add Class</button>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, color: "#475569" }}>Choose class</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <select
                value={selectedClass?.id ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  const cls = classesList.find((c) => c.id === id) || null;
                  setSelectedClass(cls);
                  setSelectedSubject(null);
                }}
                style={{ padding: 8, borderRadius: 8 }}
              >
                <option value="">-- select class --</option>
                {classesList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {selectedClass && (
                <button
                  onClick={() => {
                    if (!selectedClass) return;
                    const newName = window.prompt("Edit class name", selectedClass.name);
                    if (!newName) return;
                    updateDoc(doc(db, "classes", selectedClass.id), { name: newName.trim() }).catch((e) => {
                      console.error(e);
                      alert("Failed to update class");
                    });
                  }}
                >
                  Edit
                </button>
              )}
              {selectedClass && (
                <button
                  onClick={() => {
                    if (!selectedClass) return deleteClassAndChildren(selectedClass);
                  }}
                  style={{ background: "#ef4444", marginLeft: 6 }}
                >
                  Delete Class
                </button>
              )}
            </div>
          </div>

          <hr />

          <div className="pane-header" style={{ marginTop: 8 }}>
            <h3>Subjects</h3>
            <div className="small-input-row">
              <input placeholder="New subject name" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
              <button onClick={createSubject}>+ Add</button>
            </div>
          </div>

          <div className="pane-body">
            {!selectedClass ? <div className="placeholder">Select a class to see subjects</div> : subjects.length === 0 ? <p>No subjects yet</p> : subjects.map((s) => (
              <div key={s.id} className={`subject-row ${selectedSubject?.id === s.id ? "selected" : ""}`}>
                <div style={{ flex: 1 }} onClick={() => { setSelectedSubject(s); setSelectedChapter(null); }}>
                  <strong>{s.name}</strong>
                  <div className="meta"><small>{formatTimestamp(s.createdAt)}</small></div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="icon-btn" onClick={() => updateSubject(s)}>Edit</button>
                  <button className="icon-btn delete-btn" onClick={() => deleteSubject(s)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MIDDLE: Chapters */}
        <div className={`pane middle-pane ${selectedSubject ? "" : "hidden"}`}>
          {!selectedSubject ? <div className="placeholder">Select a subject to view chapters</div> : (
            <>
              <div className="pane-header">
                <h3>Chapters — {selectedSubject.name}</h3>
                <div className="small-input-row">
                  <input placeholder="New chapter title" value={newChapterTitle} onChange={(e) => setNewChapterTitle(e.target.value)} />
                  <button onClick={createChapter}>+ Add</button>
                </div>
              </div>

              <div className="pane-body">
                {chapters.length === 0 ? <p>No chapters yet</p> : chapters.map((ch) => (
                  <div key={ch.id} className={`chapter-row ${selectedChapter?.id === ch.id ? "selected" : ""}`}>
                    <div style={{ flex: 1 }} onClick={() => { setSelectedChapter(ch); }}>
                      <strong>{ch.title}</strong>
                      <div className="meta"><small>order: {ch.order ?? "-"}</small></div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="icon-btn" onClick={() => updateChapter(ch)}>Edit</button>
                      <button className="icon-btn delete-btn" onClick={() => deleteChapter(ch)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* RIGHT: Parts */}
        <div className={`pane right-pane ${selectedChapter ? "" : "hidden"}`}>
          {!selectedChapter ? <div className="placeholder">Select a chapter to view parts</div> : (
            <>
              <div className="pane-header">
                <h3>Parts — {selectedChapter.title}</h3>
                <div className="small-input-row">
                  <select value={newPartType} onChange={(e) => setNewPartType(e.target.value)}>
                    <option value="prereq">prereq</option>
                    <option value="concept">concept</option>
                    <option value="practical">practical</option>
                    <option value="entrance">entrance</option>
                  </select>
                  <button onClick={createPart}>+ Add (type only)</button>
                </div>
              </div>

              <div className="import-block">
                <label>Paste parts JSON (array or {"{ parts: [...] }"}) — titles expected in JSON. Imported parts will use the currently selected type if p.type is missing.</label>
                <textarea rows={6} placeholder={`[\n  { "title":"Prereq: Number Names", "order":1, "content":{"text":"..."} },\n  { "title":"Concept: Place Value", "order":2,"content":{"text":"..."} }\n]`} value={partsJsonText} onChange={(e) => setPartsJsonText(e.target.value)} />
                {!isPartsJsonValid && <p className="error">❌ Invalid JSON</p>}
                <div className="btn-row" style={{ alignItems: "center" }}>
                  <button onClick={importPartsFromJson} disabled={!isPartsJsonValid || !partsJsonText || isImportingParts}>
                    {isImportingParts ? `Importing parts... (${partsImportProgress.done}/${partsImportProgress.total})` : "Import Parts (batched)"}
                  </button>
                  {isImportingParts && <div style={{ color: "#334155" }}>{partsImportProgress.done}/{partsImportProgress.total}</div>}
                </div>
              </div>

              <div className="pane-body">
                {parts.length === 0 ? <p>No parts yet</p> : parts.map((p) => (
                  <div key={p.id} className="part-row">
                    <div className="part-left">
                      <div className="part-title-group" style={{ flex: 1 }}>
                        <div className="type-badge">{p.type}</div>
                        <div className="title-text" style={{ marginLeft: 8 }}>
                          {p.title ? <strong>{p.title}</strong> : <strong className="untitled">Untitled part</strong>}
                          <div className="meta small-meta"><small>{p.content?.summary ?? ""}</small></div>
                        </div>
                      </div>
                    </div>

                    <div className="part-actions">
                      <button className="icon-btn view-btn" onClick={() => viewPart(p)}>View</button>
                      <button className="icon-btn delete-btn" onClick={() => deletePart(p)}>Delete</button>
                      <div className="order-bubble">{p.order ?? "-"}</div>
                    </div>

                    <div className="part-content">
                      {p.content?.text ? renderMixedText(p.content.text) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* VIEW / EDIT PART MODAL */}
      {viewingPart && (
        <div className="modal-backdrop" onClick={closeView}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <div className="type-badge modal-badge">{viewingPart.type}</div>
                <h3 style={{ margin: "6px 0" }}>{viewingPart.title || "Untitled part"}</h3>
                <div className="meta"><small>Order: {viewingPart.order ?? "-"}</small></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!isEditingPart && <button className="icon-btn" onClick={startEditPart}>Edit</button>}
                <button className="icon-btn" onClick={closeView}>Close</button>
              </div>
            </div>

            <hr />

            <div className="modal-body">
              {!isEditingPart ? (
                <>
                  <h4>Rendered content</h4>
                  {viewingPart.content?.text ? <div className="rendered-area">{renderMixedText(viewingPart.content.text)}</div> : <div className="rendered-area muted">No text content to render</div>}
                  <h4 style={{ marginTop: 12 }}>Raw JSON</h4>
                  <pre className="json-block">{JSON.stringify(viewingPart, null, 2)}</pre>
                </>
              ) : (
                <>
                  <h4>Edit part</h4>
                  <div style={{ display: "grid", gap: 8 }}>
                    <input value={editPartDraft?.title ?? viewingPart.title ?? ""} onChange={(e) => setEditPartDraft({ ...editPartDraft, title: e.target.value })} placeholder="Title" />
                    <input type="number" value={editPartDraft?.order ?? viewingPart.order ?? 0} onChange={(e) => setEditPartDraft({ ...editPartDraft, order: parseInt(e.target.value || "0", 10) })} placeholder="Order" />
                    <select value={editPartDraft?.type ?? viewingPart.type} onChange={(e) => setEditPartDraft({ ...editPartDraft, type: e.target.value })}>
                      <option value="prereq">prereq</option>
                      <option value="concept">concept</option>
                      <option value="practical">practical</option>
                      <option value="entrance">entrance</option>
                    </select>
                    <textarea rows={8} value={editPartDraft?.content?.text ?? viewingPart.content?.text ?? ""} onChange={(e) => setEditPartDraft({ ...editPartDraft, content: { ...(editPartDraft?.content ?? viewingPart.content ?? {}), text: e.target.value } })} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveEditedPart}>Save</button>
                      <button onClick={() => { setIsEditingPart(false); setEditPartDraft(null); }}>Cancel</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateTutor;
