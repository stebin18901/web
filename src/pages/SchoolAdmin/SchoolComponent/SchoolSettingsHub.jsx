import React from "react";
import {
  CalendarRange,
  CheckCircle2,
  Settings2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import AcademicYearBar from "./AcademicYearBar";
import SchoolPlanSettings from "./SchoolPlanSettings";
import RolePermissionsManager from "./RolePermissionsManager";
import "./SchoolSettingsHub.css";

const normalize = (value) => String(value || "").trim();

const SettingInfoCard = ({ icon: Icon, label, value, tone = "blue" }) => (
  <article className={`school-settings-info-card tone-${tone}`}>
    <div className="school-settings-info-icon">
      <Icon size={18} />
    </div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </article>
);

export default function SchoolSettingsHub({
  school,
  schoolId,
  schoolName = "",
  activeAcademicYear,
  onAcademicYearChange,
  onPlanUpdated,
}) {
  const schoolLabel = normalize(schoolName || school?.schoolName || "School Admin");
  const normalizedSchoolId = normalize(schoolId || school?.schoolId || "-");
  const selectedPlanName = normalize(school?.selectedPlanName || school?.selectedPlanId || "Quarterly");

  return (
    <div className="school-settings-page">
      <section className="school-settings-hero">
        <div className="school-settings-hero-copy">
          <p className="school-settings-kicker">Settings Workspace</p>
          <h1>Configure the school-admin system from one place</h1>
          <p>
            Manage academic year workspaces, payment plan rules, public intake links, and core admin setup without
            hopping between screens.
          </p>
        </div>

        <div className="school-settings-hero-card">
          <div className="school-settings-school-mark">
            <Settings2 size={20} />
          </div>
          <div>
            <strong>{schoolLabel}</strong>
            <span>School ID: {normalizedSchoolId}</span>
          </div>
        </div>
      </section>

      <section className="school-settings-info-grid">
        <SettingInfoCard icon={CalendarRange} label="Active Year" value={activeAcademicYear || "Not selected"} tone="blue" />
        <SettingInfoCard icon={WalletCards} label="Payment Plan" value={selectedPlanName} tone="green" />
        <SettingInfoCard icon={Settings2} label="Dashboard Tools" value="Links on dashboard" tone="amber" />
        <SettingInfoCard icon={ShieldCheck} label="Records Mode" value="Year scoped" tone="slate" />
      </section>

      <section className="school-settings-grid">
        <article className="school-settings-panel school-settings-panel-wide">
          <div className="school-settings-panel-head">
            <div>
              <p>Academic Year Setup</p>
              <h2>Workspace and transfer rules</h2>
            </div>
            <span className="school-settings-chip">Central control</span>
          </div>
          <AcademicYearBar
            schoolId={schoolId}
            schoolName={schoolLabel}
            activeAcademicYear={activeAcademicYear}
            onAcademicYearChange={onAcademicYearChange}
          />
          <div className="school-settings-note-list">
            <div className="school-settings-note-item">
              <CheckCircle2 size={16} />
              <span>Attendance, marks, reports, classes, fee rows, and announcements now follow the selected year.</span>
            </div>
            <div className="school-settings-note-item">
              <CheckCircle2 size={16} />
              <span>When creating a new year, you can copy only the base data you need instead of rebuilding from zero.</span>
            </div>
          </div>
        </article>

        <article className="school-settings-panel">
          <div className="school-settings-panel-head">
            <div>
              <p>Dashboard Access</p>
              <h2>Share links moved</h2>
            </div>
            <span className="school-settings-chip subtle">Updated flow</span>
          </div>
          <div className="school-settings-logic-list">
            <div>
              <strong>Teacher form link</strong>
              <p>Open the school-admin dashboard home screen and use the top-right Teacher Form card.</p>
            </div>
            <div>
              <strong>Student form link</strong>
              <p>Open the school-admin dashboard home screen and use the top-right Student Form card.</p>
            </div>
          </div>
        </article>

        <article className="school-settings-panel school-settings-panel-wide">
          <div className="school-settings-panel-head">
            <div>
              <p>Fee and Plan Configuration</p>
              <h2>Student payment plan</h2>
            </div>
            <span className="school-settings-chip success">Admin config</span>
          </div>
          <SchoolPlanSettings school={school} schoolId={schoolId} onPlanUpdated={onPlanUpdated} />
        </article>

        <article className="school-settings-panel school-settings-panel-wide">
          <RolePermissionsManager
            schoolId={schoolId}
            schoolName={schoolLabel}
            academicYear={activeAcademicYear}
          />
        </article>

        <article className="school-settings-panel">
          <div className="school-settings-panel-head">
            <div>
              <p>Admin Logic</p>
              <h2>How this setup works</h2>
            </div>
            <span className="school-settings-chip subtle">Reference</span>
          </div>
          <div className="school-settings-logic-list">
            <div>
              <strong>1. Switch year first</strong>
              <p>Every new admin record you save follows the currently active academic year workspace.</p>
            </div>
            <div>
              <strong>2. Copy only base data</strong>
              <p>When opening a new year, transfer student registration, classes, teachers, and fee setup only if needed.</p>
            </div>
            <div>
              <strong>3. Keep operations separated</strong>
              <p>Marks, attendance, announcements, and reports remain independent between years to avoid accidental overlap.</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
