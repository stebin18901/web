import React from "react";
import { Link } from "react-router-dom";

const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

const Footer = () => {
  return (
    <footer style={{
      backgroundColor: "#111827",
      color: "#9CA3AF",
      padding: "20px 10px",
      textAlign: "center",
      borderTop: "1px solid #374151",
      fontSize: "14px",
      marginTop: "auto"
    }}>
      <div style={{ marginBottom: "12px" }}>
        <img
          src={HEPSY_LOGO}
          alt="Hepsy logo"
          style={{ width: "72px", height: "72px", objectFit: "contain", marginBottom: "10px" }}
        />
      </div>
      <div style={{ marginBottom: "10px" }}>
        &copy; {new Date().getFullYear()} Hepsy. All rights reserved.
      </div>
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "15px",
        flexWrap: "wrap"
      }}>
        <Link to="/pricing" style={{ color: "#9CA3AF", textDecoration: "none" }}>Pricing</Link>
        <Link to="/terms-and-conditions" style={{ color: "#9CA3AF", textDecoration: "none" }}>Terms & Conditions</Link>
        <Link to="/privacy-policy" style={{ color: "#9CA3AF", textDecoration: "none" }}>Privacy Policy</Link>
        <Link to="/refund-policy" style={{ color: "#9CA3AF", textDecoration: "none" }}>Cancellation & Refund</Link>
        <Link to="/contact" style={{ color: "#9CA3AF", textDecoration: "none" }}>Contact Us</Link>
      </div>
    </footer>
  );
};

export default Footer;
