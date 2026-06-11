// src/components/ChapterList.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import "./ChapterList.css";

const toMillis = (value) => {
  if (!value) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
};

const ChapterList = () => {
  const [chapters, setChapters] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState("");
  const [editedSortPosition, setEditedSortPosition] = useState("");
  const [activeSort, setActiveSort] = useState("");

  useEffect(() => {
    const fetchChapters = async () => {
      const querySnapshot = await getDocs(collection(db, "chapters"));
      const chaptersData = querySnapshot.docs.map((chapterDoc) => ({
        id: chapterDoc.id,
        ...chapterDoc.data(),
      }));
      setChapters(chaptersData);
    };

    fetchChapters();
  }, []);

  const handleDeleteChapter = async (id) => {
    if (window.confirm("Are you sure you want to delete this chapter?")) {
      try {
        await deleteDoc(doc(db, "chapters", id));
        setChapters(chapters.filter((chapter) => chapter.id !== id));
        alert("Chapter deleted successfully!");
      } catch (error) {
        console.error("Error deleting chapter: ", error);
        alert("Failed to delete chapter. Please try again.");
      }
    }
  };

  const handleEditStart = (id, currentName, currentSortPosition) => {
    setEditingId(id);
    setEditedName(currentName);
    setEditedSortPosition(
      currentSortPosition === null || currentSortPosition === undefined ? "" : String(currentSortPosition)
    );
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditedName("");
    setEditedSortPosition("");
  };

  const handleEditSave = async (id) => {
    if (!editedName.trim()) {
      alert("Chapter name cannot be empty!");
      return;
    }

    try {
      await updateDoc(doc(db, "chapters", id), {
        chapterName: editedName.trim(),
        sortPosition: editedSortPosition === "" ? null : Number(editedSortPosition),
      });

      setChapters(chapters.map((chapter) =>
        chapter.id === id
          ? {
              ...chapter,
              chapterName: editedName.trim(),
              sortPosition: editedSortPosition === "" ? null : Number(editedSortPosition),
            }
          : chapter
      ));
      setEditingId(null);
      setEditedName("");
      setEditedSortPosition("");
      alert("Chapter name updated successfully!");
    } catch (error) {
      console.error("Error updating chapter: ", error);
      alert("Failed to update chapter name. Please try again.");
    }
  };

  const filteredChapters = chapters.filter((chapter) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      String(chapter.subject || "").toLowerCase().includes(searchLower) ||
      String(chapter.chapterName || "").toLowerCase().includes(searchLower) ||
      String(chapter.class || "").includes(searchQuery)
    );
  });

  const sortedChapters = filteredChapters.slice().sort((a, b) => {
    if (activeSort === "manual_position") {
      const aPos = Number.isFinite(Number(a.sortPosition)) ? Number(a.sortPosition) : Number.MAX_SAFE_INTEGER;
      const bPos = Number.isFinite(Number(b.sortPosition)) ? Number(b.sortPosition) : Number.MAX_SAFE_INTEGER;
      return aPos - bPos || String(a.chapterName || "").localeCompare(String(b.chapterName || ""));
    }
    if (activeSort === "uploaded_oldest") {
      const aMs = toMillis(a.createdAt) ?? Number.MAX_SAFE_INTEGER;
      const bMs = toMillis(b.createdAt) ?? Number.MAX_SAFE_INTEGER;
      return aMs - bMs || String(a.chapterName || "").localeCompare(String(b.chapterName || ""));
    }
    if (activeSort === "subject_az") {
      return String(a.subject || "").localeCompare(String(b.subject || "")) ||
        String(a.chapterName || "").localeCompare(String(b.chapterName || ""));
    }
    if (activeSort === "class_asc") {
      return Number(a.class || 0) - Number(b.class || 0) ||
        String(a.chapterName || "").localeCompare(String(b.chapterName || ""));
    }
    if (activeSort === "chapter_az") {
      return String(a.chapterName || "").localeCompare(String(b.chapterName || ""));
    }
    return 0;
  });

  const handleSortToggle = (sortKey) => {
    setActiveSort((prev) => (prev === sortKey ? "" : sortKey));
  };

  return (
    <div className="chapter-list-container1">
      <h2>Chapter Management</h2>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by subject, class, or chapter name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="search-icon">S</span>
      </div>

      <div className="chapter-sort-controls">
        <button
          type="button"
          className={`sort-box ${activeSort === "manual_position" ? "active" : ""}`}
          onClick={() => handleSortToggle("manual_position")}
        >
          Sort Position
        </button>
        <button
          type="button"
          className={`sort-box ${activeSort === "uploaded_oldest" ? "active" : ""}`}
          onClick={() => handleSortToggle("uploaded_oldest")}
        >
          Uploaded Time
        </button>
        <button
          type="button"
          className={`sort-box ${activeSort === "subject_az" ? "active" : ""}`}
          onClick={() => handleSortToggle("subject_az")}
        >
          Subject A-Z
        </button>
        <button
          type="button"
          className={`sort-box ${activeSort === "class_asc" ? "active" : ""}`}
          onClick={() => handleSortToggle("class_asc")}
        >
          Class Low-High
        </button>
        <button
          type="button"
          className={`sort-box ${activeSort === "chapter_az" ? "active" : ""}`}
          onClick={() => handleSortToggle("chapter_az")}
        >
          Chapter A-Z
        </button>
      </div>

      {sortedChapters.length > 0 ? (
        <table className="chapter-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class</th>
              <th>Chapter Name</th>
              <th>Sort Position</th>
              <th>Test Links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedChapters.map((chapter) => (
              <tr key={chapter.id}>
                <td>{chapter.subject}</td>
                <td>Class {chapter.class}</td>
                <td>
                  {editingId === chapter.id ? (
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="edit-input"
                    />
                  ) : (
                    chapter.chapterName
                  )}
                </td>
                <td>
                  {editingId === chapter.id ? (
                    <input
                      type="number"
                      min="1"
                      value={editedSortPosition}
                      onChange={(e) => setEditedSortPosition(e.target.value)}
                      className="edit-input edit-input-small"
                      placeholder="-"
                    />
                  ) : (
                    chapter.sortPosition ?? "-"
                  )}
                </td>
                <td>
                  {chapter.testLinks && chapter.testLinks.length > 0 ? (
                    <ul className="test-links">
                      {chapter.testLinks.map((link, index) => (
                        <li key={index}>
                          <a href={link} target="_blank" rel="noopener noreferrer">
                            Test {index + 1}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="no-links">No test links</span>
                  )}
                </td>
                <td className="actions-cell">
                  {editingId === chapter.id ? (
                    <>
                      <button className="save-btn" onClick={() => handleEditSave(chapter.id)}>
                        Save
                      </button>
                      <button className="cancel-btn" onClick={handleEditCancel}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="edit-btn"
                        onClick={() => handleEditStart(chapter.id, chapter.chapterName, chapter.sortPosition)}
                      >
                        Edit
                      </button>
                      <button className="delete-btn" onClick={() => handleDeleteChapter(chapter.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="no-chapters">
          {searchQuery ? (
            <p>No chapters match your search criteria.</p>
          ) : (
            <p>No chapters available. Create your first chapter to get started!</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ChapterList;
