// src/pages/SchoolAdmin/SchoolComponent/Sidebar.js
import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Link2,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar({
  onLogout,
  sidebarTitle = "School Admin",
  sidebarLogo = null,
  links = [],
  commonFormLink = "",
  teacherFormLink = "",
  onCollapseChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState({ text: "", x: 0, y: 0, visible: false });
  const [copyMessage, setCopyMessage] = useState("");

  const showTooltip = (e, text) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      text,
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
      visible: true,
    });
  };

  const hideTooltip = () => setTooltip({ ...tooltip, visible: false });

  const handleCopyLink = async (value, label) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(`${label} copied`);
      setTimeout(() => setCopyMessage(""), 2000);
      setIsOpen(false);
    } catch {
      setCopyMessage("Unable to copy link");
      setTimeout(() => setCopyMessage(""), 2000);
    }
  };

  useEffect(() => {
    if (typeof onCollapseChange === "function") {
      onCollapseChange(collapsed);
    }
  }, [collapsed, onCollapseChange]);

  return (
    <>
      {/* === Mobile Toggle === */}
      <button
        className="sa-sidebar-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* === Sidebar === */}
      <aside
        className={`sa-sidebar ${isOpen ? "open" : ""} ${
          collapsed ? "collapsed" : ""
        }`}
      >
        {/* === Logo Section === */}
        <div className="sa-sidebar-logo">
          {sidebarLogo ? (
            <img src={sidebarLogo} alt="logo" className="sa-logo-image" />
          ) : (
            <div className="sa-logo-icon">
              <GraduationCap size={24} />
            </div>
          )}
          <div className="sa-logo-text">
            <h5>{sidebarTitle}</h5>
          </div>
        </div>

        {/* === Navigation === */}
        <nav className="sa-sidebar-nav">
          {links.map(({ name, path, icon: Icon, divider }) =>
            divider ? (
              <div key={`divider-${name || path || Math.random()}`} className="sa-sidebar-divider" aria-hidden="true" />
            ) : (
              <NavLink
                key={name}
                to={path}
                className={({ isActive }) =>
                  `sa-sidebar-link ${isActive ? "active" : ""}`
                }
                onMouseEnter={(e) => showTooltip(e, name)}
                onMouseLeave={hideTooltip}
                onClick={() => setIsOpen(false)}
              >
                <div className="sa-icon-wrap">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <span className="sa-link-text">{name}</span>
              </NavLink>
            )
          )}
        </nav>

        {/* === Footer === */}
        <div className="sa-sidebar-footer">
          {(teacherFormLink || commonFormLink) && (
            <>
              {teacherFormLink ? (
                <div className="sa-form-link-block">
                  <div className="sa-form-link-head">
                    <span>Teacher Form</span>
                  </div>
                  <button
                    className="sa-sidebar-link sa-share-link"
                    onClick={() => handleCopyLink(teacherFormLink, "Teacher form link")}
                    onMouseEnter={(e) => showTooltip(e, "Copy teacher form link")}
                    onMouseLeave={hideTooltip}
                  >
                    <div className="sa-icon-wrap">
                      <Link2 size={20} strokeWidth={2} />
                    </div>
                    <span className="sa-link-text">Copy Teacher Link</span>
                  </button>

                  {!collapsed && (
                    <a
                      href={teacherFormLink}
                      target="_blank"
                      rel="noreferrer"
                      className="sa-common-link-preview"
                    >
                      Open teacher form
                    </a>
                  )}
                </div>
              ) : null}

              {commonFormLink ? (
                <div className="sa-form-link-block">
                  <div className="sa-form-link-head">
                    <span>Student Form</span>
                  </div>
                  <button
                    className="sa-sidebar-link sa-share-link"
                    onClick={() => handleCopyLink(commonFormLink, "Student form link")}
                    onMouseEnter={(e) => showTooltip(e, "Copy student form link")}
                    onMouseLeave={hideTooltip}
                  >
                    <div className="sa-icon-wrap">
                      <Link2 size={20} strokeWidth={2} />
                    </div>
                    <span className="sa-link-text">Copy Student Link</span>
                  </button>

                  {!collapsed && (
                    <a
                      href={commonFormLink}
                      target="_blank"
                      rel="noreferrer"
                      className="sa-common-link-preview"
                    >
                      Open student form
                    </a>
                  )}
                </div>
              ) : null}

              {!collapsed && copyMessage && (
                <p className="sa-common-link-status">{copyMessage}</p>
              )}
            </>
          )}

          <button
            className="sa-sidebar-link logout"
            onClick={onLogout}
            onMouseEnter={(e) => showTooltip(e, "Logout")}
            onMouseLeave={hideTooltip}
          >
            <div className="sa-icon-wrap">
              <LogOut size={20} strokeWidth={2} />
            </div>
            <span className="sa-link-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* === Floating Collapse Button === */}
      <button
        className={`sa-collapse-floating ${collapsed ? "collapsed" : ""}`}
        onClick={() => setCollapsed((s) => !s)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {/* === Tooltip === */}
      {tooltip.visible && collapsed && (
        <div
          className="sa-floating-tooltip"
          style={{
            top: tooltip.y,
            left: tooltip.x,
          }}
        >
          {tooltip.text}
          <span className="sa-tooltip-tail" />
        </div>
      )}

      {isOpen && (
        <div className="sa-sidebar-overlay" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
