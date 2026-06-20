import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { collection, doc, writeBatch, getDoc } from "firebase/firestore";

const normalize = (value) => String(value || "").trim();

const UploadStudents = ({ schoolId }) => {
  const [students, setStudents] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [manual, setManual] = useState({ fullName: "", className: "", section: "", rollNumber: "", pin: "" });

  const normalizedSchoolId = useMemo(() => normalize(schoolId).toLowerCase(), [schoolId]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed = data
          .map((row) => ({
            fullName: normalize(row.fullName || row.name),
            className: normalize(row.className || row.class),
            section: normalize(row.section),
            rollNumber: normalize(row.rollNumber || row.roll),
            pin: normalize(row.pin || row.password),
          }))
          .filter((s) => s.fullName && s.className && s.rollNumber && s.pin);

        setStudents(parsed);
      },
    });
  };

  const addManualStudent = () => {
    if (!manual.fullName || !manual.className || !manual.rollNumber || !manual.pin) return;
    setStudents((prev) => [...prev, manual]);
    setManual({ fullName: "", className: "", section: "", rollNumber: "", pin: "" });
  };

  const uploadToFirestore = async () => {
    if (!normalizedSchoolId || students.length === 0) return;

    setUploadStatus("Uploading students...");

    try {
      // fetch school's current plan configuration to attach to student records
      const schoolSnap = await getDoc(doc(db, "schools", normalizedSchoolId));
      const schoolData = schoolSnap.exists() ? schoolSnap.data() : {};
      const selectedPlanId = schoolData.selectedPlanId || "";
      const selectedPlanName = schoolData.selectedPlanName || "";
      const planAmount = Number(schoolData.planAmount || 0);

      const batch = writeBatch(db);

      students.forEach((student) => {
        const id = `${normalizedSchoolId}_${student.className}_${student.rollNumber}`;
        const ref = doc(collection(db, "studentAccounts"), id);

        batch.set(ref, {
          ...student,
          schoolId: normalizedSchoolId,
          selectedPlanId,
          selectedPlanName,
          planAmount,
          paymentStatus: planAmount ? "pending" : "none",
          registrationStatus: planAmount ? "pending_payment" : "free",
          isPaid: false,
          createdAt: new Date(),
        });
      });

      await batch.commit();
      setUploadStatus(`Uploaded ${students.length} students successfully.`);
      setStudents([]);
    } catch (error) {
      setUploadStatus(`Upload failed: ${error.message}`);
    }
  };

  return (
    <div className="csv-upload-container">
      <h2>Upload Students</h2>
      <p>CSV columns: fullName, className, section, rollNumber, pin</p>
      <input type="file" accept=".csv" onChange={handleFileUpload} />

      <hr style={{ margin: "16px 0" }} />

      <h3>Add Student Manually</h3>
      <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <input placeholder="Full Name" value={manual.fullName} onChange={(e) => setManual((p) => ({ ...p, fullName: e.target.value }))} />
        <input placeholder="Class" value={manual.className} onChange={(e) => setManual((p) => ({ ...p, className: e.target.value }))} />
        <input placeholder="Section" value={manual.section} onChange={(e) => setManual((p) => ({ ...p, section: e.target.value }))} />
        <input placeholder="Roll Number" value={manual.rollNumber} onChange={(e) => setManual((p) => ({ ...p, rollNumber: e.target.value }))} />
        <input placeholder="PIN / Password" value={manual.pin} onChange={(e) => setManual((p) => ({ ...p, pin: e.target.value }))} />
        <button onClick={addManualStudent}>Add to List</button>
      </div>

      {students.length > 0 && (
        <>
          <p style={{ marginTop: 16 }}>{students.length} students ready</p>
          <button onClick={uploadToFirestore}>Upload to Database</button>
          <ul>
            {students.slice(0, 8).map((s, i) => (
              <li key={`${s.rollNumber}-${i}`}>{s.fullName} | Class {s.className} | Roll {s.rollNumber}</li>
            ))}
          </ul>
        </>
      )}

      {uploadStatus && <p>{uploadStatus}</p>}
    </div>
  );
};

export default UploadStudents;
