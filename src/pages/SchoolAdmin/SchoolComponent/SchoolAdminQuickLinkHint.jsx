import React from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import "./SchoolAdminQuickLinkHint.css";

export default function SchoolAdminQuickLinkHint({ title = "", description = "", links = [] }) {
  const visibleLinks = Array.isArray(links) ? links.filter((entry) => entry?.to && entry?.label) : [];

  if (!title && !description && !visibleLinks.length) return null;

  return (
    <div className="school-admin-quick-hint">
      <div className="school-admin-quick-hint-copy">
        {title ? <strong>{title}</strong> : null}
        {description ? <span>{description}</span> : null}
      </div>
      {visibleLinks.length ? (
        <div className="school-admin-quick-hint-links">
          {visibleLinks.map((entry) => (
            <Link key={`${entry.to}-${entry.label}`} to={entry.to} className="school-admin-quick-hint-link">
              <span>{entry.label}</span>
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
