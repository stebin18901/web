import React from "react";
import { collection, doc, getDocs, serverTimestamp, setDoc, query, where } from "firebase/firestore";
import { BriefcaseBusiness, Loader2, Plus, Save, ShieldCheck, UserCog } from "lucide-react";
import { db } from "../../../firebase/firebaseConfig";

const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "teacher", label: "Teacher" },
  { value: "class_teacher", label: "Class Teacher" },
  { value: "accountant", label: "Accountant" },
];

const DEFAULT_PERMISSIONS = {
  admin: {
    manageStudents: true,
    manageAttendance: true,
    finalizeAttendance: true,
    manageMarks: true,
    finalizeMarks: true,
    manageFees: true,
    postReceipts: true,
    sendAnnouncements: true,
    manageSettings: true,
  },
  teacher: {
    manageStudents: false,
    manageAttendance: false,
    finalizeAttendance: false,
    manageMarks: true,
    finalizeMarks: false,
    manageFees: false,
    postReceipts: false,
    sendAnnouncements: false,
    manageSettings: false,
  },
  class_teacher: {
    manageStudents: true,
    manageAttendance: true,
    finalizeAttendance: true,
    manageMarks: true,
    finalizeMarks: false,
    manageFees: false,
    postReceipts: false,
    sendAnnouncements: true,
    manageSettings: false,
  },
  accountant: {
    manageStudents: false,
    manageAttendance: false,
    finalizeAttendance: false,
    manageMarks: false,
    finalizeMarks: false,
    manageFees: true,
    postReceipts: true,
    sendAnnouncements: false,
    manageSettings: false,
  },
};

const PERMISSION_LABELS = [
  ["manageStudents", "Student records"],
  ["manageAttendance", "Attendance entry"],
  ["finalizeAttendance", "Attendance finalize"],
  ["manageMarks", "Marks entry"],
  ["finalizeMarks", "Marks finalize"],
  ["manageFees", "Fee configuration"],
  ["postReceipts", "Receipts and reversals"],
  ["sendAnnouncements", "Announcements"],
  ["manageSettings", "Settings"],
];

const createEmptyDraft = () => ({
  fullName: "",
  email: "",
  phone: "",
  role: "teacher",
  assignedClasses: "",
  notes: "",
  permissions: { ...DEFAULT_PERMISSIONS.teacher },
});

export default function RolePermissionsManager({ schoolId = "", schoolName = "", academicYear = "" }) {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [staffRows, setStaffRows] = React.useState([]);
  const [draft, setDraft] = React.useState(createEmptyDraft());

  const normalizedSchool = React.useMemo(() => normalizeLower(schoolId), [schoolId]);

  React.useEffect(() => {
    const loadRoleAssignments = async () => {
      if (!normalizedSchool) return;
      setLoading(true);
      setStatus("");
      try {
        const [staffSnap, userSnap] = await Promise.all([
          getDocs(collection(db, "schools", normalizedSchool, "roleAssignments")),
          getDocs(query(collection(db, "users"), where("schoolId", "==", normalizedSchool))),
        ]);

        const assignedMap = new Map();
        staffSnap.docs.forEach((entry) => {
          assignedMap.set(entry.id, { id: entry.id, ...entry.data() });
        });

        userSnap.docs.forEach((entry) => {
          const data = entry.data() || {};
          if (!assignedMap.has(entry.id)) {
            const role = normalizeLower(data.role || "teacher");
            assignedMap.set(entry.id, {
              id: entry.id,
              fullName: normalize(data.name || data.fullName),
              email: normalizeLower(data.email),
              phone: normalize(data.phone),
              role,
              assignedClasses: Array.isArray(data.assignedClasses) ? data.assignedClasses : [],
              notes: normalize(data.notes),
              permissions: { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.teacher), ...(data.permissions || {}) },
              source: "user_account",
            });
          }
        });

        setStaffRows(Array.from(assignedMap.values()).sort((left, right) => normalize(left.fullName).localeCompare(normalize(right.fullName))));
      } catch (error) {
        console.error("Unable to load role assignments", error);
        setStatus("Unable to load role assignments right now.");
      } finally {
        setLoading(false);
      }
    };

    loadRoleAssignments();
  }, [normalizedSchool]);

  const handleRoleChange = (role) => {
    setDraft((current) => ({
      ...current,
      role,
      permissions: { ...(DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.teacher) },
    }));
  };

  const handlePermissionToggle = (permissionKey) => {
    setDraft((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [permissionKey]: !current.permissions[permissionKey],
      },
    }));
  };

  const saveAssignment = async () => {
    if (!normalizedSchool) return;
    if (!normalize(draft.fullName) || !normalizeLower(draft.email)) {
      setStatus("Enter at least staff name and email before saving.");
      return;
    }

    setSaving(true);
    setStatus("");
    try {
      const staffId = `${normalizedSchool}_${normalizeLower(draft.email).replace(/[^a-z0-9]+/g, "_")}`;
      const payload = {
        schoolId: normalizedSchool,
        schoolName: normalize(schoolName),
        academicYear: normalize(academicYear),
        fullName: normalize(draft.fullName),
        email: normalizeLower(draft.email),
        phone: normalize(draft.phone),
        role: draft.role,
        assignedClasses: draft.assignedClasses
          .split(",")
          .map((entry) => normalize(entry).toUpperCase())
          .filter(Boolean),
        notes: normalize(draft.notes),
        permissions: draft.permissions,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, "schools", normalizedSchool, "roleAssignments", staffId), payload, { merge: true });

      const matchingUsers = await getDocs(query(collection(db, "users"), where("email", "==", normalizeLower(draft.email))));
      await Promise.all(
        matchingUsers.docs.map((entry) =>
          setDoc(
            doc(db, "users", entry.id),
            {
              schoolId: normalizedSchool,
              schoolName: normalize(schoolName),
              role: draft.role,
              assignedClasses: payload.assignedClasses,
              permissions: draft.permissions,
              notes: payload.notes,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          )
        )
      );

      setStaffRows((current) => {
        const next = current.filter((entry) => entry.id !== staffId);
        next.push({ id: staffId, ...payload });
        return next.sort((left, right) => normalize(left.fullName).localeCompare(normalize(right.fullName)));
      });
      setDraft(createEmptyDraft());
      setStatus("Role assignment saved.");
    } catch (error) {
      console.error("Unable to save role assignment", error);
      setStatus("Unable to save role assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="school-role-manager">
      <div className="school-role-manager-grid">
        <article className="school-role-panel">
          <div className="school-settings-panel-head">
            <div>
              <p>Staff Role Builder</p>
              <h2>Create or assign responsibilities</h2>
            </div>
            <span className="school-settings-chip success">
              <Plus size={14} />
              Controlled access
            </span>
          </div>

          <div className="school-role-form-grid">
            <label>
              <span>Staff name</span>
              <input value={draft.fullName} onChange={(event) => setDraft((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label>
              <span>Email</span>
              <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label>
              <span>Phone</span>
              <input value={draft.phone} onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))} />
            </label>
            <label>
              <span>Role</span>
              <select value={draft.role} onChange={(event) => handleRoleChange(event.target.value)}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              <span>Assigned classes</span>
              <input
                placeholder="10A, 10B"
                value={draft.assignedClasses}
                onChange={(event) => setDraft((current) => ({ ...current, assignedClasses: event.target.value }))}
              />
            </label>
            <label className="wide">
              <span>Notes</span>
              <textarea
                rows="3"
                value={draft.notes}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              />
            </label>
          </div>

          <div className="school-role-permission-grid">
            {PERMISSION_LABELS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`school-role-permission-chip ${draft.permissions[key] ? "active" : ""}`}
                onClick={() => handlePermissionToggle(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="school-role-footer">
            <div className="school-role-hint">
              <ShieldCheck size={15} />
              Save role rules here so attendance, marks, fees, and settings can follow a clear ownership structure.
            </div>
            <button type="button" className="school-role-save" onClick={saveAssignment} disabled={saving}>
              {saving ? <Loader2 size={14} className="school-role-spin" /> : <Save size={14} />}
              {saving ? "Saving..." : "Save Role Assignment"}
            </button>
          </div>
        </article>

        <article className="school-role-panel">
          <div className="school-settings-panel-head">
            <div>
              <p>Assigned Staff</p>
              <h2>Operational responsibility map</h2>
            </div>
            <span className="school-settings-chip subtle">
              <BriefcaseBusiness size={14} />
              {staffRows.length} staff
            </span>
          </div>

          {loading ? (
            <div className="school-role-state">Loading role assignments...</div>
          ) : !staffRows.length ? (
            <div className="school-role-state">No staff roles configured yet.</div>
          ) : (
            <div className="school-role-list">
              {staffRows.map((staff) => (
                <div key={staff.id} className="school-role-card">
                  <div className="school-role-card-head">
                    <div className="school-role-avatar">
                      <UserCog size={16} />
                    </div>
                    <div>
                      <strong>{staff.fullName || "Staff member"}</strong>
                      <span>{staff.email || "-"}</span>
                    </div>
                  </div>
                  <div className="school-role-badges">
                    <span className="school-role-badge">{ROLE_OPTIONS.find((entry) => entry.value === staff.role)?.label || "Teacher"}</span>
                    {(staff.assignedClasses || []).slice(0, 3).map((item) => (
                      <span key={item} className="school-role-badge muted">{item}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {status ? <div className="school-role-status">{status}</div> : null}
        </article>
      </div>
    </div>
  );
}
