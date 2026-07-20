import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Home,
  LogIn,
  LogOut,
  Trophy,
} from "lucide-react";
import "./Navbar.css";

const SIDEBAR_STORAGE_KEY = "hepsy_sidebar_collapsed";
const HEPSY_LOGO = `${process.env.PUBLIC_URL || ""}/images/logo.webp`;

const Navbar = () => {
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "true") setIsCollapsed(true);
    } catch (error) {
      console.error("Failed to read sidebar state:", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isCollapsed));
    } catch (error) {
      console.error("Failed to persist sidebar state:", error);
    }
    document.documentElement.style.setProperty(
      "--app-sidebar-width",
      isCollapsed ? "84px" : "260px"
    );
  }, [isCollapsed]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  return (
    <>
      <nav className={`navbar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="navbar-header">
          <div className="navbar-title" aria-label="Hepsy">
            <img className="navbar-logo" src={HEPSY_LOGO} alt="Hepsy logo" />
            <span className="navbar-title-full">HEPSY</span>
          </div>

          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
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
              title="Home"
              className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
              onClick={closeMenu}
            >
              <Home size={18} className="nav-icon" />
              <span className="link-label">Home</span>
            </NavLink>
            {user && (
              <>
                <NavLink
                  to="/dashboard"
                  end
                  title="ExamFocus"
                  className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
                  onClick={closeMenu}
                >
                  <BookOpenCheck size={18} className="nav-icon" />
                  <span className="link-label">ExamFocus</span>
                </NavLink>
                <NavLink
                  to="/league"
                  title="League"
                  className={({ isActive }) => `navbar-link ${isActive ? "active" : ""}`}
                  onClick={closeMenu}
                >
                  <Trophy size={18} className="nav-icon" />
                  <span className="link-label">League</span>
                </NavLink>
              </>
            )}
          </div>
          {user ? (
            <button
              onClick={() => {
                logout();
                closeMenu();
              }}
              title="Logout"
              className="navbar-button logout"
            >
              <LogOut size={18} className="nav-icon" />
              <span className="link-label">Logout</span>
            </button>
          ) : (
            <NavLink
              to="/login"
              title="Login"
              className={({ isActive }) => `navbar-button login ${isActive ? "active" : ""}`}
              onClick={closeMenu}
            >
              <LogIn size={18} className="nav-icon" />
              <span className="link-label">Login</span>
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
