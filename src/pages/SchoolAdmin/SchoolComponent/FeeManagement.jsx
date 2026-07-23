import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleEllipsis,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { normalizeAcademicYear } from "./schoolYearUtils";
import FeeCustomizer from "./FeeCustomizer";
import {
  buildFeeTemplateId,
  DEFAULT_ADDON_OPTIONS,
  DEFAULT_WAIVER_OPTIONS,
  fetchStudentFeeSummary,
  normalizeAddonRecord,
  normalizeFeeTemplate,
  processFeeTransaction,
} from "./feeManagementUtils";
import { loadStudentsForClass, normalizeClassName, resolveSchoolClasses } from "./academicUtils";
import SchoolAdminQuickLinkHint from "./SchoolAdminQuickLinkHint";
import "./FeeManagement.css";

const normalize = (value) => String(value || "").trim();
const normalizeSchoolId = (value) => normalize(value).toLowerCase();
const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const inferStatus = (student = {}, fallbackAmount = 0) => {
  const feeAmount = toAmount(student.feeAmount || fallbackAmount);
  const feePaidAmount = toAmount(student.feePaidAmount);
  const direct = normalize(student.feeStatus).toLowerCase();
  const pendingFromDoc =
    student.currentOutstandingBalance === 0 || student.currentOutstandingBalance
      ? toAmount(student.currentOutstandingBalance)
      : student.feePendingAmount === 0 || student.feePendingAmount
        ? toAmount(student.feePendingAmount)
        : Math.max(feeAmount - feePaidAmount, 0);

  if (direct === "paid") return "paid";
  if (direct === "partial") return "partial";
  if (["pending", "not_paid", "unpaid"].includes(direct)) return "pending";
  if (feeAmount > 0 && pendingFromDoc === 0) return "paid";
  if (feePaidAmount > 0 && pendingFromDoc > 0) return "partial";
  return "pending";
};

const buildSchoolTemplateDraft = (schoolData = {}, yearData = {}) =>
  normalizeFeeTemplate({
    cycle: yearData.feeCollectionCycle || schoolData.feeCollectionCycle || "monthly",
    baseTuition: yearData.baseTuition || schoolData.baseTuition || yearData.feeAmount || schoolData.feeAmount || 0,
    transportStandard: yearData.transportStandard || schoolData.transportStandard || 0,
    examFee: yearData.examFee || schoolData.examFee || 0,
    availableAddons: yearData.availableAddons || schoolData.availableAddons || DEFAULT_ADDON_OPTIONS,
    availableWaivers: yearData.availableWaivers || schoolData.availableWaivers || DEFAULT_WAIVER_OPTIONS,
  });

const createEmptyWaiverDraft = () => ({ key: "", label: "", amount: "" });
const createEmptyAddonDraft = () => ({ id: "", label: "", amount: "", category: "custom" });

export default function FeeManagement({ schoolId, schoolName = "", academicYear = "" }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [openStudentId, setOpenStudentId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [paymentBusyId, setPaymentBusyId] = useState("");
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [schoolTemplateDraft, setSchoolTemplateDraft] = useState(buildSchoolTemplateDraft());
  const [classTemplateMap, setClassTemplateMap] = useState({});
  const [activeTemplateDraft, setActiveTemplateDraft] = useState(buildSchoolTemplateDraft());
  const [waiverDraft, setWaiverDraft] = useState(createEmptyWaiverDraft());
  const [addonDraft, setAddonDraft] = useState(createEmptyAddonDraft());
  const [editingWaiverKey, setEditingWaiverKey] = useState("");
  const [editingAddonId, setEditingAddonId] = useState("");
  const [configExpanded, setConfigExpanded] = useState(false);

  const normalizedSchool = useMemo(() => normalizeSchoolId(schoolId), [schoolId]);
  const normalizedYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);
  const activeTemplateKey = selectedClass || "school";

  useEffect(() => {
    const loadFeeData = async () => {
      if (!normalizedSchool) return;
      setLoading(true);
      setPermissionError("");
      setStatusMessage("");

      try {
        const candidateSchoolIds = Array.from(
          new Set([normalizedSchool, normalize(schoolId)].filter(Boolean).map((value) => normalizeSchoolId(value)))
        );
        const [schoolSnap, classEntries, templateSnap, ...studentSnapshots] = await Promise.all([
          getDoc(doc(db, "schools", normalizedSchool)),
          resolveSchoolClasses(schoolId || normalizedSchool, normalizedYear),
          getDocs(query(collection(db, "feeTemplates"), where("schoolId", "==", normalizedSchool))),
          ...candidateSchoolIds.map((candidate) =>
            getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", candidate)))
          ),
        ]);
        const yearSnap = normalizedYear
          ? await getDoc(doc(db, "schools", normalizedSchool, "academicYears", normalizedYear))
          : null;

        const schoolData = schoolSnap.exists() ? schoolSnap.data() || {} : {};
        const yearData = yearSnap?.exists() ? yearSnap.data() || {} : {};
        const baseTemplate = buildSchoolTemplateDraft(schoolData, yearData);
        setSchoolTemplateDraft(baseTemplate);

        const templatesByClass = {};
        templateSnap.docs.forEach((entry) => {
          const data = entry.data() || {};
          if (normalizedYear && normalizeAcademicYear(data.academicYear) !== normalizedYear) return;
          const className = normalize(data.className);
          if (!className) return;
          templatesByClass[className] = normalizeFeeTemplate(data, baseTemplate);
        });
        setClassTemplateMap(templatesByClass);

        const studentDocMap = new Map();
        studentSnapshots.forEach((snapshot) => {
          snapshot.docs.forEach((entry) => {
            if (!studentDocMap.has(entry.id)) {
              studentDocMap.set(entry.id, { id: entry.id, ...entry.data() });
            }
          });
        });

        const resolvedClasses = classEntries.filter((entry, index, list) =>
          index === list.findIndex((item) => normalizeClassName(item.className) === normalizeClassName(entry.className))
        );

        const rosterGroups = await Promise.all(
          resolvedClasses.map((classEntry) =>
            loadStudentsForClass({
              schoolId: schoolId || normalizedSchool,
              className: classEntry.className,
              section: classEntry.section || "",
              academicYear: normalizedYear,
            })
          )
        );

        const visibleRoster = rosterGroups.flat();
        const seenStudentIds = new Set();
        const rows = visibleRoster
          .map((rosterStudent) => {
            const entryData = studentDocMap.get(rosterStudent.studentId) || {};
            const className = normalize(entryData.className || rosterStudent.className);
            const classTemplate = templatesByClass[className] || baseTemplate;
            const classDefaultTotal =
              toAmount(classTemplate.baseTuition) +
              toAmount(classTemplate.transportStandard) +
              toAmount(classTemplate.examFee);
            const feeAmount = toAmount(entryData.feeAmount || classDefaultTotal);
            const feePaidAmount = toAmount(entryData.feePaidAmount);
            const currentOutstandingBalance =
              entryData.currentOutstandingBalance === 0 || entryData.currentOutstandingBalance
                ? toAmount(entryData.currentOutstandingBalance)
                : entryData.feePendingAmount === 0 || entryData.feePendingAmount
                  ? toAmount(entryData.feePendingAmount)
                  : Math.max(feeAmount - feePaidAmount, 0);

            return {
              id: rosterStudent.studentId,
              ...entryData,
              fullName: normalize(entryData.fullName || entryData.name || rosterStudent.fullName || "Student"),
              className,
              section: normalize(entryData.section || rosterStudent.section),
              rollNumber: normalize(entryData.rollNumber || rosterStudent.rollNumber),
              phone: normalize(entryData.phone || entryData.parentPhone || rosterStudent.phone),
              feeCollectionCycle: normalize(entryData.feeCollectionCycle || classTemplate.cycle || "monthly").toLowerCase() || "monthly",
              feeAmount,
              feePaidAmount,
              feePendingAmount: currentOutstandingBalance,
              currentOutstandingBalance,
              feeStatus: inferStatus(
                {
                  ...entryData,
                  feeAmount,
                  feePaidAmount,
                  currentOutstandingBalance,
                },
                classDefaultTotal
              ),
              feeCalculationMode: normalize(entryData.feeCalculationMode || "class_default"),
            };
          })
          .filter((entry) => {
            if (!entry.id || seenStudentIds.has(entry.id)) return false;
            seenStudentIds.add(entry.id);
            return true;
          })
          .sort((left, right) => {
            const classCompare = normalize(left.className).localeCompare(normalize(right.className), undefined, {
              numeric: true,
            });
            if (classCompare !== 0) return classCompare;
            const rollCompare = normalize(left.rollNumber).localeCompare(normalize(right.rollNumber), undefined, {
              numeric: true,
            });
            if (rollCompare !== 0) return rollCompare;
            return normalize(left.fullName).localeCompare(normalize(right.fullName));
          });

        setStudents(rows);
        setPaymentDrafts(
          rows.reduce((accumulator, student) => {
            accumulator[student.id] = {
              amount: String(student.currentOutstandingBalance || ""),
              method: "manual",
              actionType: "payment",
              note: "",
            };
            return accumulator;
          }, {})
        );
      } catch (error) {
        console.error("Unable to load fee records", error);
        setPermissionError(
          error?.code === "permission-denied"
            ? "Missing or insufficient permission to load fee records."
            : "Unable to load fee records right now."
        );
      } finally {
        setLoading(false);
      }
    };

    loadFeeData();
  }, [normalizedSchool, normalizedYear, schoolId]);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.className).filter(Boolean))),
    [students]
  );

  useEffect(() => {
    const nextTemplate =
      activeTemplateKey === "school"
        ? schoolTemplateDraft
        : classTemplateMap[activeTemplateKey] || schoolTemplateDraft;
    setActiveTemplateDraft(nextTemplate);
    setWaiverDraft(createEmptyWaiverDraft());
    setAddonDraft(createEmptyAddonDraft());
    setEditingWaiverKey("");
    setEditingAddonId("");
  }, [activeTemplateKey, classTemplateMap, schoolTemplateDraft]);

  const filteredStudents = useMemo(() => {
    const searchLower = normalize(searchTerm).toLowerCase();
    return students.filter((student) => {
      const matchesClass = selectedClass ? student.className === selectedClass : true;
      const haystack = [student.fullName, student.rollNumber, student.phone, student.className, student.section]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const matchesSearch = searchLower ? haystack.includes(searchLower) : true;
      return matchesClass && matchesSearch;
    });
  }, [searchTerm, selectedClass, students]);

  const summary = useMemo(() => {
    const total = filteredStudents.length;
    const paid = filteredStudents.filter((student) => student.feeStatus === "paid").length;
    const partial = filteredStudents.filter((student) => student.feeStatus === "partial").length;
    const pending = filteredStudents.filter((student) => student.feeStatus === "pending").length;
    const totalDue = filteredStudents.reduce((sum, student) => sum + toAmount(student.feeAmount), 0);
    const totalOutstanding = filteredStudents.reduce((sum, student) => sum + toAmount(student.currentOutstandingBalance), 0);
    return { total, paid, partial, pending, totalDue, totalOutstanding };
  }, [filteredStudents]);

  const activeTemplateTotal = useMemo(
    () =>
      toAmount(activeTemplateDraft?.baseTuition) +
      toAmount(activeTemplateDraft?.transportStandard) +
      toAmount(activeTemplateDraft?.examFee),
    [activeTemplateDraft]
  );

  const updateTemplateField = (field, value) => {
    setActiveTemplateDraft((prev) => ({
      ...prev,
      [field]: field === "cycle" ? value : toAmount(value),
    }));
  };

  const upsertWaiver = () => {
    const label = normalize(waiverDraft.label);
    const key = normalize(waiverDraft.key || label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!label || !key) {
      setStatusMessage("Enter a waiver name before saving.");
      return;
    }
    const nextWaiver = { key, label, amount: toAmount(waiverDraft.amount) };
    setActiveTemplateDraft((prev) => ({
      ...prev,
      availableWaivers: [
        ...(prev.availableWaivers || []).filter((entry) => entry.key !== key),
        nextWaiver,
      ].sort((left, right) => normalize(left.label).localeCompare(normalize(right.label))),
    }));
    setWaiverDraft(createEmptyWaiverDraft());
    setEditingWaiverKey("");
  };

  const editWaiver = (waiver) => {
    setWaiverDraft({
      key: waiver.key,
      label: waiver.label,
      amount: String(toAmount(waiver.amount)),
    });
    setEditingWaiverKey(waiver.key);
  };

  const deleteWaiver = (waiverKey) => {
    setActiveTemplateDraft((prev) => ({
      ...prev,
      availableWaivers: (prev.availableWaivers || []).filter((entry) => entry.key !== waiverKey),
    }));
  };

  const upsertAddon = () => {
    const label = normalize(addonDraft.label);
    const id = normalize(addonDraft.id || label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
    if (!label || !id) {
      setStatusMessage("Enter an add-on name before saving.");
      return;
    }
    const nextAddon = normalizeAddonRecord({
      id,
      label,
      amount: toAmount(addonDraft.amount),
      category: addonDraft.category || "custom",
    });
    setActiveTemplateDraft((prev) => ({
      ...prev,
      availableAddons: [
        ...(prev.availableAddons || []).filter((entry) => entry.id !== id),
        nextAddon,
      ].sort((left, right) => normalize(left.label).localeCompare(normalize(right.label))),
    }));
    setAddonDraft(createEmptyAddonDraft());
    setEditingAddonId("");
  };

  const editAddon = (addon) => {
    setAddonDraft({
      id: addon.id,
      label: addon.label,
      amount: String(toAmount(addon.amount)),
      category: addon.category || "custom",
    });
    setEditingAddonId(addon.id);
  };

  const deleteAddon = (addonId) => {
    setActiveTemplateDraft((prev) => ({
      ...prev,
      availableAddons: (prev.availableAddons || []).filter((entry) => entry.id !== addonId),
    }));
  };

  const saveActiveTemplate = async () => {
    if (!normalizedSchool || !activeTemplateDraft) return;
    setConfigSaving(true);
    setPermissionError("");
    setStatusMessage("");

    try {
      const totalAmount = activeTemplateTotal;
      const payload = {
        schoolId: normalizedSchool,
        academicYear: normalizedYear,
        cycle: activeTemplateDraft.cycle,
        feeCollectionCycle: activeTemplateDraft.cycle,
        baseTuition: toAmount(activeTemplateDraft.baseTuition),
        transportStandard: toAmount(activeTemplateDraft.transportStandard),
        examFee: toAmount(activeTemplateDraft.examFee),
        feeAmount: totalAmount,
        availableAddons: (activeTemplateDraft.availableAddons || []).map(normalizeAddonRecord),
        availableWaivers: (activeTemplateDraft.availableWaivers || []).map((waiver) => ({
          key: normalize(waiver.key),
          label: normalize(waiver.label),
          amount: toAmount(waiver.amount),
        })),
        feeCollectionEnabled: true,
        feeUpdatedAt: serverTimestamp(),
        feeUpdatedBy: schoolName || normalizedSchool,
      };

      if (activeTemplateKey === "school") {
        await setDoc(
          normalizedYear
            ? doc(db, "schools", normalizedSchool, "academicYears", normalizedYear)
            : doc(db, "schools", normalizedSchool),
          payload,
          { merge: true }
        );

        const batch = writeBatch(db);
        students.forEach((student) => {
          if (student.feeCalculationMode === "custom_override") return;
          const currentPaidAmount = Math.min(totalAmount, toAmount(student.feePaidAmount));
          const currentOutstandingBalance = Math.max(totalAmount - currentPaidAmount, 0);
          const feeStatus = currentOutstandingBalance === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending";
          const studentPayload = {
            feeCollectionCycle: activeTemplateDraft.cycle,
            feeAmount: totalAmount,
            feePaidAmount: currentPaidAmount,
            feePendingAmount: currentOutstandingBalance,
            currentOutstandingBalance,
            feeStatus,
            feeUpdatedAt: serverTimestamp(),
            feeUpdatedBy: schoolName || normalizedSchool,
          };
          batch.set(doc(db, "studentAccounts", student.id), studentPayload, { merge: true });
          batch.set(doc(db, "defaultSchoolEnrollments", student.id), studentPayload, { merge: true });
        });
        await batch.commit();

        setSchoolTemplateDraft(activeTemplateDraft);
        setStudents((prev) =>
          prev.map((student) => {
            if (student.feeCalculationMode === "custom_override") return student;
            const currentPaidAmount = Math.min(totalAmount, toAmount(student.feePaidAmount));
            const currentOutstandingBalance = Math.max(totalAmount - currentPaidAmount, 0);
            return {
              ...student,
              feeCollectionCycle: activeTemplateDraft.cycle,
              feeAmount: totalAmount,
              feePendingAmount: currentOutstandingBalance,
              currentOutstandingBalance,
              feeStatus: currentOutstandingBalance === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending",
            };
          })
        );
        setStatusMessage("Complete school default template saved.");
      } else {
        const className = activeTemplateKey;
        await setDoc(
          doc(db, "feeTemplates", buildFeeTemplateId({ schoolId: normalizedSchool, academicYear: normalizedYear, className })),
          {
            ...payload,
            classId: buildFeeTemplateId({ schoolId: normalizedSchool, academicYear: normalizedYear, className }),
            className,
            updatedAt: serverTimestamp(),
            updatedBy: schoolName || normalizedSchool,
          },
          { merge: true }
        );

        const batch = writeBatch(db);
        students
          .filter((student) => student.className === className && student.feeCalculationMode !== "custom_override")
          .forEach((student) => {
            const currentPaidAmount = Math.min(totalAmount, toAmount(student.feePaidAmount));
            const currentOutstandingBalance = Math.max(totalAmount - currentPaidAmount, 0);
            const feeStatus = currentOutstandingBalance === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending";
            const studentPayload = {
              feeCollectionCycle: activeTemplateDraft.cycle,
              feeAmount: totalAmount,
              feePaidAmount: currentPaidAmount,
              feePendingAmount: currentOutstandingBalance,
              currentOutstandingBalance,
              feeStatus,
              feeUpdatedAt: serverTimestamp(),
              feeUpdatedBy: schoolName || normalizedSchool,
            };
            batch.set(doc(db, "studentAccounts", student.id), studentPayload, { merge: true });
            batch.set(doc(db, "defaultSchoolEnrollments", student.id), studentPayload, { merge: true });
          });
        await batch.commit();

        setClassTemplateMap((prev) => ({ ...prev, [className]: activeTemplateDraft }));
        setStudents((prev) =>
          prev.map((student) => {
            if (student.className !== className || student.feeCalculationMode === "custom_override") return student;
            const currentPaidAmount = Math.min(totalAmount, toAmount(student.feePaidAmount));
            const currentOutstandingBalance = Math.max(totalAmount - currentPaidAmount, 0);
            return {
              ...student,
              feeCollectionCycle: activeTemplateDraft.cycle,
              feeAmount: totalAmount,
              feePendingAmount: currentOutstandingBalance,
              currentOutstandingBalance,
              feeStatus: currentOutstandingBalance === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending",
            };
          })
        );
        setStatusMessage(`${className} class template saved.`);
      }
    } catch (error) {
      console.error("Unable to save fee template", error);
      setPermissionError(
        error?.code === "permission-denied"
          ? "Missing or insufficient permission to save fee template."
          : "Fee template could not be saved. Please try again."
      );
    } finally {
      setConfigSaving(false);
    }
  };

  const handleCustomizerSaved = (payload) => {
    if (!payload?.studentId) return;
    setStudents((prev) =>
      prev.map((student) =>
        student.id === payload.studentId
          ? {
              ...student,
              feeAmount: toAmount(payload.customizedStudentTotal),
              feeCollectionCycle: normalize(payload.feeCollectionCycle || student.feeCollectionCycle || "monthly").toLowerCase(),
              currentOutstandingBalance: toAmount(payload.currentOutstandingBalance),
              feePendingAmount: toAmount(payload.feePendingAmount),
              feeStatus: payload.feeStatus || student.feeStatus,
              feeCalculationMode: payload.feeCalculationMode || student.feeCalculationMode,
            }
          : student
      )
    );
    setPaymentDrafts((prev) => ({
      ...prev,
      [payload.studentId]: {
        ...(prev[payload.studentId] || { method: "manual", note: "" }),
        amount: String(toAmount(payload.currentOutstandingBalance)),
      },
    }));
  };

  const handlePaymentDraftChange = (studentId, field, value) => {
    setPaymentDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { amount: "", method: "manual", actionType: "payment", note: "" }),
        [field]: value,
      },
    }));
  };

  const handleProcessPayment = async (student) => {
    if (!student?.id) return;
    const draft = paymentDrafts[student.id] || {};
    const amount = toAmount(draft.amount);
    if (amount <= 0) {
      setStatusMessage(`Enter a valid payment amount for ${student.fullName}.`);
      return;
    }

    setPaymentBusyId(student.id);
    setPermissionError("");
    setStatusMessage("");
    try {
      const classId = buildFeeTemplateId({
        schoolId: normalizedSchool,
        academicYear: normalizedYear,
        className: student.className,
      });
      const summarySnapshot = await fetchStudentFeeSummary({
        studentId: student.id,
        classId,
        schoolId: normalizedSchool,
        academicYear: normalizedYear,
      });
      const result = await processFeeTransaction({
        studentId: student.id,
        schoolId: normalizedSchool,
        academicYear: normalizedYear,
        actorName: schoolName || normalizedSchool,
        amount,
        transactionType: draft.actionType || "payment",
        paymentMethod: draft.method || "manual",
        note: draft.note || "",
        summary: summarySnapshot,
      });

      setStudents((prev) =>
        prev.map((entry) =>
          entry.id === student.id
            ? {
                ...entry,
                feePaidAmount: toAmount(result.feePaidAmount),
                feePendingAmount: toAmount(result.feePendingAmount),
                currentOutstandingBalance: toAmount(result.currentOutstandingBalance),
                feeStatus: result.feeStatus,
              }
            : entry
        )
      );
      setPaymentDrafts((prev) => ({
        ...prev,
        [student.id]: {
          ...(prev[student.id] || {}),
          amount: String(toAmount(result.currentOutstandingBalance)),
          note: "",
        },
      }));
      setStatusMessage(
        result.transactionType === "payment" && result.receiptNumber
          ? `Receipt ${result.receiptNumber} posted for ${student.fullName}.`
          : `${normalize(draft.actionType || "payment")} recorded for ${student.fullName}.`
      );
    } catch (error) {
      console.error("Unable to process fee payment", error);
      setPermissionError(
        error?.code === "permission-denied"
          ? "Missing or insufficient permission to post the fee payment."
          : error.message || "Unable to process fee payment right now."
      );
    } finally {
      setPaymentBusyId("");
    }
  };

  return (
    <div className="fee-management-page">
      <div className="fee-management-topbar">
        <div className="fee-management-toolbar">
          <div className="fee-toolbar-filters">
            <div className="fee-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by student, roll number, phone, or class"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <select className="fee-class-filter" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              <option value="">All classes</option>
              {classOptions.map((className) => (
                <option key={className} value={className}>
                  {className}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="fee-config-toggle"
              onClick={() => setConfigExpanded((current) => !current)}
            >
              {configExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {configExpanded ? "Hide Configuration" : "Show Configuration Details"}
            </button>
          </div>

          <div className="fee-toolbar-meta">
            <span>{filteredStudents.length} visible</span>
            <span>Templates + overrides</span>
          </div>
        </div>

        <div className={`fee-config-drawer ${configExpanded ? "expanded" : "collapsed"}`}>
          <div className="fee-panel-card fee-config-panel">
            <div className="fee-panel-head">
              <div>
                <p>Class Templates</p>
                <h3>Common configuration</h3>
              </div>
              <div className="fee-config-context">
                <span>{activeTemplateKey === "school" ? "School" : activeTemplateKey}</span>
                <strong>Rs {activeTemplateTotal.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div className="fee-template-editor fee-template-editor-inline">
              <div className="fee-template-editor-head">
                <strong>{activeTemplateKey === "school" ? "Complete School Default" : `${activeTemplateKey} Template`}</strong>
                <span>Total Rs {activeTemplateTotal.toLocaleString("en-IN")}</span>
              </div>

              <div className="fee-template-form-grid">
                <label>
                  <span>Collection Cycle</span>
                  <select
                    value={activeTemplateDraft.cycle}
                    onChange={(event) => updateTemplateField("cycle", event.target.value)}
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </label>
                <label>
                  <span>Base Tuition</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTemplateDraft.baseTuition}
                    onChange={(event) => updateTemplateField("baseTuition", event.target.value)}
                  />
                </label>
                <label>
                  <span>Transport Standard</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTemplateDraft.transportStandard}
                    onChange={(event) => updateTemplateField("transportStandard", event.target.value)}
                  />
                </label>
                <label>
                  <span>Exam Fee</span>
                  <input
                    type="number"
                    min="0"
                    value={activeTemplateDraft.examFee}
                    onChange={(event) => updateTemplateField("examFee", event.target.value)}
                  />
                </label>
              </div>

              <div className="fee-template-manage-grid">
                <div className="fee-template-manage-panel">
                  <div className="fee-template-manage-head">
                    <h4>Structural Waivers</h4>
                    <button type="button" className="fee-manage-add" onClick={upsertWaiver}>
                      <Plus size={13} />
                      {editingWaiverKey ? "Save Waiver" : "Add Custom Waiver"}
                    </button>
                  </div>
                  <div className="fee-template-inline-form">
                    <input
                      type="text"
                      placeholder="Waiver label"
                      value={waiverDraft.label}
                      onChange={(event) => setWaiverDraft((prev) => ({ ...prev, label: event.target.value }))}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={waiverDraft.amount}
                      onChange={(event) => setWaiverDraft((prev) => ({ ...prev, amount: event.target.value }))}
                    />
                  </div>
                  <div className="fee-template-pill-list">
                    {(activeTemplateDraft.availableWaivers || []).map((waiver) => (
                      <div key={waiver.key} className="fee-template-pill fee-template-pill-waiver">
                        <span>{waiver.label}</span>
                        <small>-Rs {toAmount(waiver.amount).toLocaleString("en-IN")}</small>
                        <button type="button" onClick={() => editWaiver(waiver)} title="Edit waiver">
                          <Pencil size={12} />
                        </button>
                        <button type="button" onClick={() => deleteWaiver(waiver.key)} title="Delete waiver">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="fee-template-manage-panel">
                  <div className="fee-template-manage-head">
                    <h4>Selected Add-ons</h4>
                    <button type="button" className="fee-manage-add" onClick={upsertAddon}>
                      <Plus size={13} />
                      {editingAddonId ? "Save Add-on" : "Add Custom Add-on"}
                    </button>
                  </div>
                  <div className="fee-template-inline-form">
                    <input
                      type="text"
                      placeholder="Add-on label"
                      value={addonDraft.label}
                      onChange={(event) => setAddonDraft((prev) => ({ ...prev, label: event.target.value }))}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Amount"
                      value={addonDraft.amount}
                      onChange={(event) => setAddonDraft((prev) => ({ ...prev, amount: event.target.value }))}
                    />
                  </div>
                  <div className="fee-template-pill-list">
                    {(activeTemplateDraft.availableAddons || []).map((addon) => (
                      <div key={addon.id} className="fee-template-pill fee-template-pill-addon">
                        <span>{addon.label}</span>
                        <small>+Rs {toAmount(addon.amount).toLocaleString("en-IN")}</small>
                        <button type="button" onClick={() => editAddon(addon)} title="Edit add-on">
                          <Pencil size={12} />
                        </button>
                        <button type="button" onClick={() => deleteAddon(addon.id)} title="Delete add-on">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="fee-template-editor-actions">
                <button type="button" className="save-setup" onClick={saveActiveTemplate} disabled={configSaving}>
                  {configSaving ? <Loader2 className="spin" size={14} /> : <BookOpenCheck size={14} />}
                  {configSaving ? "Saving..." : activeTemplateKey === "school" ? "Save School Default" : "Save Class Template"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="fee-management-summary fee-management-summary-extended">
          <div className="fee-summary-card">
            <span>Visible Students</span>
            <strong>{summary.total}</strong>
          </div>
          <div className="fee-summary-card success">
            <span>Paid</span>
            <strong>{summary.paid}</strong>
          </div>
          <div className="fee-summary-card info">
            <span>Partial</span>
            <strong>{summary.partial}</strong>
          </div>
          <div className="fee-summary-card warning">
            <span>Pending</span>
            <strong>{summary.pending}</strong>
          </div>
          <div className="fee-summary-card accent">
            <span>Total Due</span>
            <strong>Rs {summary.totalDue.toLocaleString("en-IN")}</strong>
          </div>
          <div className="fee-summary-card accent-soft">
            <span>Outstanding</span>
            <strong>Rs {summary.totalOutstanding.toLocaleString("en-IN")}</strong>
          </div>
        </div>
      </div>

      {permissionError ? <p className="fee-status-message fee-status-danger">{permissionError}</p> : null}
      {statusMessage ? <p className="fee-status-message">{statusMessage}</p> : null}

      <div className="fee-management-layout">
        <section className="fee-main-panel">
          {loading ? (
            <div className="fee-management-state-card">Loading fee records...</div>
          ) : !students.length ? (
            <div className="fee-management-state-card">
              No students found for this school yet.
              <SchoolAdminQuickLinkHint
                title={classOptions.length ? "Fee records need enrolled students" : "Classes and students are not ready yet"}
                description={
                  classOptions.length
                    ? "Add students into class rosters first, then fee management can load their payment setup."
                    : "Create classes first, then add students so the fee ledger can be generated from the active roster."
                }
                links={
                  classOptions.length
                    ? [
                        { label: "Open Upload Students", to: "/school-admin/students/upload" },
                        { label: "Open Student Report", to: "/school-admin/students/student-report" },
                      ]
                    : [
                        { label: "Open Dashboard > Class", to: "/school-admin/home?tab=classes" },
                      ]
                }
              />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="fee-management-state-card">No students match the current filters.</div>
          ) : (
            <div className="fee-table-wrap">
              <table className="fee-table fee-table-upgraded">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Model</th>
                    <th>Cycle</th>
                    <th>Total Fee</th>
                    <th>Paid</th>
                    <th>Outstanding</th>
                    <th>Status</th>
                    <th>Payment Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const draft = paymentDrafts[student.id] || { amount: "", method: "manual", actionType: "payment", note: "" };
                    const isBusy = paymentBusyId === student.id;
                    const isOpen = openStudentId === student.id;
                    return (
                      <React.Fragment key={student.id}>
                        <tr
                          className={isOpen ? "fee-row-selected" : ""}
                          onClick={() => setOpenStudentId((current) => (current === student.id ? "" : student.id))}
                        >
                          <td className="fee-sticky-col fee-student-col">
                            <div className="fee-student-cell">
                              <strong>{student.fullName}</strong>
                              <span>{[student.className, student.section, student.rollNumber].filter(Boolean).join(" | ")}</span>
                              <button
                                type="button"
                                className="fee-inline-toggle"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setOpenStudentId((current) => (current === student.id ? "" : student.id));
                                }}
                              >
                                Customize Fee {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </div>
                          </td>
                          <td>
                            <span className={`fee-mode-pill ${student.feeCalculationMode === "custom_override" ? "custom" : "default"}`}>
                              {student.feeCalculationMode === "custom_override" ? "Custom override" : "Class default"}
                            </span>
                          </td>
                          <td className="fee-cycle-cell">{normalize(student.feeCollectionCycle || "monthly")}</td>
                          <td>Rs {toAmount(student.feeAmount).toLocaleString("en-IN")}</td>
                          <td>Rs {toAmount(student.feePaidAmount).toLocaleString("en-IN")}</td>
                          <td>Rs {toAmount(student.currentOutstandingBalance).toLocaleString("en-IN")}</td>
                          <td className="fee-status-col">
                            <span className={`fee-status-pill ${student.feeStatus}`}>
                              {student.feeStatus === "paid" ? (
                                <CheckCircle2 size={13} />
                              ) : student.feeStatus === "partial" ? (
                                <CircleEllipsis size={13} />
                              ) : (
                                <XCircle size={13} />
                              )}
                              {student.feeStatus === "paid" ? "Paid" : student.feeStatus === "partial" ? "Partial" : "Pending"}
                            </span>
                          </td>
                          <td className="fee-action-col" onClick={(event) => event.stopPropagation()}>
                            <div className="fee-ledger-box">
                              <div className="partial-pay-box">
                                <select
                                  className="fee-payment-method"
                                  value={draft.actionType || "payment"}
                                  onChange={(event) => handlePaymentDraftChange(student.id, "actionType", event.target.value)}
                                >
                                  <option value="payment">Receipt</option>
                                  <option value="due">Add Due</option>
                                  <option value="concession">Concession</option>
                                  <option value="reversal">Reversal</option>
                                </select>
                                <div className="partial-pay-input">
                                  <IndianRupee size={13} />
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={draft.amount}
                                    onChange={(event) => handlePaymentDraftChange(student.id, "amount", event.target.value)}
                                  />
                                </div>
                                <select
                                  className="fee-payment-method"
                                  value={draft.method}
                                  onChange={(event) => handlePaymentDraftChange(student.id, "method", event.target.value)}
                                >
                                  <option value="manual">Manual</option>
                                  <option value="cash">Cash</option>
                                  <option value="upi">UPI</option>
                                  <option value="bank">Bank</option>
                                </select>
                                <button
                                  type="button"
                                  className="mark-paid fee-ledger-button"
                                  disabled={isBusy || toAmount(draft.amount) <= 0}
                                  onClick={() => handleProcessPayment(student)}
                                  title="Post ledger transaction"
                                >
                                  {isBusy ? <Loader2 className="spin" size={13} /> : <ReceiptText size={13} />}
                                  {isBusy ? "Posting..." : "Post"}
                                </button>
                              </div>
                              <input
                                className="fee-note-input"
                                type="text"
                                placeholder="Transaction note"
                                value={draft.note}
                                onChange={(event) => handlePaymentDraftChange(student.id, "note", event.target.value)}
                              />
                            </div>
                          </td>
                        </tr>
                        {isOpen ? (
                          <tr className="fee-accordion-row">
                            <td colSpan={8}>
                              <FeeCustomizer
                                student={student}
                                schoolId={normalizedSchool}
                                academicYear={normalizedYear}
                                actorName={schoolName || normalizedSchool}
                                schoolDefaults={schoolTemplateDraft}
                                onSaved={handleCustomizerSaved}
                              />
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
