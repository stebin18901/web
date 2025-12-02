import React, { useState } from "react";
import { addChapter } from "../firebase/firestore";
import { uploadPdf } from "../firebase/uploadService";
import "./ChapterForm.css";

const subjects = ["Mathematics", "Physics", "Chemistry", "Biology", "Social Studies"];

const ChapterForm = ({ refreshChapters }) => {
  const [selectedSubject, setSelectedSubject] = useState(subjects[0]);
  const [chapterName, setChapterName] = useState("");
  const [testLinks, setTestLinks] = useState([""]);
  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false); // Add uploading state

  const addTestLink = () => {
    setTestLinks([...testLinks, ""]);
  };

  const handleTestLinkChange = (index, value) => {
    const updatedLinks = [...testLinks];
    updatedLinks[index] = value;
    setTestLinks(updatedLinks);
  };

  const handleFileUpload = (e) => {
    setPdfFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!chapterName || testLinks.some((link) => link.trim() === "")) {
      alert("⚠️ Please fill all fields.");
      return;
    }

    let pdfURL = "";
    if (pdfFile) {
      setUploading(true); // Start uploading
      try {
        pdfURL = await uploadPdf(pdfFile);
      } catch (error) {
        console.error("PDF upload failed:", error);
        alert("⚠️ PDF upload failed.");
      } finally {
        setUploading(false); // End uploading
      }
    }

    try {
      await addChapter(selectedSubject, { chapterName, testLinks, notes: pdfURL });
      refreshChapters();
      setChapterName("");
      setTestLinks([""]);
      setPdfFile(null);
    } catch (error) {
        console.error("Error adding chapter:", error);
        alert("⚠️ Error adding chapter. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="chapter-form">
      <h2>Add Chapter</h2>

      <label>Subject:</label>
      <select
        value={selectedSubject}
        onChange={(e) => setSelectedSubject(e.target.value)}
      >
        {subjects.map((subject) => (
          <option key={subject} value={subject}>
            {subject}
          </option>
        ))}
      </select>

      <label>Chapter Name:</label>
      <input
        type="text"
        value={chapterName}
        onChange={(e) => setChapterName(e.target.value)}
        required
      />

      <label>Test Links:</label>
      {testLinks.map((link, index) => (
        <input
          key={index}
          type="text"
          value={link}
          onChange={(e) => handleTestLinkChange(index, e.target.value)}
          required
        />
      ))}
      <button type="button" onClick={addTestLink}>
        + Add More Test Links
      </button>

      <label>Upload Notes (PDF):</label>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />

      <button type="submit" disabled={uploading}>
        {uploading ? "Uploading..." : "Add Chapter"}
      </button>
    </form>
  );
};

export default ChapterForm;