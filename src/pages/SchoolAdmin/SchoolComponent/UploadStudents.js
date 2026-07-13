import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from "firebase/firestore";
import "./UploadStudents.css";

const normalize = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalize(value).toLowerCase();
const inferSectionFromClassName = (value) => {
  const trimmed = normalize(value);
  const matched = trimmed.match(/^(\d+)\s*([A-Za-z]+)$/);
  return matched?.[2]?.toUpperCase() || "";
};
const hasPaidSchoolAccess = (schoolData) => {
  const explicitPaid = schoolData?.isPaidSchool === true || schoolData?.isPaid === true;
  const paymentStatus = String(schoolData?.paymentStatus || "").trim().toLowerCase();
  const status = String(schoolData?.status || "").trim().toLowerCase();
  return explicitPaid || ["paid", "active", "true", "yes"].includes(paymentStatus) || ["paid", "active", "true", "yes"].includes(status);
};

const UploadStudents = ({ school, schoolId, forcePaidAccess = false }) => {
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
  const [classOptions, setClassOptions] = useState([]);
  const [useSamePin, setUseSamePin] = useState(false);
  const [sharedPin, setSharedPin] = useState("");
  const [isPaidSchool, setIsPaidSchool] = useState(false);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [resolvedSchool, setResolvedSchool] = useState(school || null);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);

  const normalizedSchoolId = useMemo(() => normalize(schoolId).toLowerCase(), [schoolId]);
  const rawSchoolId = useMemo(() => normalize(schoolId), [schoolId]);
  const propSchoolIsPaid = useMemo(() => forcePaidAccess || hasPaidSchoolAccess(school), [forcePaidAccess, school]);

  useEffect(() => {
    setResolvedSchool(school || null);
    if (school) {
      setIsPaidSchool(forcePaidAccess || hasPaidSchoolAccess(school));
      return;
    }
    if (forcePaidAccess) {
      setIsPaidSchool(true);
    }
  }, [forcePaidAccess, school]);

  useEffect(() => {
    const loadSchoolAccess = async () => {
      setLoadingSchool(true);
      try {
        const directCandidates = [school?.id, rawSchoolId, normalizedSchoolId].filter(Boolean);
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

        for (const candidate of [rawSchoolId, normalizedSchoolId].filter(Boolean)) {
          const bySchoolId = await getDocs(
            query(collection(db, "schools"), where("schoolId", "==", candidate), limit(1))
          );
          if (!bySchoolId.empty) {
            const match = bySchoolId.docs[0];
            const nextSchool = { id: match.id, ...match.data() };
            setResolvedSchool(nextSchool);
            setIsPaidSchool(hasPaidSchoolAccess(nextSchool));
            setLoadingSchool(false);
            return;
          }
        }

        const allSchools = await getDocs(collection(db, "schools"));
        const matchedSchool = allSchools.docs.find((entry) => {
          const data = entry.data() || {};
          return [entry.id, data.schoolId]
            .filter(Boolean)
            .some((value) => {
              const normalizedValue = normalizeSchoolId(value);
              return normalizedValue === normalizedSchoolId || normalizedValue === normalizeSchoolId(rawSchoolId);
            });
        });

        if (matchedSchool) {
          const nextSchool = { id: matchedSchool.id, ...matchedSchool.data() };
          setResolvedSchool(nextSchool);
          setIsPaidSchool(hasPaidSchoolAccess(nextSchool));
        } else {
          setResolvedSchool((prev) => prev || school || null);
          setIsPaidSchool((prev) => prev || propSchoolIsPaid);
        }
      } catch (error) {
        console.error("Failed to load school payment status:", error);
        setResolvedSchool((prev) => prev || school || null);
        setIsPaidSchool((prev) => prev || propSchoolIsPaid);
      } finally {
        setLoadingSchool(false);
      }
    };

    if (!rawSchoolId && !normalizedSchoolId) {
      setIsPaidSchool((prev) => prev || propSchoolIsPaid);
      setLoadingSchool(false);
      return;
    }

    loadSchoolAccess();
  }, [normalizedSchoolId, propSchoolIsPaid, rawSchoolId, school]);

  useEffect(() => {
    const loadClassOptions = async () => {
      if (!normalizedSchoolId && !rawSchoolId) {
        setClassOptions([]);
        return;
      }

      try {
        const candidateIds = Array.from(new Set([normalizedSchoolId, rawSchoolId].filter(Boolean)));
        const snapshots = await Promise.all(
          candidateIds.map((candidate) => getDocs(query(collection(db, "classes"), where("schoolId", "==", candidate))))
        );

        const optionsMap = new Map();
        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((entry) => {
            const data = entry.data() || {};
            const className = normalize(data.className || data.name);
            if (!className) return;
            optionsMap.set(className, {
              className,
              section: normalize(data.section) || inferSectionFromClassName(className),
            });
          });
        });

        setClassOptions(
          Array.from(optionsMap.values()).sort((left, right) =>
            left.className.localeCompare(right.className, undefined, { numeric: true, sensitivity: "base" })
          )
        );
      } catch (error) {
        console.error("Failed to load school classes for upload workspace:", error);
        setClassOptions([]);
      }
    };

    loadClassOptions();
  }, [normalizedSchoolId, rawSchoolId]);

  useEffect(() => {
    if (!useSamePin) return;
    setSheetRows((prev) =>
      prev.map((row) => ({
        ...row,
        pin: sharedPin,
      }))
    );
  }, [sharedPin, useSamePin]);

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
              ...(field === "className"
                ? {
                    className: value,
                    section:
                      classOptions.find((option) => option.className === value)?.section || inferSectionFromClassName(value),
                  }
                : null),
              ...(field === "pin" && useSamePin ? { pin: sharedPin } : null),
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
    setSharedPin("");
    setUseSamePin(false);
  };

  const uploadToFirestore = async () => {
    if (!normalizedSchoolId || students.length === 0 || (!isPaidSchool && !forcePaidAccess)) return;

    setUploadStatus("Uploading students...");

    try {
      // fetch school's current plan configuration to attach to student records
      const schoolData = resolvedSchool || {};
      const schoolIsPaid = forcePaidAccess || hasPaidSchoolAccess(schoolData);
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

  const requestUploadConfirmation = () => {
    if (!students.length) {
      setUploadStatus("Add at least one student before uploading.");
      return;
    }
    setConfirmUploadOpen(true);
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
      ) : !(isPaidSchool || forcePaidAccess) ? (
        <div className="upload-students-state-card blocked">
          Student upload is available only for schools marked as paid by admin. Keep using the
          normal student payment and registration flow for unpaid schools.
        </div>
      ) : (
        <>
      <div className="upload-students-grid">
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
              <p>Choose classes from your existing school setup and fill the student rows directly here.</p>
            </div>
            <div className="upload-students-sheet-toolbar">
              <div className="upload-students-sheet-toolbar-copy">
                <strong>Class source</strong>
                <span>
                  {classOptions.length
                    ? `${classOptions.length} class${classOptions.length === 1 ? "" : "es"} available from your school setup`
                    : "No created classes found yet. Create classes first to get guided selection here."}
                </span>
              </div>
              <label className="upload-students-pin-toggle">
                <input
                  type="checkbox"
                  checked={useSamePin}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setUseSamePin(checked);
                    if (!checked) {
                      setSharedPin("");
                    }
                  }}
                />
                <span>Same PIN for all</span>
              </label>
              {useSamePin ? (
                <div className="upload-students-shared-pin">
                  <span>Common PIN</span>
                  <input
                    type="text"
                    value={sharedPin}
                    onChange={(event) => setSharedPin(normalize(event.target.value))}
                    placeholder="Enter one PIN for all rows"
                  />
                </div>
              ) : null}
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
                    <select value={row.className} onChange={(e) => updateSheetRow(index, "className", e.target.value)}>
                      <option value="">{classOptions.length ? "Select class" : "No classes available"}</option>
                      {classOptions.map((option) => (
                        <option key={option.className} value={option.className}>
                          {option.className}
                        </option>
                      ))}
                    </select>
                    <input value={row.section} readOnly placeholder="Auto" />
                    <input value={row.rollNumber} onChange={(e) => updateSheetRow(index, "rollNumber", e.target.value)} placeholder="1" />
                    <input
                      value={useSamePin ? sharedPin : row.pin}
                      onChange={(e) => updateSheetRow(index, "pin", e.target.value)}
                      placeholder="1234"
                      readOnly={useSamePin}
                    />
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
            onClick={requestUploadConfirmation}
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

      {confirmUploadOpen ? (
        <div className="upload-students-modal-overlay" onClick={() => setConfirmUploadOpen(false)}>
          <div className="upload-students-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Upload students to live database?</h4>
            <p>
              This will create {students.length} student account{students.length === 1 ? "" : "s"} for{" "}
              {resolvedSchool?.schoolName || school?.schoolName || "this school"}.
            </p>
            <div className="upload-students-modal-note">
              Duplicate class and roll number checks will run before the final save.
            </div>
            <div className="upload-students-modal-actions">
              <button type="button" className="upload-students-secondary-btn" onClick={() => setConfirmUploadOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="upload-students-primary-btn"
                onClick={async () => {
                  setConfirmUploadOpen(false);
                  await uploadToFirestore();
                }}
              >
                Confirm Upload
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UploadStudents;
