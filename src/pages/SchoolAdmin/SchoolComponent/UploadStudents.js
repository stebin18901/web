import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from "firebase/firestore";
import "./UploadStudents.css";

const normalize = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalize(value).toLowerCase();
const hasPaidSchoolAccess = (schoolData) => {
  const rawStatus = schoolData?.isPaidSchool ?? schoolData?.isPaid ?? schoolData?.paymentStatus ?? schoolData?.status;
  if (typeof rawStatus === "boolean") return rawStatus;
  const normalizedStatus = String(rawStatus || "").trim().toLowerCase();
  return ["paid", "active", "true", "yes"].includes(normalizedStatus);
};

const UploadStudents = ({ school, schoolId }) => {
  const emptyStudentRow = {
    fullName: "",
    className: "",
    section: "",
    rollNumber: "",
    pin: "",
    phone: "",
    email: "",
  };
  const [students, setStudents] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeTab, setActiveTab] = useState("csv");
  const [sheetRows, setSheetRows] = useState([
    { ...emptyStudentRow },
    { ...emptyStudentRow },
    { ...emptyStudentRow },
  ]);
  const [isPaidSchool, setIsPaidSchool] = useState(false);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [resolvedSchool, setResolvedSchool] = useState(school || null);

  const normalizedSchoolId = useMemo(() => normalize(schoolId).toLowerCase(), [schoolId]);
  const rawSchoolId = useMemo(() => normalize(schoolId), [schoolId]);

  useEffect(() => {
    setResolvedSchool(school || null);
    if (school) {
      setIsPaidSchool(hasPaidSchoolAccess(school));
    }
  }, [school]);

  useEffect(() => {
    const loadSchoolAccess = async () => {
      setLoadingSchool(true);
      try {
        const directCandidates = [rawSchoolId, normalizedSchoolId].filter(Boolean);
        for (const candidate of directCandidates) {
          const schoolSnap = await getDoc(doc(db, "schools", candidate));
          if (schoolSnap.exists()) {
            const nextSchool = { id: schoolSnap.id, ...schoolSnap.data() };
            setResolvedSchool(nextSchool);
            setIsPaidSchool(hasPaidSchoolAccess(nextSchool));
            setLoadingSchool(false);
            return;
          }
        }

        const bySchoolId = await getDocs(
          query(collection(db, "schools"), where("schoolId", "==", normalizedSchoolId), limit(1))
        );
        if (!bySchoolId.empty) {
          const match = bySchoolId.docs[0];
          const nextSchool = { id: match.id, ...match.data() };
          setResolvedSchool(nextSchool);
          setIsPaidSchool(hasPaidSchoolAccess(nextSchool));
          setLoadingSchool(false);
          return;
        }

        const allSchools = await getDocs(collection(db, "schools"));
        const matchedSchool = allSchools.docs.find((entry) => {
          const data = entry.data() || {};
          return [entry.id, data.schoolId]
            .filter(Boolean)
            .some((value) => normalizeSchoolId(value) === normalizedSchoolId);
        });

        if (matchedSchool) {
          const nextSchool = { id: matchedSchool.id, ...matchedSchool.data() };
          setResolvedSchool(nextSchool);
          setIsPaidSchool(hasPaidSchoolAccess(nextSchool));
        } else {
          setResolvedSchool(null);
          setIsPaidSchool(false);
        }
      } catch (error) {
        console.error("Failed to load school payment status:", error);
        setResolvedSchool(null);
        setIsPaidSchool(false);
      } finally {
        setLoadingSchool(false);
      }
    };

    if (!rawSchoolId && !normalizedSchoolId) {
      setLoadingSchool(false);
      return;
    }

    loadSchoolAccess();
  }, [normalizedSchoolId, rawSchoolId]);

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
            phone: normalize(row.phone || row.phoneNumber || row.mobile),
            email: normalize(row.email).toLowerCase(),
          }))
          .filter((s) => s.fullName && s.className && s.rollNumber && s.pin);

        setStudents(parsed);
      },
    });
  };

  const updateSheetRow = (index, field, value) => {
    setSheetRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: field === "email" ? normalize(value).toLowerCase() : value,
            }
          : row
      )
    );
  };

  const addSheetRow = () => {
    setSheetRows((prev) => [...prev, { ...emptyStudentRow }]);
  };

  const removeSheetRow = (index) => {
    setSheetRows((prev) => (prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index)));
  };

  const addSpreadsheetStudents = () => {
    const validRows = sheetRows
      .map((row) => ({
        fullName: normalize(row.fullName),
        className: normalize(row.className),
        section: normalize(row.section),
        rollNumber: normalize(row.rollNumber),
        pin: normalize(row.pin),
        phone: normalize(row.phone),
        email: normalize(row.email).toLowerCase(),
      }))
      .filter((row) => row.fullName && row.className && row.rollNumber && row.pin);

    if (!validRows.length) return;

    setStudents((prev) => [...prev, ...validRows]);
    setSheetRows([{ ...emptyStudentRow }, { ...emptyStudentRow }, { ...emptyStudentRow }]);
  };

  const uploadToFirestore = async () => {
    if (!normalizedSchoolId || students.length === 0 || !isPaidSchool) return;

    setUploadStatus("Uploading students...");

    try {
      // fetch school's current plan configuration to attach to student records
      const schoolData = resolvedSchool || {};
      const schoolIsPaid = hasPaidSchoolAccess(schoolData);
      const selectedPlanId = schoolData.selectedPlanId || "";
      const selectedPlanName = schoolData.selectedPlanName || "";
      const planAmount = Number(schoolData.planAmount || 0);
      const feeCollectionCycle = normalize(schoolData.feeCollectionCycle || "monthly").toLowerCase() || "monthly";
      const feeAmount = Number(schoolData.feeAmount || 0);
      const seenIds = new Set();

      for (const student of students) {
        const normalizedClassName = normalize(student.className);
        const normalizedRoll = normalize(student.rollNumber);
        const studentId = `${normalizedSchoolId}_${normalizedClassName}_${normalizedRoll}`;

        if (seenIds.has(studentId)) {
          throw new Error(`Duplicate roll number ${normalizedRoll} found in class ${normalizedClassName} within this upload.`);
        }
        seenIds.add(studentId);

        const existingSnap = await getDoc(doc(db, "studentAccounts", studentId));
        if (existingSnap.exists()) {
          throw new Error(`Roll number ${normalizedRoll} already exists in class ${normalizedClassName}.`);
        }
      }

      const batch = writeBatch(db);

      students.forEach((student) => {
        const id = `${normalizedSchoolId}_${student.className}_${student.rollNumber}`;
        const ref = doc(collection(db, "studentAccounts"), id);

        batch.set(ref, {
          ...student,
          schoolId: normalizedSchoolId,
          phone: normalize(student.phone),
          email: normalize(student.email).toLowerCase(),
          selectedPlanId,
          selectedPlanName,
          planAmount,
          paymentStatus: schoolIsPaid ? "paid" : planAmount ? "pending" : "none",
          registrationStatus: schoolIsPaid ? "active" : planAmount ? "pending_payment" : "free",
          isPaid: schoolIsPaid,
          feeStatus: schoolIsPaid ? "pending" : "not_applicable",
          feeCollectionCycle,
          feeAmount,
          feePaidAmount: 0,
          feePendingAmount: schoolIsPaid ? feeAmount : 0,
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
    <div className="upload-students-page">
      <div className="upload-students-hero">
        <div>
          <p className="upload-students-kicker">Student Import Hub</p>
          <h2>Upload Students</h2>
          <p className="upload-students-subtitle">
            Import student profiles in bulk or add them manually with login and contact details.
          </p>
        </div>
        <div className="upload-students-hero-badge">
          <span>School</span>
          <strong>{resolvedSchool?.schoolName || school?.schoolName || "School Admin"}</strong>
        </div>
      </div>
      {loadingSchool ? (
        <div className="upload-students-state-card">Checking school access...</div>
      ) : !isPaidSchool ? (
        <div className="upload-students-state-card blocked">
          Student upload is available only for schools marked as paid by admin. Keep using the
          normal student payment and registration flow for unpaid schools.
        </div>
      ) : (
        <>
      <div className="upload-students-grid">
      <section className="upload-students-card upload-students-sample-card">
        <div className="upload-students-card-head">
          <div>
            <h3>Sample CSV Format</h3>
            <p>Use these exact column headers in the first row of your CSV file.</p>
          </div>
        </div>
        <pre className="upload-students-code-block">
{`fullName,className,section,rollNumber,pin,phone,email
Pavan Kumar,10,A,1,1234,9876543210,pavan@example.com
Maria S,10,A,2,2345,9876543211,maria@example.com
John D,10,B,1,3456,9876543212,john@example.com
Sarah K,9,C,12,4567,9876543213,sarah@example.com`}
        </pre>
        <p className="upload-students-columns">
          CSV columns: `fullName`, `className`, `section`, `rollNumber`, `pin`, `phone`, `email`
        </p>
      </section>

      <section className="upload-students-card upload-students-workspace-card">
        <div className="upload-students-card-head">
          <div>
            <h3>Import Workspace</h3>
            <p>Switch between bulk CSV import and a full spreadsheet workspace.</p>
          </div>
        </div>
        <div className="upload-students-tabs">
          <button
            type="button"
            className={activeTab === "csv" ? "active" : ""}
            onClick={() => setActiveTab("csv")}
          >
            CSV Upload
          </button>
          <button
            type="button"
            className={activeTab === "sheet" ? "active" : ""}
            onClick={() => setActiveTab("sheet")}
          >
            Spreadsheet Input
          </button>
        </div>

        {activeTab === "csv" ? (
          <section className="upload-students-tab-panel">
            <div className="upload-students-partition-head">
              <span className="upload-students-partition-tag">Bulk Import</span>
              <h4>CSV Upload</h4>
              <p>Best for bulk import from Excel or any admin sheet exported as CSV.</p>
            </div>
            <label className="upload-students-file-picker">
              <span>Select CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} />
            </label>
          </section>
        ) : (
          <section className="upload-students-tab-panel upload-students-sheet-panel">
            <div className="upload-students-partition-head">
              <span className="upload-students-partition-tag">Full Workspace</span>
              <h4>Spreadsheet Input</h4>
              <p>Fill rows directly here when you want to build the student list inside the app.</p>
            </div>
            <div className="upload-students-sheet-wrap full-size">
              <div className="upload-students-sheet">
                <div className="upload-students-sheet-head">Full Name</div>
                <div className="upload-students-sheet-head">Class</div>
                <div className="upload-students-sheet-head">Section</div>
                <div className="upload-students-sheet-head">Roll No</div>
                <div className="upload-students-sheet-head">PIN</div>
                <div className="upload-students-sheet-head">Phone</div>
                <div className="upload-students-sheet-head">Email</div>
                <div className="upload-students-sheet-head">Action</div>
                {sheetRows.map((row, index) => (
                  <React.Fragment key={`sheet-row-${index}`}>
                    <input value={row.fullName} onChange={(e) => updateSheetRow(index, "fullName", e.target.value)} placeholder="Student name" />
                    <input value={row.className} onChange={(e) => updateSheetRow(index, "className", e.target.value)} placeholder="10" />
                    <input value={row.section} onChange={(e) => updateSheetRow(index, "section", e.target.value)} placeholder="A" />
                    <input value={row.rollNumber} onChange={(e) => updateSheetRow(index, "rollNumber", e.target.value)} placeholder="1" />
                    <input value={row.pin} onChange={(e) => updateSheetRow(index, "pin", e.target.value)} placeholder="1234" />
                    <input value={row.phone} onChange={(e) => updateSheetRow(index, "phone", e.target.value)} placeholder="9876543210" />
                    <input value={row.email} onChange={(e) => updateSheetRow(index, "email", e.target.value)} placeholder="student@email.com" />
                    <button type="button" className="upload-students-sheet-remove" onClick={() => removeSheetRow(index)}>
                      Remove
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="upload-students-actions between">
              <button type="button" className="upload-students-secondary-btn" onClick={addSheetRow}>
                Add Row
              </button>
              <button type="button" className="upload-students-primary-btn" onClick={addSpreadsheetStudents}>
                Add Spreadsheet Rows
              </button>
            </div>
          </section>
        )}
      </section>
      </div>

      <section className="upload-students-card upload-students-preview-card">
        <div className="upload-students-card-head">
          <div>
            <h3>Ready to Upload</h3>
            <p>{students.length} student{students.length === 1 ? "" : "s"} currently staged for import.</p>
          </div>
          <button
            type="button"
            className="upload-students-primary-btn"
            onClick={uploadToFirestore}
            disabled={students.length === 0}
          >
            Upload to Database
          </button>
        </div>

        {students.length > 0 ? (
          <div className="upload-students-preview-list">
            {students.slice(0, 12).map((s, i) => (
              <article key={`${s.rollNumber}-${i}`} className="upload-students-preview-item">
                <strong>{s.fullName}</strong>
                <span>Class {s.className} {s.section ? `· ${s.section}` : ""}</span>
                <span>Roll {s.rollNumber}</span>
                {s.phone ? <span>{s.phone}</span> : null}
                {s.email ? <span>{s.email}</span> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="upload-students-empty">
            No students added yet. Import a CSV or use the manual form above.
          </div>
        )}

        {uploadStatus ? <p className="upload-students-status">{uploadStatus}</p> : null}
      </section>
        </>
      )}
    </div>
  );
};

export default UploadStudents;
