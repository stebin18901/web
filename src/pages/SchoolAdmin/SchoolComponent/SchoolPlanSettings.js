import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { buildSchoolPlanOptions, getDefaultSchoolPlan, normalizeSchoolId } from "../../../config/defaultSchool";
import "./SchoolPlanSettings.css";

const SCHOOL_PLANS = buildSchoolPlanOptions();

export default function SchoolPlanSettings({ school, schoolId, onPlanUpdated }) {
  const rawSchoolId = useMemo(() => String(schoolId || school?.schoolId || "").trim(), [schoolId, school]);
  const normalizedSchoolId = useMemo(() => normalizeSchoolId(rawSchoolId), [rawSchoolId]);
  const [schoolDocId, setSchoolDocId] = useState(rawSchoolId);
  const [selectedPlanId, setSelectedPlanId] = useState(school?.selectedPlanId || "quarterly");
  const [schoolName, setSchoolName] = useState(school?.schoolName || "School");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedPlan = useMemo(() => getDefaultSchoolPlan(selectedPlanId), [selectedPlanId]);

  useEffect(() => {
    const loadSchool = async () => {
      if (!rawSchoolId && !normalizedSchoolId) return;
      try {
        let snap = rawSchoolId ? await getDoc(doc(db, "schools", rawSchoolId)) : null;
        let resolvedDocId = rawSchoolId;
        if ((!snap || !snap.exists()) && normalizedSchoolId) {
          snap = await getDoc(doc(db, "schools", normalizedSchoolId));
          resolvedDocId = normalizedSchoolId;
        }
        if (!snap.exists()) return;
        const data = snap.data();
        setSchoolDocId(resolvedDocId);
        setSchoolName(data.schoolName || school?.schoolName || "School");
        setSelectedPlanId(data.selectedPlanId || school?.selectedPlanId || "quarterly");
      } catch (err) {
        setError(err.message || "Unable to load plan settings.");
      }
    };

    loadSchool();
  }, [rawSchoolId, normalizedSchoolId, school]);

  const handleSave = async () => {
    if (!schoolDocId) {
      setError("School ID is missing. Please log in again.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        selectedPlanId: selectedPlan.id,
        selectedPlanName: selectedPlan.name,
        planAmount: selectedPlan.amount,
        planDurationLabel: selectedPlan.durationLabel,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "schools", schoolDocId), payload, { merge: true });

      const studentsSnap = await getDocs(
        query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId))
      );
      const enrollmentSnap = await getDocs(
        query(collection(db, "defaultSchoolEnrollments"), where("schoolId", "==", normalizedSchoolId))
      );
      const batch = writeBatch(db);
      const updateUnpaidPlan = (ref, data = {}) => {
        const paymentStatus = String(data.paymentStatus || "").toLowerCase();
        const registrationStatus = String(data.registrationStatus || "").toLowerCase();
        const isPaid = data.isPaid === true || paymentStatus === "paid" || registrationStatus === "active";
        if (isPaid) return;

        batch.set(
          ref,
          {
            selectedPlanId: selectedPlan.id,
            selectedPlanName: selectedPlan.name,
            planId: selectedPlan.id,
            planName: selectedPlan.name,
            planAmount: selectedPlan.amount,
            paymentStatus: selectedPlan.amount ? "pending" : "none",
            registrationStatus: selectedPlan.amount ? "pending_payment" : "free",
            paymentLinkId: deleteField(),
            paymentUrl: deleteField(),
            checkoutUrl: deleteField(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      };

      studentsSnap.docs.forEach((studentDoc) => updateUnpaidPlan(studentDoc.ref, studentDoc.data()));
      enrollmentSnap.docs.forEach((enrollmentDoc) => updateUnpaidPlan(enrollmentDoc.ref, enrollmentDoc.data()));
      await batch.commit();

      const currentSchoolData = JSON.parse(localStorage.getItem("schoolData") || "{}");
      const nextSchoolData = {
        ...currentSchoolData,
        ...school,
        ...payload,
        id: school?.schoolDocId || school?.id || currentSchoolData?.schoolDocId || currentSchoolData?.id || schoolDocId,
        schoolDocId: school?.schoolDocId || school?.id || currentSchoolData?.schoolDocId || currentSchoolData?.id || schoolDocId,
        schoolId: rawSchoolId || normalizedSchoolId || schoolDocId,
        schoolName,
      };
      localStorage.setItem("schoolData", JSON.stringify(nextSchoolData));
      onPlanUpdated?.(nextSchoolData);
      setMessage("Plan updated. Unpaid students will receive new payment links for this plan.");
    } catch (err) {
      setError(err.message || "Failed to update plan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="school-plan-settings">
      <div className="school-plan-header">
        <div>
          <p>Student Payment Plan</p>
          <h2>{schoolName}</h2>
        </div>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Plan"}
        </button>
      </div>

      {error && <div className="school-plan-alert error">{error}</div>}
      {message && <div className="school-plan-alert success">{message}</div>}

      <div className="school-plan-grid">
        {SCHOOL_PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <button
              type="button"
              key={plan.id}
              className={`school-plan-card ${isSelected ? "selected" : ""}`}
              onClick={() => {
                setSelectedPlanId(plan.id);
                setMessage("");
                setError("");
              }}
            >
              <span>{plan.name}</span>
              <strong>Rs {plan.amount}</strong>
              <small>{plan.durationLabel}</small>
              <p>{plan.description}</p>
            </button>
          );
        })}
      </div>

      <div className="school-plan-summary">
        <span>Current selection</span>
        <strong>{selectedPlan.name}</strong>
        <p>
          Students who are not paid will be redirected to a Rs {selectedPlan.amount} payment
          link for {selectedPlan.durationLabel}.
        </p>
      </div>
    </section>
  );
}
