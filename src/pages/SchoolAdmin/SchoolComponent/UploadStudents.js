import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { db } from "../../../firebase/firebaseConfig";
import { collection, doc, getDoc, getDocs, limit, query, where, writeBatch } from "firebase/firestore";
import { Eye, EyeOff, Info, Pencil, Plus, Trash2, Upload, Users } from "lucide-react";
import { buildYearScopedStudentId, normalizeAcademicYear } from "./schoolYearUtils";
import { loadStudentsForClass, resolveSchoolClasses, splitClassAndDivision } from "./academicUtils";
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

const DEFAULT_SHEET_COLUMNS = [
  { key: "fullName", label: "Full Name", locked: true, required: true },
  { key: "className", label: "Class", locked: true, required: true },
  { key: "section", label: "Section", locked: true, required: false },
  { key: "rollNumber", label: "Roll No", locked: true, required: true },
  { key: "pin", label: "PIN", locked: true, required: true },
  { key: "phone", label: "Phone", locked: true, required: false },
  { key: "email", label: "Email", locked: true, required: false },
];

const buildCustomColumnKey = (label, fallbackIndex = 0) => {
  const base = normalize(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `custom_field_${fallbackIndex}`;
};

const buildClassLookupKey = (value) => {
  const normalizedValue = normalize(value).toUpperCase();
  if (!normalizedValue) return "";
  const { combined } = splitClassAndDivision(normalizedValue);
  return combined || normalizedValue.replace(/\s+/g, "");
};

const InfoTooltip = ({ label, text }) => {
  const [open, setOpen] = useState(false);

  return (
    <span className="upload-students-tooltip">
      <button
        type="button"
        className="upload-students-tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((current) => !current)}
      >
        <Info size={13} />
      </button>
      <span className={`upload-students-tooltip-panel ${open ? "visible" : ""}`} role="tooltip">
        {text}
      </span>
    </span>
  );
};

const UploadStudents = ({ school, schoolId, forcePaidAccess = false, academicYear = "" }) => {
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
    customFields: {},
  };
  const [students, setStudents] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [activeTab, setActiveTab] = useState("csv");
  const [sheetRows, setSheetRows] = useState([]);
  const [classOptions, setClassOptions] = useState([]);
  const [registeredStudentsMeta, setRegisteredStudentsMeta] = useState({});
  const [selectedClassRegisteredStudents, setSelectedClassRegisteredStudents] = useState([]);
  const [sheetClassName, setSheetClassName] = useState("");
  const [sheetStudentCount, setSheetStudentCount] = useState("5");
  const [useSamePin, setUseSamePin] = useState(false);
  const [sharedPin, setSharedPin] = useState("");
  const [isPaidSchool, setIsPaidSchool] = useState(false);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [resolvedSchool, setResolvedSchool] = useState(school || null);
  const [confirmUploadOpen, setConfirmUploadOpen] = useState(false);
  const [savedSheetRowIds, setSavedSheetRowIds] = useState([]);
  const [customSheetColumns, setCustomSheetColumns] = useState([]);
  const [newColumnLabel, setNewColumnLabel] = useState("");
  const [editingColumnId, setEditingColumnId] = useState("");
  const [editingColumnLabel, setEditingColumnLabel] = useState("");
  const [visiblePins, setVisiblePins] = useState({});

  const buildStudentKey = (student) =>
    `${normalize(student.className).toUpperCase()}__${normalize(student.rollNumber)}`;
  const getStudentClassKey = (student) => buildClassLookupKey(student.className);

  const buildSortedNewRows = (rows, className, fallbackSection, startRoll = 1) => {
    const sortedRows = [...rows].sort(sortStudentsAlphabetically);

    return sortedRows.map((row, index) => ({
      ...row,
      rowId: row.rowId || createRowId(),
      className: row.className || className,
      section: row.section || fallbackSection,
      rollNumber: String(startRoll + index),
      customFields: row.customFields || {},
    }));
  };

  const normalizedSchoolId = useMemo(() => normalize(schoolId).toLowerCase(), [schoolId]);
  const normalizedAcademicYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);
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
    const mergeYearFeeSettings = async (baseSchool) => {
      if (!baseSchool || !normalizedAcademicYear || !normalizeSchoolId(baseSchool.schoolId || baseSchool.id)) {
        return baseSchool;
      }

      try {
        const yearSnap = await getDoc(
          doc(
            db,
            "schools",
            normalizeSchoolId(baseSchool.schoolId || baseSchool.id),
            "academicYears",
            normalizedAcademicYear
          )
        );
        if (!yearSnap.exists()) return baseSchool;
        return {
          ...baseSchool,
          ...yearSnap.data(),
        };
      } catch (error) {
        console.error("Failed to load academic year fee settings for upload:", error);
        return baseSchool;
      }
    };

    const loadSchoolAccess = async () => {
      setLoadingSchool(true);
      try {
        const directCandidates = [school?.id, rawSchoolId, normalizedSchoolId].filter(Boolean);
        for (const candidate of directCandidates) {
          const schoolSnap = await getDoc(doc(db, "schools", candidate));
          if (schoolSnap.exists()) {
            const nextSchool = await mergeYearFeeSettings({ id: schoolSnap.id, ...schoolSnap.data() });
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
            const nextSchool = await mergeYearFeeSettings({ id: match.id, ...match.data() });
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
          const nextSchool = await mergeYearFeeSettings({ id: matchedSchool.id, ...matchedSchool.data() });
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
  }, [normalizedAcademicYear, normalizedSchoolId, propSchoolIsPaid, rawSchoolId, school]);

  useEffect(() => {
    const loadClassOptions = async () => {
      if (!normalizedSchoolId && !rawSchoolId) {
        setClassOptions([]);
        return;
      }

      try {
        const resolvedClasses = await resolveSchoolClasses(rawSchoolId || normalizedSchoolId, normalizedAcademicYear);
        setClassOptions(
          resolvedClasses.map((entry) => ({
            className: normalize(entry.className),
            section: normalize(entry.section) || inferSectionFromClassName(entry.className),
          }))
        );
      } catch (error) {
        console.error("Failed to load school classes for upload workspace:", error);
        setClassOptions([]);
      }
    };

    loadClassOptions();
  }, [normalizedAcademicYear, normalizedSchoolId, rawSchoolId]);

  useEffect(() => {
    const loadRegisteredStudentsMeta = async () => {
      if (!normalizedSchoolId) {
        setRegisteredStudentsMeta({});
        setSelectedClassRegisteredStudents([]);
        return;
      }

      try {
        const candidateSchoolIds = Array.from(
          new Set([normalizedSchoolId, rawSchoolId, normalize(resolvedSchool?.schoolId), normalize(resolvedSchool?.id)].filter(Boolean))
        );
        const snapshots = await Promise.all(
          candidateSchoolIds.map((candidate) =>
            getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizeSchoolId(candidate))))
          )
        );
        const meta = {};
        const seenStudentIds = new Set();

        snapshots.forEach((snapshot) => {
          snapshot.docs.forEach((entry) => {
            if (seenStudentIds.has(entry.id)) return;
            seenStudentIds.add(entry.id);

            const data = entry.data() || {};
            const entryYear = normalizeAcademicYear(data.academicYear);
            if (normalizedAcademicYear && entryYear && entryYear !== normalizedAcademicYear) return;

            const rawClassName = normalize(data.className || data.class);
            const classKey = buildClassLookupKey(rawClassName);
            if (!classKey) return;

            const displayClassName = rawClassName || classKey;
            const rollNumber = Number(normalize(data.rollNumber));
            const current = meta[classKey] || { count: 0, maxRoll: 0 };
            meta[classKey] = {
              count: current.count + 1,
              maxRoll: Number.isFinite(rollNumber) ? Math.max(current.maxRoll, rollNumber) : current.maxRoll,
              className: displayClassName,
            };
          });
        });

        setRegisteredStudentsMeta(meta);
      } catch (error) {
        console.error("Failed to load registered students for spreadsheet generator:", error);
        setRegisteredStudentsMeta({});
      }
    };

    loadRegisteredStudentsMeta();
  }, [normalizedAcademicYear, normalizedSchoolId, rawSchoolId, resolvedSchool]);

  useEffect(() => {
    const loadSelectedClassStudents = async () => {
      if (!sheetClassName || !(rawSchoolId || normalizedSchoolId)) {
        setSelectedClassRegisteredStudents([]);
        return;
      }

      try {
        const classEntry = classOptions.find((option) => option.className === sheetClassName);
        const nextStudents = await loadStudentsForClass({
          schoolId: rawSchoolId || normalizedSchoolId,
          className: sheetClassName,
          section: classEntry?.section || "",
          academicYear: normalizedAcademicYear,
        });

        setSelectedClassRegisteredStudents(
          nextStudents.map((student) => ({
            id: student.studentId,
            className: normalize(student.className),
            section: normalize(student.section) || inferSectionFromClassName(student.className),
            fullName: normalize(student.fullName || student.name),
            rollNumber: normalize(student.rollNumber),
            pin: normalize(student.pin),
            phone: normalize(student.phone || student.parentPhone),
            email: normalize(student.email).toLowerCase(),
            customFields: student.customFields || {},
            customFieldLabels: student.customFieldLabels || {},
          }))
        );
      } catch (error) {
        console.error("Failed to load selected class students for spreadsheet generator:", error);
        setSelectedClassRegisteredStudents([]);
      }
    };

    loadSelectedClassStudents();
  }, [classOptions, normalizedAcademicYear, normalizedSchoolId, rawSchoolId, sheetClassName]);

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
    const classKey = buildClassLookupKey(className);
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

  const updateSheetCustomField = (rowId, columnKey, value) => {
    setSheetRows((prev) =>
      prev.map((row) =>
        row.rowId === rowId
          ? {
              ...row,
              customFields: {
                ...(row.customFields || {}),
                [columnKey]: value,
              },
            }
          : row
      )
    );
    setSavedSheetRowIds((prev) => prev.filter((savedRowId) => savedRowId !== rowId));
  };

  const addCustomSheetColumn = () => {
    const label = normalize(newColumnLabel);
    if (!label) {
      setUploadStatus("Enter a column label before adding a custom sheet column.");
      return;
    }

    const existingKeys = new Set(customSheetColumns.map((column) => column.key));
    const baseKey = buildCustomColumnKey(label, customSheetColumns.length + 1);
    let resolvedKey = baseKey;
    let suffix = 2;
    while (existingKeys.has(resolvedKey)) {
      resolvedKey = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    const nextColumn = {
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      key: resolvedKey,
      label,
    };

    setCustomSheetColumns((prev) => [...prev, nextColumn]);
    setSheetRows((prev) =>
      prev.map((row) => ({
        ...row,
        customFields: {
          ...(row.customFields || {}),
          [resolvedKey]: row.customFields?.[resolvedKey] || "",
        },
      }))
    );
    setNewColumnLabel("");
    setUploadStatus(`Added custom column "${label}" to the spreadsheet.`);
  };

  const beginRenameCustomColumn = (column) => {
    setEditingColumnId(column.id);
    setEditingColumnLabel(column.label);
  };

  const saveCustomColumnRename = (columnId) => {
    const nextLabel = normalize(editingColumnLabel);
    if (!nextLabel) {
      setUploadStatus("Column label cannot be empty.");
      return;
    }
    setCustomSheetColumns((prev) =>
      prev.map((column) => (column.id === columnId ? { ...column, label: nextLabel } : column))
    );
    setEditingColumnId("");
    setEditingColumnLabel("");
  };

  const removeCustomSheetColumn = (columnId) => {
    const target = customSheetColumns.find((column) => column.id === columnId);
    if (!target) return;
    setCustomSheetColumns((prev) => prev.filter((column) => column.id !== columnId));
    setSheetRows((prev) =>
      prev.map((row) => {
        const nextFields = { ...(row.customFields || {}) };
        delete nextFields[target.key];
        return {
          ...row,
          customFields: nextFields,
        };
      })
    );
    setUploadStatus(`Removed custom column "${target.label}".`);
  };

  const togglePinVisibility = (pinKey) => {
    setVisiblePins((prev) => ({
      ...prev,
      [pinKey]: !prev[pinKey],
    }));
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
    const classKey = buildClassLookupKey(sheetClassName);
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

  const sheetGridTemplate = useMemo(() => {
    const baseColumns = [
      "1.45fr",
      "0.8fr",
      "0.72fr",
      "0.78fr",
      "1.05fr",
      "1fr",
      "1.2fr",
    ];
    const customColumns = customSheetColumns.map(() => "1fr");
    return [...baseColumns, ...customColumns, "0.9fr"].join(" ");
  }, [customSheetColumns]);

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
  }, [classOptions, savedSheetRowIds, selectedClassRegisteredStudents, sheetClassName, sheetRows]);

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
        customFields: customSheetColumns.reduce((accumulator, column) => {
          accumulator[column.key] = normalize(row.customFields?.[column.key]);
          return accumulator;
        }, {}),
        customFieldLabels: customSheetColumns.reduce((accumulator, column) => {
          accumulator[column.key] = column.label;
          return accumulator;
        }, {}),
        academicYear: normalizedAcademicYear,
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
        const studentId = buildYearScopedStudentId({
          schoolId: normalizedSchoolId,
          academicYear: normalizedAcademicYear,
          className: normalizedClassName,
          rollNumber: normalizedRoll,
        });

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
        const id = buildYearScopedStudentId({
          schoolId: normalizedSchoolId,
          academicYear: normalizedAcademicYear,
          className: student.className,
          rollNumber: student.rollNumber,
        });
        const ref = doc(collection(db, "studentAccounts"), id);

        batch.set(ref, {
          ...student,
          schoolId: normalizedSchoolId,
          academicYear: normalizedAcademicYear,
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
        </div>

        {activeTab === "csv" ? (
          <section className="upload-students-tab-panel">
            <div className="upload-students-partition-head">
              <h4>CSV Upload</h4>
            </div>
            <label className="upload-students-file-picker">
              <span>Select CSV File</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} />
            </label>
          </section>
        ) : (
          <section className="upload-students-tab-panel upload-students-sheet-panel">
            <div className="upload-students-partition-head">
              <div className="upload-students-heading-inline">
                <h4>Spreadsheet Input</h4>
                <InfoTooltip
                  label="Spreadsheet input info"
                  text="The sheet shows existing students for the selected class and lets you stage only the new students you want to add."
                />
              </div>
            </div>
            <div className="upload-students-sheet-toolbar">
              <div className="upload-students-sheet-toolbar-controls">
                <div className="upload-students-batch-controls">
                  <label className="upload-students-batch-field">
                    <div className="upload-students-field-inline">
                      <span>Class</span>
                      <InfoTooltip
                        label="Class selector info"
                        text="The class list comes from the school setup for the active academic year."
                      />
                    </div>
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
                    <div className="upload-students-field-inline">
                      <span>Add Rows</span>
                      <InfoTooltip
                        label="Add rows info"
                        text="Add only the extra rows you need for new students. Existing students already appear in the sheet."
                      />
                    </div>
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
                  <InfoTooltip
                    label="Shared PIN info"
                    text="Shared PIN applies only to new spreadsheet rows. Existing students keep their saved PIN."
                  />
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
            </div>
            {sheetClassName ? (
              <div className="upload-students-sheet-meta">
                <span>{sheetClassName}</span>
                <span>{selectedClassMeta.registeredCount || 0} registered</span>
                {selectedClassMeta.stagedCount ? <span>{selectedClassMeta.stagedCount} staged</span> : null}
                <InfoTooltip
                  label="Class roster summary info"
                  text="Registered counts come from the live class roster. Staged counts are new records saved into Ready to Upload."
                />
              </div>
            ) : null}
            <div className="upload-students-custom-columns">
              <div className="upload-students-custom-columns-head">
                <div>
                  <div className="upload-students-heading-inline">
                    <strong>Custom columns</strong>
                    <InfoTooltip
                      label="Custom columns info"
                      text="Default columns stay locked. You can add, rename, and delete custom columns such as address, admission number, or guardian name."
                    />
                  </div>
                </div>
                <div className="upload-students-custom-columns-form">
                  <input
                    type="text"
                    value={newColumnLabel}
                    onChange={(event) => setNewColumnLabel(event.target.value)}
                    placeholder="New column label"
                  />
                  <button type="button" className="upload-students-secondary-btn" onClick={addCustomSheetColumn}>
                    <Plus size={15} />
                    Add Column
                  </button>
                </div>
              </div>
              {customSheetColumns.length ? (
                <div className="upload-students-custom-column-list">
                  {customSheetColumns.map((column) => (
                    <div key={column.id} className="upload-students-custom-column-chip">
                      {editingColumnId === column.id ? (
                        <>
                          <input
                            type="text"
                            value={editingColumnLabel}
                            onChange={(event) => setEditingColumnLabel(event.target.value)}
                            placeholder="Column label"
                          />
                          <button type="button" className="upload-students-chip-btn" onClick={() => saveCustomColumnRename(column.id)}>
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <span>{column.label}</span>
                          <button type="button" className="upload-students-chip-btn" onClick={() => beginRenameCustomColumn(column)}>
                            <Pencil size={13} />
                          </button>
                        </>
                      )}
                      <button type="button" className="upload-students-chip-btn danger" onClick={() => removeCustomSheetColumn(column.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="upload-students-custom-columns-empty">
                  No custom columns
                </div>
              )}
            </div>
            <div className="upload-students-sheet-progress">
              <div className="upload-students-sheet-progress-copy">
                <div className="upload-students-heading-inline">
                  <strong>Spreadsheet progress</strong>
                  <InfoTooltip
                    label="Spreadsheet progress info"
                    text="New rows are still being edited. Saved rows are already staged from this sheet. Ready to Upload is the final list that will go to the database."
                  />
                </div>
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
                <div className="upload-students-sheet" style={{ gridTemplateColumns: sheetGridTemplate }}>
                  {DEFAULT_SHEET_COLUMNS.map((column) => (
                    <div key={column.key} className="upload-students-sheet-head">
                      {column.label}
                    </div>
                  ))}
                  {customSheetColumns.map((column) => (
                    <div key={column.id} className="upload-students-sheet-head upload-students-sheet-head-custom">
                      {column.label}
                    </div>
                  ))}
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
                      <div className="upload-students-pin-cell">
                        <input
                          type={visiblePins[`${row.entrySource}-${row.id || row.rowId || index}-pin`] ? "text" : "password"}
                          className="upload-students-pin-input"
                          value={useSamePin && row.entrySource !== "existing" ? sharedPin : row.pin || ""}
                          onChange={(e) => row.entrySource === "new" && updateSheetRow(row.rowId, "pin", e.target.value)}
                          placeholder="1234"
                          readOnly={useSamePin || row.entrySource === "existing"}
                        />
                        <button
                          type="button"
                          className="upload-students-pin-toggle-btn"
                          onClick={() => togglePinVisibility(`${row.entrySource}-${row.id || row.rowId || index}-pin`)}
                          title={visiblePins[`${row.entrySource}-${row.id || row.rowId || index}-pin`] ? "Hide PIN" : "Show PIN"}
                        >
                          {visiblePins[`${row.entrySource}-${row.id || row.rowId || index}-pin`] ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
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
                      {customSheetColumns.map((column) => (
                        <input
                          key={`${column.id}-${row.id || row.rowId || index}`}
                          value={row.customFields?.[column.key] || ""}
                          onChange={(e) => row.entrySource === "new" && updateSheetCustomField(row.rowId, column.key, e.target.value)}
                          placeholder={column.label}
                          readOnly={row.entrySource === "existing"}
                        />
                      ))}
                      {row.entrySource === "existing" ? (
                        <div className="upload-students-sheet-badge existing">Existing</div>
                      ) : row.entrySource === "saved" ? (
                        <div className="upload-students-sheet-badge saved">Saved</div>
                      ) : (
                        <button type="button" className="upload-students-sheet-remove" onClick={() => removeSheetRow(row.rowId)} title="Remove row">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              ) : (
              <div className="upload-students-sheet-empty">
                <div className="upload-students-empty-inline">
                  <Users size={16} />
                  <span>No rows</span>
                </div>
              </div>
              )}
            </div>
          </section>
        )}
      </section>
      </div>

      <section className="upload-students-card upload-students-preview-card">
        <div className="upload-students-card-head">
          <div>
            <div className="upload-students-heading-inline">
              <h3>Ready to Upload</h3>
              <InfoTooltip
                label="Ready to upload info"
                text="Only students saved into this staging list will be uploaded to the live database."
              />
            </div>
          </div>
          <div className="upload-students-preview-count">{students.length} staged</div>
        </div>

        {students.length > 0 ? (
          <div className="upload-students-preview-list">
            {students.slice(0, 12).map((s, i) => (
              <article key={`${s.rollNumber}-${i}`} className="upload-students-preview-item">
                <strong>{s.fullName}</strong>
                <span>Class {s.className} {s.section ? `· ${s.section}` : ""}</span>
                <span>Roll {s.rollNumber}</span>
                {s.customFieldLabels
                  ? Object.entries(s.customFieldLabels).map(([fieldKey, label]) =>
                      s.customFields?.[fieldKey] ? <span key={fieldKey}>{label}: {s.customFields[fieldKey]}</span> : null
                    )
                  : null}
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
            <div className="upload-students-empty-inline">
              <Upload size={16} />
              <span>No staged students</span>
            </div>
          </div>
        )}

        {uploadStatus ? <p className="upload-students-status">{uploadStatus}</p> : null}

        <div className="upload-students-actions between upload-students-sheet-footer upload-students-action-rail">
          <div className="upload-students-sheet-footer-actions">
            <button type="button" className="upload-students-secondary-btn" onClick={addSheetRow}>
              Add Row
            </button>
            <button
              type="button"
              className="upload-students-secondary-btn"
              onClick={addSpreadsheetStudents}
              disabled={!newSheetRowCount}
            >
              Save Entered Students
            </button>
            <button
              type="button"
              className="upload-students-danger-btn"
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
