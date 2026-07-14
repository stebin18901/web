import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from "firebase/firestore";
import "./UploadStudents.css";

const normalize = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalize(value).toLowerCase();
const sortStudentsAlphabetically = (left, right) => {
  const leftName = normalize(left.fullName || left.name);
  const rightName = normalize(right.fullName || right.name);
  if (!leftName && rightName) return 1;
  if (leftName && !rightName) return -1;
  const nameCompare = leftName.localeCompare(rightName, undefined, {
    sensitivity: "base",
    numeric: true,
  });
  if (nameCompare !== 0) return nameCompare;
  return normalize(left.rollNumber).localeCompare(normalize(right.rollNumber), undefined, {
    numeric: true,
    sensitivity: "base",
  });
};
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
  const createRowId = () => `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const emptyStudentRow = {
    rowId: "",
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
  const [sheetRows, setSheetRows] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [registeredStudentsByClass, setRegisteredStudentsByClass] = useState({});
  const [registeredStudentsMeta, setRegisteredStudentsMeta] = useState({});
  const [sheetClassName, setSheetClassName] = useState("");
  const [sheetStudentCount, setSheetStudentCount] = useState("5");
  const [useSamePin, setUseSamePin] = useState(false);
  const [sharedPin, setSharedPin] = useState("");
  const [isPaidSchool, setIsPaidSchool] = useState(false);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [resolvedSchool, setResolvedSchool] = useState(school || null);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [savedSheetRowIds, setSavedSheetRowIds] = useState([]);

  const buildStudentKey = (student) =>
    `${normalize(student.className).toUpperCase()}__${normalize(student.rollNumber)}`;
  const getStudentClassKey = (student) => normalize(student.className).toUpperCase();

  const buildSortedNewRows = (rows, className, fallbackSection, startRoll = 1) => {
    const sortedRows = [...rows].sort(sortStudentsAlphabetically);

    return sortedRows.map((row, index) => ({
      ...row,
      rowId: row.rowId || createRowId(),
      className: row.className || className,
      section: row.section || fallbackSection,
      rollNumber: String(startRoll + index),
    }));
  };

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
    const loadRegisteredStudentsMeta = async () => {
      if (!normalizedSchoolId) {
        setRegisteredStudentsMeta({});
        return;
      }

      try {
        const snap = await getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId)));
        const meta = {};
        const groupedStudents = {};

        snap.docs.forEach((entry) => {
          const data = entry.data() || {};
          const className = normalize(data.className).toUpperCase();
          if (!className) return;

          const rollNumber = Number(normalize(data.rollNumber));
          const current = meta[className] || { count: 0, maxRoll: 0 };
          meta[className] = {
            count: current.count + 1,
            maxRoll: Number.isFinite(rollNumber) ? Math.max(current.maxRoll, rollNumber) : current.maxRoll,
          };
          if (!groupedStudents[className]) groupedStudents[className] = [];
          groupedStudents[className].push({
            id: entry.id,
            fullName: normalize(data.fullName || data.name),
            rollNumber: normalize(data.rollNumber),
            phone: normalize(data.phone || data.parentPhone),
            email: normalize(data.email).toLowerCase(),
          });
        });

        Object.keys(groupedStudents).forEach((className) => {
          groupedStudents[className].sort(sortStudentsAlphabetically);
        });

        setRegisteredStudentsMeta(meta);
        setRegisteredStudentsByClass(groupedStudents);
      } catch (error) {
        console.error("Failed to load registered students for spreadsheet generator:", error);
        setRegisteredStudentsMeta({});
        setRegisteredStudentsByClass({});
      }
    };

    loadRegisteredStudentsMeta();
  }, [normalizedSchoolId]);

  useEffect(() => {
    if (!useSamePin) return;
    setSheetRows((prev) =>
      prev.map((row) => ({
        ...row,
        pin: sharedPin,
      }))
    );
  }, [sharedPin, useSamePin]);

  useEffect(() => {
    if (sheetClassName || !classOptions.length) return;
    setSheetClassName(classOptions[0]?.className || "");
  }, [classOptions, sheetClassName]);

  useEffect(() => {
    setSavedSheetRowIds((prev) =>
      prev.filter((rowId) => sheetRows.some((row) => row.rowId === rowId))
    );
  }, [sheetRows]);

  const getEffectiveStartRoll = (className = sheetClassName) => {
    const classKey = normalize(className).toUpperCase();
    const classMeta = registeredStudentsMeta[classKey] || { maxRoll: 0 };
    const stagedMaxRoll = students
      .filter((student) => getStudentClassKey(student) === classKey)
      .reduce((maxValue, student) => {
        const rollNumber = Number(normalize(student.rollNumber));
        return Number.isFinite(rollNumber) ? Math.max(maxValue, rollNumber) : maxValue;
      }, 0);

    return Math.max(Number(classMeta.maxRoll || 0), stagedMaxRoll) + 1;
  };

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

  const updateSheetRow = (rowId, field, value) => {
    setSheetRows((prev) => {
      const nextRows = prev.map((row, rowIndex) =>
        row.rowId === rowId
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
      );

      const selectedClass = classOptions.find((option) => option.className === (field === "className" ? value : sheetClassName));
      const classNameValue = selectedClass?.className || sheetClassName;
      const sectionValue = selectedClass?.section || inferSectionFromClassName(classNameValue);
      const startRoll = getEffectiveStartRoll(classNameValue);

      return buildSortedNewRows(nextRows, classNameValue, sectionValue, startRoll);
    });
    setSavedSheetRowIds((prev) => prev.filter((savedRowId) => savedRowId !== rowId));
  };

  const generateSheetRows = () => {
    const selectedClass = classOptions.find((option) => option.className === sheetClassName);
    if (!selectedClass) {
      setUploadStatus("Choose a class before generating spreadsheet rows.");
      return;
    }

    const rowCount = Math.max(1, Math.min(200, Number(sheetStudentCount || 0)));
    if (!rowCount) {
      setUploadStatus("Enter how many extra rows you want to add.");
      return;
    }

    const rollStart = getEffectiveStartRoll(selectedClass.className);
    const generatedRows = Array.from({ length: rowCount }, () => ({
      ...emptyStudentRow,
      rowId: createRowId(),
      className: selectedClass.className,
      section: selectedClass.section,
      pin: useSamePin ? sharedPin : "",
      rollNumber: "",
    }));

    setSheetRows((prev) =>
      buildSortedNewRows(
        [...prev, ...generatedRows],
        selectedClass.className,
        selectedClass.section,
        rollStart
      )
    );
    setSavedSheetRowIds([]);
    setUploadStatus(
      `Added ${rowCount} new row${rowCount === 1 ? "" : "s"} for ${selectedClass.className}.`
    );
  };

  const selectedClassMeta = useMemo(() => {
    const classKey = normalize(sheetClassName).toUpperCase();
    const baseMeta = registeredStudentsMeta[classKey] || { count: 0, maxRoll: 0 };
    const stagedForClass = students.filter((student) => getStudentClassKey(student) === classKey);
    const stagedMaxRoll = stagedForClass.reduce((maxValue, student) => {
      const rollNumber = Number(normalize(student.rollNumber));
      return Number.isFinite(rollNumber) ? Math.max(maxValue, rollNumber) : maxValue;
    }, 0);

    return {
      count: baseMeta.count + stagedForClass.length,
      maxRoll: Math.max(Number(baseMeta.maxRoll || 0), stagedMaxRoll),
      registeredCount: baseMeta.count,
      stagedCount: stagedForClass.length,
    };
  }, [registeredStudentsMeta, sheetClassName, students]);

  const selectedClassRegisteredStudents = useMemo(() => {
    const classKey = normalize(sheetClassName).toUpperCase();
    return registeredStudentsByClass[classKey] || [];
  }, [registeredStudentsByClass, sheetClassName]);

  const mergedSheetRows = useMemo(() => {
    const mergedRows = [
      ...selectedClassRegisteredStudents.map((student) => ({
        ...student,
        className: sheetClassName,
        section:
          classOptions.find((option) => option.className === sheetClassName)?.section ||
          inferSectionFromClassName(sheetClassName),
        entrySource: "existing",
      })),
      ...sheetRows.map((row, index) => ({
        ...row,
        entrySource: savedSheetRowIds.includes(row.rowId) ? "saved" : "new",
        rowIndex: index,
      })),
    ].sort(sortStudentsAlphabetically);

    return mergedRows.map((row, index) => ({
      ...row,
      displayRollNumber: String(index + 1),
    }));
  }, [classOptions, selectedClassRegisteredStudents, sheetClassName, sheetRows]);

  const newSheetRowCount = useMemo(
    () => mergedSheetRows.filter((row) => row.entrySource === "new").length,
    [mergedSheetRows]
  );
  const savedSheetRowCount = useMemo(
    () => mergedSheetRows.filter((row) => row.entrySource === "saved").length,
    [mergedSheetRows]
  );

  const addSheetRow = () => {
    const selectedClass = classOptions.find((option) => option.className === sheetClassName);
    setSheetRows((prev) => {
      const nextRows = [
        ...prev,
        {
          ...emptyStudentRow,
          rowId: createRowId(),
          className: selectedClass?.className || "",
          section: selectedClass?.section || "",
          pin: useSamePin ? sharedPin : "",
          rollNumber: "",
        },
      ];
      return buildSortedNewRows(
        nextRows,
        selectedClass?.className || sheetClassName,
        selectedClass?.section || inferSectionFromClassName(selectedClass?.className || sheetClassName),
        getEffectiveStartRoll(selectedClass?.className || sheetClassName)
      );
    });
    setSavedSheetRowIds([]);
  };

  const removeSheetRow = (rowId) => {
    setSheetRows((prev) => {
      if (prev.length === 1) return prev;
      const remainingRows = prev.filter((row) => row.rowId !== rowId);
      const selectedClass = classOptions.find((option) => option.className === sheetClassName);
      return buildSortedNewRows(
        remainingRows,
        selectedClass?.className || sheetClassName,
        selectedClass?.section || inferSectionFromClassName(selectedClass?.className || sheetClassName),
        getEffectiveStartRoll(selectedClass?.className || sheetClassName)
      );
    });
    setSavedSheetRowIds((prev) => prev.filter((savedRowId) => savedRowId !== rowId));
  };

  const addSpreadsheetStudents = () => {
    const normalizedRows = buildSortedNewRows(
      sheetRows,
      sheetClassName,
      classOptions.find((option) => option.className === sheetClassName)?.section ||
        inferSectionFromClassName(sheetClassName),
      getEffectiveStartRoll(sheetClassName)
    );

    const incompleteRows = normalizedRows.filter(
      (row) => !normalize(row.fullName) || !normalize(row.className) || !normalize(row.rollNumber) || !normalize(row.pin)
    );

    const preparedRows = normalizedRows
      .filter((row) => normalize(row.fullName) && normalize(row.className) && normalize(row.rollNumber) && normalize(row.pin))
      .map((row) => ({
        rowId: row.rowId,
        fullName: normalize(row.fullName),
        className: normalize(row.className),
        section: normalize(row.section),
        rollNumber: normalize(row.rollNumber),
        pin: normalize(row.pin),
        phone: normalize(row.phone),
        email: normalize(row.email).toLowerCase(),
      }));

    if (!preparedRows.length) {
      setUploadStatus("Enter at least name and PIN for one new student before saving from the spreadsheet.");
      return;
    }

    const existingIds = new Set(students.map((student) => buildStudentKey(student)));
    const duplicateRows = [];
    const nextRows = [];

    preparedRows.forEach((row) => {
      const key = buildStudentKey(row);
      if (existingIds.has(key)) {
        duplicateRows.push(row);
        return;
      }
      existingIds.add(key);
      nextRows.push(row);
    });

    if (!nextRows.length) {
      setUploadStatus(
        duplicateRows.length
          ? "These spreadsheet rows are already saved in the upload list below. Edit or remove them before saving again."
          : "No new spreadsheet rows were ready to save."
      );
      return;
    }

    setStudents((prev) => [
      ...prev,
      ...nextRows.map(({ rowId, ...student }) => student),
    ]);
    setSavedSheetRowIds((prev) => Array.from(new Set([...prev, ...nextRows.map((row) => row.rowId)])));

    const messageParts = [
      `Saved ${nextRows.length} student${nextRows.length === 1 ? "" : "s"} from spreadsheet and kept them visible in the sheet.`,
    ];
    if (incompleteRows.length) {
      messageParts.push(
        `${incompleteRows.length} row${incompleteRows.length === 1 ? "" : "s"} still need name or PIN.`
      );
    }
    if (duplicateRows.length) {
      messageParts.push(
        `${duplicateRows.length} row${duplicateRows.length === 1 ? " was" : "s were"} already in Ready to Upload.`
      );
    }
    messageParts.push("Review the Ready to Upload list, then upload to database.");
    setUploadStatus(messageParts.join(" "));
  };

  const removeStagedStudent = (indexToRemove) => {
    setStudents((prev) => prev.filter((_, index) => index !== indexToRemove));
    setUploadStatus("Removed that student from the Ready to Upload list.");
  };

  const clearStagedStudents = () => {
    setStudents([]);
    setUploadStatus("Cleared the Ready to Upload list.");
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
              <p>Review the current class roster first, then add only the new students you still need to create.</p>
            </div>
            <div className="upload-students-sheet-toolbar">
              <div className="upload-students-sheet-toolbar-copy">
                <strong>Class source</strong>
                <span>
                  {classOptions.length
                    ? `${classOptions.length} class${classOptions.length === 1 ? "" : "es"} available from your school setup`
                    : "No created classes found yet. Create classes first to get guided selection here."}
                </span>
                {sheetClassName ? (
                  <span>
                    {sheetClassName} currently has {selectedClassMeta.registeredCount || 0} registered student
                    {(selectedClassMeta.registeredCount || 0) === 1 ? "" : "s"}
                    {selectedClassMeta.stagedCount
                      ? ` and ${selectedClassMeta.stagedCount} more saved in Ready to Upload`
                      : ""}
                    . Add only the extra rows you want to fill now.
                  </span>
                ) : null}
              </div>
              <div className="upload-students-batch-controls">
                <label className="upload-students-batch-field">
                  <span>Class</span>
                  <select value={sheetClassName} onChange={(event) => setSheetClassName(event.target.value)}>
                    <option value="">{classOptions.length ? "Select class" : "No classes available"}</option>
                    {classOptions.map((option) => (
                      <option key={option.className} value={option.className}>
                        {option.className}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="upload-students-batch-field small">
                  <span>Add Rows</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={sheetStudentCount}
                    onChange={(event) => setSheetStudentCount(event.target.value)}
                  />
                </label>
                <button type="button" className="upload-students-secondary-btn" onClick={generateSheetRows}>
                  Add Rows
                </button>
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
            <div className="upload-students-inline-note">
              Shared PIN applies only to new spreadsheet rows. Already created students keep their existing PIN, though different students can still have the same PIN.
            </div>
            <div className="upload-students-sheet-progress">
              <div className="upload-students-sheet-progress-copy">
                <strong>Spreadsheet progress</strong>
                <span>
                  {newSheetRowCount
                    ? `${newSheetRowCount} new row${newSheetRowCount === 1 ? "" : "s"} currently being edited in the sheet`
                    : "No unsaved new rows in the sheet yet"}
                </span>
              </div>
              <div className="upload-students-sheet-progress-copy">
                <strong>Saved in sheet</strong>
                <span>
                  {savedSheetRowCount
                    ? `${savedSheetRowCount} row${savedSheetRowCount === 1 ? "" : "s"} already saved and still visible here`
                    : "No rows saved from this sheet yet"}
                </span>
              </div>
              <div className="upload-students-sheet-progress-copy">
                <strong>Saved for upload</strong>
                <span>
                  {students.length
                    ? `${students.length} student${students.length === 1 ? "" : "s"} already saved in the Ready to Upload list`
                    : "Nothing saved for upload yet"}
                </span>
              </div>
            </div>
            <div className="upload-students-sheet-wrap full-size">
              {mergedSheetRows.length ? (
                <div className="upload-students-sheet">
                  <div className="upload-students-sheet-head">Full Name</div>
                  <div className="upload-students-sheet-head">Class</div>
                  <div className="upload-students-sheet-head">Section</div>
                  <div className="upload-students-sheet-head">Roll No</div>
                  <div className="upload-students-sheet-head">PIN</div>
                  <div className="upload-students-sheet-head">Phone</div>
                  <div className="upload-students-sheet-head">Email</div>
                  <div className="upload-students-sheet-head">Status</div>
                  {mergedSheetRows.map((row, index) => (
                    <React.Fragment key={`${row.entrySource}-${row.id || row.rowId || index}`}>
                      <input
                        value={row.fullName || ""}
                        onChange={(e) => row.entrySource === "new" && updateSheetRow(row.rowId, "fullName", e.target.value)}
                        placeholder="Student name"
                        readOnly={row.entrySource === "existing"}
                      />
                      <input value={row.className || sheetClassName} readOnly placeholder="Class" />
                      <input value={row.section || ""} readOnly placeholder="Auto" />
                      <input
                        value={row.displayRollNumber || row.rollNumber || ""}
                        placeholder="Auto"
                        readOnly
                      />
                      <input
                        value={row.entrySource === "existing" ? "Already created" : useSamePin ? sharedPin : row.pin}
                        onChange={(e) => row.entrySource === "new" && updateSheetRow(row.rowId, "pin", e.target.value)}
                        placeholder="1234"
                        readOnly={useSamePin || row.entrySource === "existing"}
                      />
                      <input
                        value={row.phone || ""}
                        onChange={(e) => row.entrySource === "new" && updateSheetRow(row.rowId, "phone", e.target.value)}
                        placeholder="9876543210"
                        readOnly={row.entrySource === "existing"}
                      />
                      <input
                        value={row.email || ""}
                        onChange={(e) => row.entrySource === "new" && updateSheetRow(row.rowId, "email", e.target.value)}
                        placeholder="student@email.com"
                        readOnly={row.entrySource === "existing"}
                      />
                      {row.entrySource === "existing" ? (
                        <div className="upload-students-sheet-badge existing">Existing</div>
                      ) : row.entrySource === "saved" ? (
                        <div className="upload-students-sheet-badge saved">Saved</div>
                      ) : (
                        <button type="button" className="upload-students-sheet-remove" onClick={() => removeSheetRow(row.rowId)}>
                          Remove
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="upload-students-sheet-empty">
                  Choose a class, then click <strong>Add Rows</strong> to add new entry rows into the same student grid.
                  Existing form-registered students for that class will also appear here automatically.
                </div>
              )}
            </div>

            <div className="upload-students-actions between upload-students-sheet-footer">
              <div className="upload-students-sheet-footer-copy">
                <strong>Step 1</strong>
                <span>Finish entering the new students in the sheet.</span>
              </div>
              <div className="upload-students-sheet-footer-actions">
                <button type="button" className="upload-students-secondary-btn" onClick={addSheetRow}>
                  Add Row
                </button>
                <button
                  type="button"
                  className="upload-students-primary-btn"
                  onClick={addSpreadsheetStudents}
                  disabled={!newSheetRowCount}
                >
                  Save Entered Students
                </button>
              </div>
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
          <div className="upload-students-preview-actions">
            <button
              type="button"
              className="upload-students-secondary-btn"
              onClick={clearStagedStudents}
              disabled={students.length === 0}
            >
              Clear List
            </button>
            <button
              type="button"
              className="upload-students-primary-btn"
              onClick={requestUploadConfirmation}
              disabled={students.length === 0}
            >
              Step 2: Upload to Database
            </button>
          </div>
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
                <button
                  type="button"
                  className="upload-students-preview-remove"
                  onClick={() => removeStagedStudent(i)}
                >
                  Remove from upload
                </button>
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
