// src/pages/SchoolAdmin/SchoolComponent/Sidebar.js
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
} from "lucide-react";
import "./Sidebar.css";

export default function Sidebar({
  onLogout,
  sidebarTitle = "School Admin",
  sidebarLogo = null,
  links = [],
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [tooltip, setTooltip] = useState({ text: "", x: 0, y: 0, visible: false });

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
          {links.map(({ name, path, icon: Icon }) => (
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
          ))}
        </nav>

        {/* === Footer === */}
        <div className="sa-sidebar-footer">
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
