import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, MinusCircle, PlusCircle, Save } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  calculateStudentFeeSummary,
  getFeeTemplateRef,
  getStudentFeeConfigRef,
  normalizeAddonRecord,
  normalizeFeeTemplate,
} from "./feeManagementUtils";

const normalize = (value) => String(value || "").trim();
const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

export default function FeeCustomizer({
  student,
  schoolId,
  academicYear,
  actorName = "School Admin",
  schoolDefaults = null,
  onSaved,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [templateDraft, setTemplateDraft] = useState(null);
  const [configDraft, setConfigDraft] = useState({
    useClassDefaults: true,
    customBaseFee: 0,
    activeWaivers: [],
    selectedAddons: [],
  });

  const className = normalize(student?.className);
  useEffect(() => {
    const loadCustomizer = async () => {
      if (!student?.id || !schoolId || !className) return;
      setLoading(true);
      setPermissionError("");
      setStatusMessage("");
      try {
        const [templateSnap, configSnap] = await Promise.all([
          getDoc(getFeeTemplateRef({ schoolId, academicYear, className })),
          getDoc(getStudentFeeConfigRef(student.id)),
        ]);

        const fallbackTemplate = {
          cycle: student.feeCollectionCycle || schoolDefaults?.cycle || "monthly",
          baseTuition: schoolDefaults?.baseTuition || student.feeAmount || 0,
          transportStandard: schoolDefaults?.transportStandard || 0,
          examFee: schoolDefaults?.examFee || 0,
          availableAddons: schoolDefaults?.availableAddons || [],
          availableWaivers: schoolDefaults?.availableWaivers || [],
        };

        setTemplateDraft(
          normalizeFeeTemplate(templateSnap.exists() ? templateSnap.data() : fallbackTemplate, fallbackTemplate)
        );
        setConfigDraft(
          configSnap.exists()
            ? {
                useClassDefaults: configSnap.data().useClassDefaults !== false,
                customBaseFee: toAmount(configSnap.data().customBaseFee),
                activeWaivers: Array.isArray(configSnap.data().activeWaivers) ? configSnap.data().activeWaivers : [],
                selectedAddons: Array.isArray(configSnap.data().selectedAddons)
                  ? configSnap.data().selectedAddons.map(normalizeAddonRecord)
                  : [],
              }
            : {
                useClassDefaults: true,
                customBaseFee: 0,
                activeWaivers: [],
                selectedAddons: [],
              }
        );
      } catch (error) {
        console.error("Unable to load student override", error);
        setPermissionError(
          error?.code === "permission-denied"
            ? "Missing or insufficient permission to load student override."
            : "Unable to load student override."
        );
      } finally {
        setLoading(false);
      }
    };

    loadCustomizer();
  }, [academicYear, className, schoolDefaults, schoolId, student]);

  const summary = useMemo(
    () => calculateStudentFeeSummary({ template: templateDraft || {}, config: configDraft }),
    [configDraft, templateDraft]
  );

  const toggleWaiver = (waiverKey) => {
    setConfigDraft((prev) => ({
      ...prev,
      activeWaivers: prev.activeWaivers.includes(waiverKey)
        ? prev.activeWaivers.filter((entry) => entry !== waiverKey)
        : [...prev.activeWaivers, waiverKey],
    }));
  };

  const toggleAddon = (addon) => {
    setConfigDraft((prev) => {
      const exists = prev.selectedAddons.some((entry) => entry.id === addon.id);
      return {
        ...prev,
        selectedAddons: exists
          ? prev.selectedAddons.filter((entry) => entry.id !== addon.id)
          : [...prev.selectedAddons, normalizeAddonRecord(addon)],
      };
    });
  };

  const saveOverride = async () => {
    if (!student?.id || !templateDraft) return;
    setSaving(true);
    setPermissionError("");
    setStatusMessage("");
    try {
      const configRef = getStudentFeeConfigRef(student.id);
      const studentRef = doc(db, "studentAccounts", student.id);
      const enrollmentRef = doc(db, "defaultSchoolEnrollments", student.id);
      const nextOutstanding = Math.max(summary.customizedStudentTotal - toAmount(student.feePaidAmount), 0);
      const nextFeeStatus = nextOutstanding === 0 ? "paid" : toAmount(student.feePaidAmount) > 0 ? "partial" : "pending";
      const nextMode = configDraft.useClassDefaults ? "class_default" : "custom_override";

      await Promise.all([
        setDoc(
          configRef,
          {
            useClassDefaults: configDraft.useClassDefaults,
            customBaseFee: configDraft.useClassDefaults ? 0 : toAmount(configDraft.customBaseFee),
            activeWaivers: configDraft.activeWaivers,
            selectedAddons: configDraft.selectedAddons.map(normalizeAddonRecord),
            updatedAt: serverTimestamp(),
            updatedBy: actorName,
          },
          { merge: true }
        ),
        setDoc(
          studentRef,
          {
            feeCollectionCycle: templateDraft.cycle,
            feeAmount: summary.customizedStudentTotal,
            currentOutstandingBalance: nextOutstanding,
            feePendingAmount: nextOutstanding,
            feeStatus: nextFeeStatus,
            feeCalculationMode: nextMode,
            feeUpdatedAt: serverTimestamp(),
            feeUpdatedBy: actorName,
          },
          { merge: true }
        ),
        setDoc(
          enrollmentRef,
          {
            schoolId: String(schoolId || "").trim().toLowerCase(),
            academicYear,
            fullName: student.fullName,
            className: student.className,
            rollNumber: student.rollNumber,
            phone: student.phone,
            feeCollectionCycle: templateDraft.cycle,
            feeAmount: summary.customizedStudentTotal,
            currentOutstandingBalance: nextOutstanding,
            feePendingAmount: nextOutstanding,
            feeStatus: nextFeeStatus,
            feeCalculationMode: nextMode,
            feeUpdatedAt: serverTimestamp(),
            feeUpdatedBy: actorName,
          },
          { merge: true }
        ),
      ]);

      setStatusMessage("Student fee override saved.");
      onSaved?.({
        studentId: student.id,
        customizedStudentTotal: summary.customizedStudentTotal,
        feeCollectionCycle: templateDraft.cycle,
        feeStatus: nextFeeStatus,
        feePendingAmount: nextOutstanding,
        currentOutstandingBalance: nextOutstanding,
        feeCalculationMode: nextMode,
      });
    } catch (error) {
      console.error("Unable to save student override", error);
      setPermissionError(
        error?.code === "permission-denied"
          ? "Missing or insufficient permission to save student override."
          : "Unable to save student override."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!student) return null;

  return (
    <div className="fee-inline-customizer">
      {permissionError ? <div className="fee-inline-alert error">{permissionError}</div> : null}
      {statusMessage ? <div className="fee-inline-alert success">{statusMessage}</div> : null}

      {loading ? (
        <div className="fee-customizer-loading">
          <Loader2 className="spin" size={16} />
          Loading student override...
        </div>
      ) : (
        <>
          <div className="fee-inline-customizer-head">
            <div>
              <strong>{student.fullName}</strong>
              <span>{className} {student.rollNumber ? `| Roll ${student.rollNumber}` : ""}</span>
            </div>
            <div className="fee-inline-customizer-stats">
              <span>Class total Rs {toAmount(summary.standardClassFee).toLocaleString("en-IN")}</span>
              <span>Student total Rs {toAmount(summary.customizedStudentTotal).toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="fee-inline-customizer-grid">
            <div className="fee-inline-customizer-panel">
              <label className="fee-customizer-toggle compact">
                <input
                  type="checkbox"
                  checked={configDraft.useClassDefaults}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      useClassDefaults: event.target.checked,
                    }))
                  }
                />
                <div>
                  <strong>Use class defaults</strong>
                  <span>Turn off to set a different student base amount.</span>
                </div>
              </label>

              {!configDraft.useClassDefaults ? (
                <label className="fee-customizer-input-block compact">
                  <span>Custom Base Fee</span>
                  <input
                    type="number"
                    min="0"
                    value={configDraft.customBaseFee}
                    onChange={(event) =>
                      setConfigDraft((prev) => ({
                        ...prev,
                        customBaseFee: toAmount(event.target.value),
                      }))
                    }
                  />
                </label>
              ) : null}
            </div>

            <div className="fee-inline-customizer-panel">
              <h5>Structural Waivers</h5>
              <div className="fee-choice-list">
                {(templateDraft?.availableWaivers || []).map((waiver) => {
                  const selected = configDraft.activeWaivers.includes(waiver.key);
                  return (
                    <button
                      type="button"
                      key={waiver.key}
                      className={`fee-choice-chip ${selected ? "selected" : ""}`}
                      onClick={() => toggleWaiver(waiver.key)}
                    >
                      {selected ? <MinusCircle size={13} /> : <PlusCircle size={13} />}
                      {waiver.label} (-Rs {toAmount(waiver.amount).toLocaleString("en-IN")})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="fee-inline-customizer-panel">
              <h5>Selected Add-ons</h5>
              <div className="fee-choice-list">
                {(templateDraft?.availableAddons || []).map((addon) => {
                  const selected = configDraft.selectedAddons.some((entry) => entry.id === addon.id);
                  return (
                    <button
                      type="button"
                      key={addon.id}
                      className={`fee-choice-chip ${selected ? "selected" : ""}`}
                      onClick={() => toggleAddon(addon)}
                    >
                      {selected ? <MinusCircle size={13} /> : <PlusCircle size={13} />}
                      {addon.label} (+Rs {toAmount(addon.amount).toLocaleString("en-IN")})
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="fee-inline-customizer-footer">
            <div className="fee-customizer-note">
              <AlertTriangle size={14} />
              This changes only this student, not the whole class.
            </div>
            <button type="button" className="fee-customizer-save" onClick={saveOverride} disabled={saving}>
              {saving ? <Loader2 className="spin" size={14} /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Override"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
