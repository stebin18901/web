import React, { useState } from "react";
import { School, Palette, Bell, Users, Database, Save } from "lucide-react";

export default function Settings() {
  const [school, setSchool] = useState({
    name: "Springfield Public School",
    tagline: "Empowering Every Learner",
    logo: "",
  });
  const [theme, setTheme] = useState("#6366F1");
  const [roles, setRoles] = useState({
    Admin: true,
    Teacher: true,
    Accountant: false,
    Parent: true,
  });
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    push: true,
  });

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSchool({ ...school, logo: URL.createObjectURL(file) });
    }
  };

  const handleSave = () => {
    alert("✅ Settings saved successfully!");
  };

  return (
    <div className="crm-settings">
      <style>{settingsStyles}</style>

      <h1 className="page-title">⚙️ Settings</h1>
      <p className="page-subtitle">
        Personalize your CRM experience to reflect your school’s identity.
      </p>

      <div className="settings-grid">
        {/* SCHOOL PROFILE */}
        <div className="settings-card">
          <div className="settings-header">
            <School size={20} />
            <h3>School Profile</h3>
          </div>
          <div className="settings-body">
            <label>School Logo</label>
            <div className="logo-upload">
              {school.logo ? (
                <img src={school.logo} alt="Logo" className="logo-preview" />
              ) : (
                <div className="logo-placeholder">Upload</div>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="file-input"
              />
            </div>

            <label>School Name</label>
            <input
              type="text"
              value={school.name}
              onChange={(e) => setSchool({ ...school, name: e.target.value })}
            />

            <label>Tagline / Motto</label>
            <input
              type="text"
              value={school.tagline}
              onChange={(e) => setSchool({ ...school, tagline: e.target.value })}
            />
          </div>
        </div>

        {/* THEME SETTINGS */}
        <div className="settings-card">
          <div className="settings-header">
            <Palette size={20} />
            <h3>Theme Customization</h3>
          </div>
          <div className="settings-body">
            <label>Accent Color</label>
            <input
              type="color"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="color-picker"
            />
            <p className="tip">
              Choose a color that represents your school branding.
            </p>
            <div
              className="color-preview"
              style={{ background: theme }}
            ></div>
          </div>
        </div>

        {/* ROLE MANAGEMENT */}
        <div className="settings-card">
          <div className="settings-header">
            <Users size={20} />
            <h3>Role Management</h3>
          </div>
          <div className="settings-body roles">
            {Object.keys(roles).map((role) => (
              <label key={role} className="toggle">
                <input
                  type="checkbox"
                  checked={roles[role]}
                  onChange={() =>
                    setRoles({ ...roles, [role]: !roles[role] })
                  }
                />
                <span className="slider"></span>
                {role}
              </label>
            ))}
          </div>
        </div>

        {/* NOTIFICATION PREFERENCES */}
        <div className="settings-card">
          <div className="settings-header">
            <Bell size={20} />
            <h3>Notifications</h3>
          </div>
          <div className="settings-body notifications">
            {Object.keys(notifications).map((type) => (
              <label key={type} className="toggle">
                <input
                  type="checkbox"
                  checked={notifications[type]}
                  onChange={() =>
                    setNotifications({
                      ...notifications,
                      [type]: !notifications[type],
                    })
                  }
                />
                <span className="slider"></span>
                {type.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {/* BACKUP SETTINGS */}
        <div className="settings-card">
          <div className="settings-header">
            <Database size={20} />
            <h3>Data Management</h3>
          </div>
          <div className="settings-body backup">
            <p>Keep your school data secure and backed up to the cloud.</p>
            <div className="btn-row">
              <button className="btn primary">☁️ Backup Now</button>
              <button className="btn">⬇️ Restore</button>
            </div>
          </div>
        </div>
      </div>

      {/* SAVE SETTINGS */}
      <div className="save-footer">
        <button className="btn primary" onClick={handleSave}>
          <Save size={16} /> Save All Changes
        </button>
      </div>
    </div>
  );
}

/* --- INLINE STYLE --- */
const settingsStyles = `
.crm-settings {
  font-family: 'Inter', 'Poppins', sans-serif;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 10px 4px 40px;
}

.page-title {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111827;
}

.page-subtitle {
  color: #6b7280;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 24px;
}

.settings-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.04);
  padding: 24px 26px;
  transition: transform 0.25s ease;
}
.settings-card:hover {
  transform: translateY(-3px);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1e293b;
}

.settings-body label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 4px;
}
.settings-body input[type='text'] {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  margin-bottom: 12px;
  transition: border-color 0.2s ease;
}
.settings-body input[type='text']:focus {
  border-color: #6366f1;
  outline: none;
}

/* LOGO UPLOAD */
.logo-upload {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.logo-placeholder, .logo-preview {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  object-fit: cover;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-weight: 500;
  font-size: 0.9rem;
}
.file-input {
  cursor: pointer;
}
.color-picker {
  width: 50px;
  height: 40px;
  border: none;
  cursor: pointer;
}
.color-preview {
  width: 100%;
  height: 6px;
  border-radius: 4px;
  margin-top: 8px;
}

/* TOGGLES */
.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 500;
  font-size: 0.9rem;
  margin-bottom: 10px;
  color: #374151;
  position: relative;
}
.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  width: 36px;
  height: 18px;
  background-color: #d1d5db;
  border-radius: 34px;
  position: relative;
  transition: 0.4s;
}
.slider:before {
  content: "";
  position: absolute;
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.4s;
}
.toggle input:checked + .slider {
  background-color: #6366f1;
}
.toggle input:checked + .slider:before {
  transform: translateX(18px);
}

/* BACKUP */
.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.btn {
  background: #f3f4f6;
  border: none;
  border-radius: 10px;
  padding: 10px 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn.primary {
  background: linear-gradient(135deg, #6366F1, #8B5CF6);
  color: white;
}
.btn:hover {
  opacity: 0.9;
}

/* FOOTER BUTTON */
.save-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
.save-footer button {
  display: flex;
  align-items: center;
  gap: 6px;
}
`;

