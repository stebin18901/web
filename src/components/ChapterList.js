// src/components/ChapterList.js
import React, { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { collection, getDocs, doc, deleteDoc, updateDoc } from "firebase/firestore";
import './ChapterList.css';

const ChapterList = () => {
  const [chapters, setChapters] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editedName, setEditedName] = useState("");

  // Fetch chapters from Firestore
  useEffect(() => {
    const fetchChapters = async () => {
      const querySnapshot = await getDocs(collection(db, "chapters"));
      const chaptersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setChapters(chaptersData);
    };

    fetchChapters();
  }, []);

  // Delete a chapter
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

  // Start editing a chapter name
  const handleEditStart = (id, currentName) => {
    setEditingId(id);
    setEditedName(currentName);
  };

  // Cancel editing
  const handleEditCancel = () => {
    setEditingId(null);
    setEditedName("");
  };

  // Save edited chapter name
  const handleEditSave = async (id) => {
    if (!editedName.trim()) {
      alert("Chapter name cannot be empty!");
      return;
    }

    try {
      await updateDoc(doc(db, "chapters", id), {
        chapterName: editedName.trim()
      });
      
      setChapters(chapters.map(chapter => 
        chapter.id === id ? {...chapter, chapterName: editedName.trim()} : chapter
      ));
      setEditingId(null);
      setEditedName("");
      alert("Chapter name updated successfully!");
    } catch (error) {
      console.error("Error updating chapter: ", error);
      alert("Failed to update chapter name. Please try again.");
    }
  };

  // Filter chapters based on search query
  const filteredChapters = chapters.filter((chapter) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      chapter.subject.toLowerCase().includes(searchLower) ||
      chapter.chapterName.toLowerCase().includes(searchLower) ||
      chapter.class.toString().includes(searchQuery)
    );
  });

  return (
    <div className="chapter-list-container1">
      <h2>Chapter Management</h2>

      {/* Search Bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by subject, class, or chapter name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <span className="search-icon">🔍</span>
      </div>

      {/* Chapters Table */}
      {filteredChapters.length > 0 ? (
        <table className="chapter-table">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Class</th>
              <th>Chapter Name</th>
              <th>Test Links</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredChapters.map((chapter) => (
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
                      <button 
                        className="save-btn"
                        onClick={() => handleEditSave(chapter.id)}
                      >
                        Save
                      </button>
                      <button 
                        className="cancel-btn"
                        onClick={handleEditCancel}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="edit-btn"
                        onClick={() => handleEditStart(chapter.id, chapter.chapterName)}
                      >
                        Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteChapter(chapter.id)}
                      >
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