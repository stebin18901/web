import React, { useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, addDoc } from "firebase/firestore";
import "./SchoolQuiz.css";
import ChapterList from "../../components/ChapterList";

const SchoolQuiz = () => {
  const [subject, setSubject] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [testLinks, setTestLinks] = useState([""]); // Array of test links
  const [responseUrl, setResponseUrl] = useState(""); // Spreadsheet URL for responses
  const [selectedClass, setSelectedClass] = useState(6);
  const [notes, setNotes] = useState(""); // JSON notes field

  // Add a new test link input field
  const handleAddTestLink = () => {
    setTestLinks([...testLinks, ""]);
  };

  // Update a specific test link in the array
  const handleTestLinkChange = (index, value) => {
    const newTestLinks = [...testLinks];
    newTestLinks[index] = value;
    setTestLinks(newTestLinks);
  };

  // Validate test links
  const validateTestLinks = () => {
    for (const link of testLinks) {
      if (!link.includes("UID_PLACEHOLDER")) {
        alert("Each test link must contain 'UID_PLACEHOLDER'.");
        return false;
      }
    }
    return true;
  };

  // Validate response URL
  const validateResponseUrl = () => {
    if (responseUrl && !responseUrl.includes("https://docs.google.com/spreadsheets/")) {
      alert("Please enter a valid Google Sheets URL");
      return false;
    }
    return true;
  };

  // Validate JSON notes
  const validateNotes = () => {
    if (notes.trim() === "") return true; // Empty is allowed
    
    try {
      JSON.parse(notes);
      return true;
    } catch (e) {
      alert("Please enter valid JSON for notes");
      return false;
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate test links, response URL, and notes
    if (!validateTestLinks() || !validateResponseUrl() || !validateNotes()) {
      return;
    }

    try {
      // Parse notes if they exist
      const notesData = notes.trim() ? JSON.parse(notes) : null;

      // Add a new document to the "chapters" collection
      await addDoc(collection(db, "chapters"), {
        subject,
        class: selectedClass,
        chapterName,
        testLinks, // Save testLinks as an array
        responseUrl, // Save the response spreadsheet URL
        notes: notesData, // Save parsed notes data
      });

      alert("Chapter added successfully!");
      setSubject("");
      setChapterName("");
      setTestLinks([""]); // Reset test links
      setResponseUrl(""); // Reset response URL
      setNotes(""); // Reset notes
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("Failed to add chapter. Please try again.");
    }
  };

  return (
    <div className="admin-panel-container">
      <h1>Admin Chapter</h1>
      <form onSubmit={handleSubmit}>
        {/* Subject Dropdown */}
        <div className="form-group">
          <label>Subject:</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          >
            <option value="">Select Subject</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Physics">Physics</option>
            <option value="Chemistry">Chemistry</option>
            <option value="Biology">Biology</option>
            <option value="Social Studies">Social Studies</option>
          </select>
        </div>

        {/* Class Dropdown */}
        <div className="form-group">
          <label>Class:</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(parseInt(e.target.value))}
            required
          >
            {[6, 7, 8, 9].map((cls) => (
              <option key={cls} value={cls}>
                Class {cls}
              </option>
            ))}
          </select>
        </div>

        {/* Chapter Name Input */}
        <div className="form-group">
          <label>Chapter Name:</label>
          <input
            type="text"
            value={chapterName}
            onChange={(e) => setChapterName(e.target.value)}
            required
          />
        </div>

        {/* Test Links Input */}
        <div className="form-group">
          <label>Test Links (Google Forms):</label>
          {testLinks.map((link, index) => (
            <input
              key={index}
              type="text"
              value={link}
              onChange={(e) => handleTestLinkChange(index, e.target.value)}
              placeholder="Enter Google Form link with UID_PLACEHOLDER"
              required
            />
          ))}
          <button type="button" onClick={handleAddTestLink}>
            + Add More Test Links
          </button>
        </div>

        {/* Response URL Input */}
        <div className="form-group">
          <label>Response Spreadsheet URL:</label>
          <input
            type="text"
            value={responseUrl}
            onChange={(e) => setResponseUrl(e.target.value)}
            placeholder="Enter Google Sheets URL where responses will be saved"
          />
        </div>

        {/* Notes Input (JSON) */}
        <div className="form-group">
          <label>Notes (JSON format):</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Enter notes in JSON format (optional)"
            rows={5}
          />
          <small>Example: {"{\"key1\": \"value1\", \"key2\": \"value2\"}"}</small>
        </div>

        {/* Submit Button */}
        <button type="submit">Create Chapter</button>
      </form>

      {/* Display Chapter List */}
      <ChapterList />
    </div>
  );
};

export default SchoolQuiz;