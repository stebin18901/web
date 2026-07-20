import React, { useEffect, useMemo, useState } from "react";
import { CalendarRange, CopyPlus } from "lucide-react";
import {
  createAcademicYearWorkspace,
  ensureAcademicYearRecords,
  getDefaultAcademicYear,
} from "./schoolYearUtils";
import "./AcademicYearBar.css";

const TRANSFER_OPTIONS = [
  { key: "students", label: "Student registration details" },
  { key: "classes", label: "Classes and divisions" },
  { key: "teachers", label: "Teacher records" },
  { key: "feeSetup", label: "Fee setup defaults" },
];

export default function AcademicYearBar({
  schoolId,
  schoolName = "",
  activeAcademicYear,
  onAcademicYearChange,
}) {
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [yearDraft, setYearDraft] = useState(getDefaultAcademicYear());
  const [sourceYear, setSourceYear] = useState("");
  const [transferDraft, setTransferDraft] = useState({
    students: true,
    classes: true,
    teachers: false,
    feeSetup: true,
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const loadYears = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const records = await ensureAcademicYearRecords({ schoolId, schoolName });
      const sorted = [...records].sort((left, right) => Number(right.id) - Number(left.id));
      setYears(sorted);
      if (!activeAcademicYear && sorted.length) {
        onAcademicYearChange?.(sorted[0].id);
      }
      if (!sourceYear && sorted.length) {
        setSourceYear(sorted[0].id);
      }
    } catch (error) {
      console.error("Failed to load academic years", error);
      setStatusMessage("Could not load academic years.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadYears();
  }, [schoolId]);

  const yearOptions = useMemo(() => years.map((entry) => entry.id), [years]);

  const handleCreateYear = async () => {
    if (!yearDraft.trim()) {
      setStatusMessage("Enter a year before creating the workspace.");
      return;
    }
    setSaving(true);
    setStatusMessage("");
    try {
      const nextYear = await createAcademicYearWorkspace({
        schoolId,
        schoolName,
        targetYear: yearDraft,
        sourceYear,
        transfers: transferDraft,
      });
      await loadYears();
      if (nextYear?.id) {
        onAcademicYearChange?.(nextYear.id);
      }
      setCreateOpen(false);
      setStatusMessage(`Academic year ${yearDraft} created successfully.`);
    } catch (error) {
      console.error("Failed to create academic year", error);
      setStatusMessage(error.message || "Academic year could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="academic-year-bar">
        <div className="academic-year-bar-copy">
          <div className="academic-year-icon">
            <CalendarRange size={18} />
          </div>
          <div>
            <strong>Academic Year Workspace</strong>
            <span>All school-admin records now follow the active year.</span>
          </div>
        </div>

        <div className="academic-year-bar-actions">
          <select
            className="academic-year-select"
            value={activeAcademicYear}
            onChange={(event) => onAcademicYearChange?.(event.target.value)}
            disabled={loading}
          >
            {yearOptions.length ? (
              yearOptions.map((yearId) => (
                <option key={yearId} value={yearId}>
                  {yearId}
                </option>
              ))
            ) : (
              <option value="">No year found</option>
            )}
          </select>
          <button type="button" className="academic-year-btn primary" onClick={() => setCreateOpen(true)}>
            <CopyPlus size={15} />
            New Year
          </button>
        </div>
      </div>

      {statusMessage ? <div className="academic-year-status">{statusMessage}</div> : null}

      {createOpen ? (
        <div className="academic-year-modal-overlay" onClick={() => setCreateOpen(false)}>
          <div className="academic-year-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create Academic Year Workspace</h3>
            <p>Create a separate year account and choose which base data should be transferred to make setup easier.</p>

            <label className="academic-year-field">
              <span>New Year</span>
              <input type="text" value={yearDraft} onChange={(event) => setYearDraft(event.target.value)} placeholder="2027" />
            </label>

            <label className="academic-year-field">
              <span>Copy From Year</span>
              <select value={sourceYear} onChange={(event) => setSourceYear(event.target.value)}>
                <option value="">Start blank</option>
                {yearOptions.map((yearId) => (
                  <option key={yearId} value={yearId}>
                    {yearId}
                  </option>
                ))}
              </select>
            </label>

            <div className="academic-year-transfer-list">
              {TRANSFER_OPTIONS.map((option) => (
                <label key={option.key} className="academic-year-transfer-item">
                  <input
                    type="checkbox"
                    checked={transferDraft[option.key]}
                    onChange={(event) =>
                      setTransferDraft((prev) => ({
                        ...prev,
                        [option.key]: event.target.checked,
                      }))
                    }
                    disabled={!sourceYear}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <div className="academic-year-modal-actions">
              <button type="button" className="academic-year-btn secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </button>
              <button type="button" className="academic-year-btn primary" onClick={handleCreateYear} disabled={saving}>
                {saving ? "Creating..." : "Create Year"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
