import React from "react";
import { Link } from "react-router-dom";

const PolicyLayout = ({ title, children }) => {
  return (
    <div style={{
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px",
      fontFamily: "sans-serif",
      lineHeight: "1.6",
      color: "#333",
      minHeight: "80vh"
    }}>
      <Link to="/" style={{ color: "#2563EB", textDecoration: "none", display: "inline-block", marginBottom: "20px" }}>
        &larr; Back to Home
      </Link>
      <h1 style={{ borderBottom: "2px solid #E5E7EB", paddingBottom: "10px", marginBottom: "25px" }}>{title}</h1>
      <div style={{ fontSize: "16px" }}>
        {children}
      </div>
    </div>
  );
};

export default PolicyLayout;