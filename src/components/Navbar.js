import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Navbar.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className="navbar">
        <h1 className="navbar-title">HEPSY</h1>
        
        {/* Hamburger menu icon */}
        <button
          className={`hamburger ${isMenuOpen ? "active" : ""}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className="hamburger-box">
            <span className="hamburger-inner"></span>
          </span>
        </button>
        
        {/* Navigation links container */}
        <div className={`navbar-links ${isMenuOpen ? "active" : ""}`}>
          <div className="navbar-link-group">
            <NavLink 
              to="/" 
              className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} 
              onClick={closeMenu}
            >
              Home
            </NavLink>
            {user && (
              <NavLink 
                to="/dashboard" 
                className={({ isActive }) => `navbar-link ${isActive ? 'active' : ''}`} 
                onClick={closeMenu}
              >
                ExamFocus
              </NavLink>
            )}
          </div>
          {user ? (
            <button 
              onClick={() => { logout(); closeMenu(); }} 
              className="navbar-button logout"
            >
              Logout
            </button>
          ) : (
            <NavLink 
              to="/login" 
              className={({ isActive }) => `navbar-button login ${isActive ? 'active' : ''}`} 
              onClick={closeMenu}
            >
              Login
            </NavLink>
          )}
        </div>
      </nav>
      
      <div
        className={`menu-overlay ${isMenuOpen ? "active" : ""}`}
        onClick={closeMenu}
      />
    </>
  );
};

export default Navbar;