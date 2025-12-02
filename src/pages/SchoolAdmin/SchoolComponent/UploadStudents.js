// src/components/StudentCSVUpload.js
import React, { useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

const UploadStudents = ({ schoolId }) => {
  const [students, setStudents] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        setStudents(results.data); // array of student objects
      },
    });
  };

  const uploadToFirestore = async () => {
    setUploadStatus("Uploading...");
    try {
      for (const student of students) {
        const studentRef = doc(db, `schools/${schoolId}/students/${student.studentId}`);
        await setDoc(studentRef, {
          ...student,
          timestamp: new Date(),
        });
      }
      setUploadStatus("✅ Students uploaded successfully!");
    } catch (error) {
      setUploadStatus("❌ Upload failed: " + error.message);
    }
  };

  return (
    <div className="csv-upload-container">
      <h2>Upload Student CSV</h2>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      {students.length > 0 && (
        <>
          <p>{students.length} students ready to upload</p>
          <button onClick={uploadToFirestore}>Upload to Database</button>
        </>
      )}
      {uploadStatus && <p>{uploadStatus}</p>}
    </div>
  );
};

export default UploadStudents;
