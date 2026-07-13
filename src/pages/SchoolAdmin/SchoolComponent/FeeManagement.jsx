import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  CheckCircle2,
  CircleEllipsis,
  IndianRupee,
  Save,
  Search,
  Settings2,
  Wallet,
  XCircle,
} from "lucide-react";
import { db } from "../../../firebase/firebaseConfig";
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
    student.feePendingAmount === 0 || student.feePendingAmount
      ? toAmount(student.feePendingAmount)
      : Math.max(feeAmount - feePaidAmount, 0);

  if (direct === "paid") return "paid";
  if (direct === "partial") return "partial";
  if (["pending", "not_paid", "unpaid"].includes(direct)) return "pending";
  if (feeAmount > 0 && pendingFromDoc === 0) return "paid";
  if (feePaidAmount > 0 && pendingFromDoc > 0) return "partial";
  return "pending";
};

export default function FeeManagement({ schoolId, schoolName = "" }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);
  const [feeConfig, setFeeConfig] = useState({
    cycle: "monthly",
    amount: "0",
  });

  const normalizedSchoolId = useMemo(() => normalizeSchoolId(schoolId), [schoolId]);

  useEffect(() => {
    const loadFeeData = async () => {
      if (!normalizedSchoolId) return;
      setLoading(true);
      setStatusMessage("");

      try {
        const [schoolSnap, studentSnap] = await Promise.all([
          getDoc(doc(db, "schools", normalizedSchoolId)),
          getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId))),
        ]);

        const schoolData = schoolSnap.exists() ? schoolSnap.data() || {} : {};
        const baseCycle = normalize(schoolData.feeCollectionCycle || "monthly").toLowerCase() || "monthly";
        const baseAmount = toAmount(schoolData.feeAmount);

        setFeeConfig({
          cycle: ["weekly", "monthly", "yearly"].includes(baseCycle) ? baseCycle : "monthly",
          amount: String(baseAmount || 0),
        });

        const rows = studentSnap.docs
          .map((entry) => {
            const data = entry.data() || {};
            const feeAmount = toAmount(data.feeAmount || baseAmount);
            const feePaidAmount = toAmount(data.feePaidAmount);
            const feePendingAmount =
              data.feePendingAmount === 0 || data.feePendingAmount
                ? toAmount(data.feePendingAmount)
                : Math.max(feeAmount - feePaidAmount, 0);
            return {
              id: entry.id,
              ...data,
              fullName: normalize(data.fullName || data.name || "Student"),
              className: normalize(data.className),
              section: normalize(data.section),
              rollNumber: normalize(data.rollNumber),
              phone: normalize(data.phone || data.parentPhone),
              feeCollectionCycle: normalize(data.feeCollectionCycle || baseCycle || "monthly").toLowerCase() || "monthly",
              feeAmount,
              feePaidAmount,
              feePendingAmount,
              feeStatus: inferStatus(
                {
                  ...data,
                  feeAmount,
                  feePaidAmount,
                  feePendingAmount,
                },
                baseAmount
              ),
            };
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
            accumulator[student.id] = String(student.feePaidAmount || "");
            return accumulator;
          }, {})
        );
      } catch (error) {
        console.error("Unable to load fee records", error);
        setStatusMessage("Unable to load fee records right now.");
      } finally {
        setLoading(false);
      }
    };

    loadFeeData();
  }, [normalizedSchoolId]);

  const classOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.className).filter(Boolean))),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const searchLower = normalize(searchTerm).toLowerCase();
    return students.filter((student) => {
      const matchesClass = selectedClass ? student.className === selectedClass : true;
      const haystack = [
        student.fullName,
        student.rollNumber,
        student.phone,
        student.className,
        student.section,
      ]
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
    return { total, paid, partial, pending };
  }, [filteredStudents]);

  const applyFeePayload = (student, nextStatus, customPaidAmount = null) => {
    const feeAmount = toAmount(student.feeAmount || feeConfig.amount);
    let feePaidAmount = 0;

    if (nextStatus === "paid") {
      feePaidAmount = feeAmount;
    } else if (nextStatus === "partial") {
      feePaidAmount = Math.min(feeAmount, toAmount(customPaidAmount));
    }

    const feePendingAmount = Math.max(feeAmount - feePaidAmount, 0);
    const resolvedStatus = feePendingAmount === 0 ? "paid" : feePaidAmount > 0 ? "partial" : "pending";

    return {
      feeStatus: resolvedStatus,
      feeCollectionCycle: normalize(student.feeCollectionCycle || feeConfig.cycle || "monthly").toLowerCase() || "monthly",
      feeAmount,
      feePaidAmount,
      feePendingAmount,
      feeUpdatedAt: serverTimestamp(),
      feeUpdatedBy: schoolName || normalizedSchoolId,
    };
  };

  const syncStudentLocally = (studentId, payload) => {
    setStudents((prev) =>
      prev.map((entry) =>
        entry.id === studentId
          ? {
              ...entry,
              ...payload,
              feeUpdatedAt: new Date(),
            }
          : entry
      )
    );
    if (payload.feePaidAmount === 0 || payload.feePaidAmount) {
      setPaymentDrafts((prev) => ({
        ...prev,
        [studentId]: String(payload.feePaidAmount || ""),
      }));
    }
  };

  const persistToStudentAndEnrollment = async (student, payload) => {
    await updateDoc(doc(db, "studentAccounts", student.id), payload);

    const enrollmentRef = doc(db, "defaultSchoolEnrollments", student.id);
    const enrollmentSnap = await getDoc(enrollmentRef);
    if (enrollmentSnap.exists()) {
      await updateDoc(enrollmentRef, payload);
      return;
    }

    await setDoc(
      enrollmentRef,
      {
        schoolId: normalizedSchoolId,
        fullName: student.fullName,
        className: student.className,
        rollNumber: student.rollNumber,
        phone: student.phone,
        ...payload,
      },
      { merge: true }
    );
  };

  const updateStudentFeeStatus = async (student, nextStatus) => {
    if (!student?.id || !normalizedSchoolId) return;
    const amountInput = paymentDrafts[student.id];
    if (nextStatus === "partial" && toAmount(amountInput) <= 0) {
      setStatusMessage(`Enter a partial amount for ${student.fullName}.`);
      return;
    }

    setSavingId(student.id);
    setStatusMessage("");

    try {
      const payload = applyFeePayload(student, nextStatus, amountInput);
      await persistToStudentAndEnrollment(student, payload);
      syncStudentLocally(student.id, payload);
      setStatusMessage(`Fee status updated for ${student.fullName}.`);
    } catch (error) {
      console.error("Unable to update fee status", error);
      setStatusMessage(`Could not update ${student.fullName}. Please try again.`);
    } finally {
      setSavingId("");
    }
  };

  const bulkMarkVisible = async (nextStatus) => {
    if (!filteredStudents.length || !normalizedSchoolId) return;
    setSavingId(`bulk-${nextStatus}`);
    setStatusMessage("");

    try {
      const batch = writeBatch(db);
      filteredStudents.forEach((student) => {
        const payload = applyFeePayload(student, nextStatus);
        batch.set(doc(db, "studentAccounts", student.id), payload, { merge: true });
        batch.set(
          doc(db, "defaultSchoolEnrollments", student.id),
          {
            schoolId: normalizedSchoolId,
            fullName: student.fullName,
            className: student.className,
            rollNumber: student.rollNumber,
            phone: student.phone,
            ...payload,
          },
          { merge: true }
        );
      });
      await batch.commit();

      setStudents((prev) =>
        prev.map((student) => {
          const matchedStudent = filteredStudents.find((visibleStudent) => visibleStudent.id === student.id);
          return matchedStudent ? { ...student, ...applyFeePayload(student, nextStatus) } : student;
        })
      );
      setStatusMessage(
        `Marked ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"} as ${nextStatus}.`
      );
    } catch (error) {
      console.error("Unable to bulk update fee status", error);
      setStatusMessage("Bulk update failed. Please try again.");
    } finally {
      setSavingId("");
    }
  };

  const handleSingleStatusUpdate = (student, nextStatus) => {
    const amountInput = paymentDrafts[student.id];
    if (nextStatus === "partial" && toAmount(amountInput) <= 0) {
      setStatusMessage(`Enter a partial amount for ${student.fullName}.`);
      return;
    }
    updateStudentFeeStatus(student, nextStatus);
  };

  const openBulkActionConfirm = (nextStatus) => {
    if (!filteredStudents.length || !normalizedSchoolId) return;

    const isPendingReset = nextStatus === "pending";
    setConfirmAction({
      type: "bulk",
      title: isPendingReset ? "Reset visible students to pending?" : "Mark visible students as paid?",
      message: isPendingReset
        ? `This will reset ${filteredStudents.length} visible student${filteredStudents.length === 1 ? "" : "s"} to pending status.`
        : `This will mark ${filteredStudents.length} visible student${filteredStudents.length === 1 ? "" : "s"} as paid.`,
      detail: "This action updates live fee records for the currently filtered students.",
      confirmLabel: isPendingReset ? "Reset to Pending" : "Mark Visible Paid",
      tone: isPendingReset ? "danger" : "primary",
      onConfirm: () => bulkMarkVisible(nextStatus),
    });
  };

  const openSetupConfirm = () => {
    const amount = toAmount(feeConfig.amount);
    const cycle = normalize(feeConfig.cycle).toLowerCase();
    if (!["weekly", "monthly", "yearly"].includes(cycle)) {
      setStatusMessage("Choose a valid collection cycle.");
      return;
    }

    setConfirmAction({
      type: "setup",
      title: "Save fee setup for this school?",
      message: `Collection cycle will be set to ${cycle} and the default fee amount will be Rs ${amount.toLocaleString("en-IN")}.`,
      detail: `This also recalculates fee records for ${students.length} student${students.length === 1 ? "" : "s"} in this school.`,
      confirmLabel: "Save Setup",
      tone: "danger",
      onConfirm: saveFeeSetup,
    });
  };

  const saveFeeSetup = async () => {
    if (!normalizedSchoolId) return;
    const amount = toAmount(feeConfig.amount);
    const cycle = normalize(feeConfig.cycle).toLowerCase();
    if (!["weekly", "monthly", "yearly"].includes(cycle)) {
      setStatusMessage("Choose a valid collection cycle.");
      return;
    }

    setConfigSaving(true);
    setStatusMessage("");

    try {
      await setDoc(
        doc(db, "schools", normalizedSchoolId),
        {
          feeCollectionCycle: cycle,
          feeAmount: amount,
          feeCollectionEnabled: true,
          feeUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const batch = writeBatch(db);
      students.forEach((student) => {
        const currentPaidAmount = toAmount(student.feePaidAmount);
        const feePendingAmount = Math.max(amount - Math.min(amount, currentPaidAmount), 0);
        const feeStatus = feePendingAmount === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending";
        const payload = {
          feeCollectionCycle: cycle,
          feeAmount: amount,
          feePaidAmount: Math.min(amount, currentPaidAmount),
          feePendingAmount,
          feeStatus,
          feeUpdatedAt: serverTimestamp(),
          feeUpdatedBy: schoolName || normalizedSchoolId,
        };
        batch.set(doc(db, "studentAccounts", student.id), payload, { merge: true });
        batch.set(doc(db, "defaultSchoolEnrollments", student.id), payload, { merge: true });
      });
      await batch.commit();

      setStudents((prev) =>
        prev.map((student) => {
          const currentPaidAmount = Math.min(amount, toAmount(student.feePaidAmount));
          const feePendingAmount = Math.max(amount - currentPaidAmount, 0);
          return {
            ...student,
            feeCollectionCycle: cycle,
            feeAmount: amount,
            feePaidAmount: currentPaidAmount,
            feePendingAmount,
            feeStatus: feePendingAmount === 0 ? "paid" : currentPaidAmount > 0 ? "partial" : "pending",
          };
        })
      );
      setStatusMessage("Fee setup saved. Parent app will now use this collection cycle and amount.");
      setSetupOpen(false);
    } catch (error) {
      console.error("Unable to save fee setup", error);
      setStatusMessage("Fee setup could not be saved. Please try again.");
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="fee-management-page">
      <div className="fee-management-hero">
        <div>
          <p className="fee-management-kicker">Fee Control</p>
          <h2>Student Fee Status</h2>
          <p className="fee-management-subtitle">
            Manage cycle, amount, and payment collection for paid schools. Parents will see paid, partial, and pending
            balances in the app.
          </p>
        </div>
        <div className="fee-hero-actions">
          <div className="fee-management-hero-badge">
            <Wallet size={18} />
            <span>{schoolName || normalizedSchoolId}</span>
          </div>
          <button type="button" className="fee-setup-toggle" onClick={() => setSetupOpen((value) => !value)}>
            <Settings2 size={16} />
            Setup
          </button>
        </div>
      </div>

      {setupOpen ? (
        <div className="fee-setup-card">
          <div className="fee-setup-head">
            <div>
              <h3>Fee Collection Setup</h3>
              <p>Choose how often the school collects fees and set the default amount. Default cycle is monthly.</p>
            </div>
          </div>

          <div className="fee-setup-grid">
            <label>
              <span>Collection Cycle</span>
              <select
                value={feeConfig.cycle}
                onChange={(event) => setFeeConfig((prev) => ({ ...prev, cycle: event.target.value }))}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label>
              <span>Fee Amount</span>
              <div className="fee-amount-input">
                <IndianRupee size={16} />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={feeConfig.amount}
                  onChange={(event) => setFeeConfig((prev) => ({ ...prev, amount: event.target.value }))}
                />
              </div>
            </label>
          </div>

          <div className="fee-setup-actions">
            <button type="button" className="save-setup" onClick={openSetupConfirm} disabled={configSaving}>
              <Save size={16} />
              {configSaving ? "Saving..." : "Save Setup"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="fee-management-summary">
        <div className="fee-summary-card">
          <span>Visible Students</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="fee-summary-card success">
          <span>Fees Paid</span>
          <strong>{summary.paid}</strong>
        </div>
        <div className="fee-summary-card info">
          <span>Partial Paid</span>
          <strong>{summary.partial}</strong>
        </div>
        <div className="fee-summary-card warning">
          <span>Fee Pending</span>
          <strong>{summary.pending}</strong>
        </div>
      </div>

      <div className="fee-management-toolbar">
        <div className="fee-search">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, roll number, phone, or class"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
          <option value="">All classes</option>
          {classOptions.map((className) => (
            <option key={className} value={className}>
              {className}
            </option>
          ))}
        </select>

        <div className="fee-bulk-actions">
          <button
            type="button"
            className="bulk-paid"
            onClick={() => openBulkActionConfirm("paid")}
            disabled={!filteredStudents.length || savingId.startsWith("bulk-")}
          >
            Mark Visible Paid
          </button>
          <button
            type="button"
            className="bulk-pending"
            onClick={() => openBulkActionConfirm("pending")}
            disabled={!filteredStudents.length || savingId.startsWith("bulk-")}
          >
            Reset Visible To Pending
          </button>
        </div>
      </div>

      {statusMessage ? <p className="fee-status-message">{statusMessage}</p> : null}

      {loading ? (
        <div className="fee-management-state-card">Loading fee records...</div>
      ) : !students.length ? (
        <div className="fee-management-state-card">No students found for this school yet.</div>
      ) : filteredStudents.length === 0 ? (
        <div className="fee-management-state-card">No students match the current filters.</div>
      ) : (
        <div className="fee-table-wrap">
          <table className="fee-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Cycle</th>
                <th>Fee</th>
                <th>Paid</th>
                <th>Pending</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const isSaving = savingId === student.id;
                return (
                  <tr key={student.id}>
                    <td>
                      <div className="fee-student-cell">
                        <strong>{student.fullName}</strong>
                        <span>{[student.className, student.section, student.rollNumber].filter(Boolean).join(" | ")}</span>
                      </div>
                    </td>
                    <td className="fee-cycle-cell">{normalize(student.feeCollectionCycle || feeConfig.cycle || "monthly")}</td>
                    <td>Rs {toAmount(student.feeAmount).toLocaleString("en-IN")}</td>
                    <td>Rs {toAmount(student.feePaidAmount).toLocaleString("en-IN")}</td>
                    <td>Rs {toAmount(student.feePendingAmount).toLocaleString("en-IN")}</td>
                    <td>
                      <span className={`fee-status-pill ${student.feeStatus}`}>
                        {student.feeStatus === "paid" ? (
                          <CheckCircle2 size={14} />
                        ) : student.feeStatus === "partial" ? (
                          <CircleEllipsis size={14} />
                        ) : (
                          <XCircle size={14} />
                        )}
                        {student.feeStatus === "paid"
                          ? "Paid"
                          : student.feeStatus === "partial"
                            ? "Partial"
                            : "Pending"}
                      </span>
                    </td>
                    <td>
                      <div className="fee-row-actions">
                        <button
                          type="button"
                          className="mark-paid"
                          disabled={isSaving || student.feeStatus === "paid"}
                          onClick={() => handleSingleStatusUpdate(student, "paid")}
                        >
                          <CheckCircle2 size={14} />
                          Paid
                        </button>

                        <div className="partial-pay-box">
                          <div className="partial-pay-input">
                            <IndianRupee size={14} />
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={paymentDrafts[student.id] || ""}
                              onChange={(event) =>
                                setPaymentDrafts((prev) => ({
                                  ...prev,
                                  [student.id]: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="mark-partial"
                            disabled={isSaving}
                            onClick={() => handleSingleStatusUpdate(student, "partial")}
                          >
                            Partial
                          </button>
                        </div>

                        <button
                          type="button"
                          className="mark-pending"
                          disabled={isSaving || student.feeStatus === "pending"}
                          onClick={() => handleSingleStatusUpdate(student, "pending")}
                        >
                          <XCircle size={14} />
                          Pending
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmAction ? (
        <div className="fee-modal-overlay" onClick={() => setConfirmAction(null)}>
          <div className="fee-modal" onClick={(event) => event.stopPropagation()}>
            <h4>{confirmAction.title}</h4>
            <p>{confirmAction.message}</p>
            {confirmAction.detail ? <div className="fee-modal-detail">{confirmAction.detail}</div> : null}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setConfirmAction(null)}>
                Cancel
              </button>
              <button
                className={`modal-confirm ${confirmAction.tone === "primary" ? "fee-confirm-primary" : ""}`}
                onClick={async () => {
                  const runAction = confirmAction.onConfirm;
                  setConfirmAction(null);
                  await runAction?.();
                }}
              >
                {confirmAction.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
