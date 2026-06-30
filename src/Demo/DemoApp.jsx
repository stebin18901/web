import React, { useState } from "react";
import {
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LogOut,
  Home,
  Users,
  UserPlus,
  Award,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  FileText,
  DollarSign,
  Mail,
  ClipboardList,
} from "lucide-react";
import Dashboard from "./Dashboard/Dashboard";
import Students from "./Students/Students";
import Leads from "./Leads/Leads";
import Teachers from "./Teachers/Teachers";
import Classes from "./Classes/Classes";
import Communication from "./Communication/Communication";
import Fees from "./Fees/Fees";
import Reports from "./Reports/Reports";
import Calendar from "./Calendar/Calendar";
import Settings from "./Settings/Settings";

export default function DemoApp() {
  const [active, setActive] = useState("dashboard");
  const [isOpen, setIsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const links = [
    { name: "Dashboard", key: "dashboard", icon: Home },
    { name: "Students", key: "students", icon: Users },
    { name: "Leads", key: "leads", icon: UserPlus },
    { name: "Teachers", key: "teachers", icon: Award },
    { name: "Classes", key: "classes", icon: ClipboardList },
    { name: "Communication", key: "communication", icon: Mail },
    { name: "Fees", key: "fees", icon: DollarSign },
    { name: "Reports", key: "reports", icon: FileText },
    { name: "Calendar", key: "calendar", icon: CalendarIcon },
    { name: "Settings", key: "settings", icon: SettingsIcon },
  ];

  const render = () => {
    switch (active) {
      case "dashboard":
        return <Dashboard />;
      case "students":
        return <Students />;
      case "leads":
        return <Leads />;
      case "teachers":
        return <Teachers />;
      case "classes":
        return <Classes />;
      case "communication":
        return <Communication />;
      case "fees":
        return <Fees />;
      case "reports":
        return <Reports />;
      case "calendar":
        return <Calendar />;
      case "settings":
        return <Settings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={`demo-app ${collapsed ? "collapsed" : ""}`}>
      {/* Inject demo styles for single-file demo (move to CSS file in prod) */}
      <style>{demoStyles}</style>

      {/* Mobile toggle */}
      <button
        className="sa-sidebar-toggle"
        onClick={() => setIsOpen((s) => !s)}
        aria-label="Toggle Sidebar"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Sidebar */}
      <aside className={`sa-sidebar ${isOpen ? "open" : ""} ${collapsed ? "collapsed" : ""}`}>
        <div className="sa-sidebar-logo">
          <div className="sa-logo-icon">
            <GraduationCap size={20} />
          </div>
          <div className="sa-logo-text">
            <h5>School CRM Demo</h5>
            <small>DEN CRM — Simple & fast</small>
          </div>
        </div>

        <nav className="sa-sidebar-nav">
          {links.map(({ name, key, icon: Icon }) => (
            <button
              key={key}
              className={`sa-sidebar-link ${active === key ? "active" : ""}`}
              onClick={() => {
                setActive(key);
                setIsOpen(false);
              }}
              title={collapsed ? name : ""}
            >
              <div className="sa-icon-wrap">
                <Icon size={18} strokeWidth={2} />
              </div>
              <span className="sa-link-text">{name}</span>
            </button>
          ))}
        </nav>

        <div className="sa-sidebar-footer">
          <button
            className="sa-sidebar-link logout"
            onClick={() => alert("Logging out")}
          >
            <div className="sa-icon-wrap">
              <LogOut size={18} strokeWidth={2} />
            </div>
            <span className="sa-link-text">Logout</span>
          </button>
        </div>
      </aside>

      {/* Floating collapse button */}
      <button
        className={`sa-collapse-floating ${collapsed ? "collapsed" : ""}`}
        onClick={() => setCollapsed((s) => !s)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>

      {/* Overlay for mobile */}
      {isOpen && <div className="sa-sidebar-overlay" onClick={() => setIsOpen(false)} />}

      {/* Main content area */}
      <main className="demo-main">
        <header className="demo-topbar">
          <div className="top-left">
            <h3>{links.find((l) => l.key === active)?.name}</h3>
          </div>
          <div className="top-right">
            <button className="ghost">New</button>
            <div className="profile">S</div>
          </div>
        </header>

        <section className="demo-content">{render()}</section>
      </main>
    </div>
  );
}

/* ----- Demo CSS (copied + adapted from your Sidebar.css + layout styles) ----- */
const demoStyles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
:root { --sidebar-width: 270px; --sidebar-collapsed: 76px; }
*{box-sizing:border-box;font-family:Inter, Space Grotesk, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;}
body,html,#root{height:100%;}
.demo-app{display:flex;}

/* Sidebar base (adapted) */
.sa-sidebar{ position:fixed; top:0; left:0; width:var(--sidebar-width); height:100vh; background:rgba(255,255,255,0.92); backdrop-filter:blur(20px); border-right:1px solid rgba(0,0,0,0.05); box-shadow:8px 0 24px rgba(102,126,234,0.08); display:flex; flex-direction:column; justify-content:space-between; transition:width .28s ease; z-index:1000; }
.sa-sidebar.collapsed{ width:var(--sidebar-collapsed); }
.sa-sidebar-logo{ display:flex; align-items:center; gap:12px; padding:18px; border-bottom:1px solid rgba(0,0,0,0.04);} 
.sa-logo-icon{ width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#667eea,#764ba2);display:flex;align-items:center;justify-content:center;color:white }
.sa-logo-text h5{margin:0;font-size:1rem}
.sa-logo-text small{display:block;color:#6b7280;font-size:0.75rem}

.sa-sidebar-nav{ flex:1;padding:10px 6px; overflow-y:auto; }
.sa-sidebar-link{ display:flex; align-items:center; gap:12px; padding:8px 12px; margin:6px 4px; color:#374151; text-decoration:none; border-radius:10px; transition:background .15s ease; min-height:44px; background:transparent; border:none; width:calc(100% - 8px); text-align:left; }
.sa-sidebar-link:hover{ background: rgba(102,126,234,0.06); cursor:pointer }
.sa-sidebar-link.active{ background:linear-gradient(135deg,#667eea,#764ba2); color:white; box-shadow:0 6px 20px rgba(118,75,162,0.12); }
.sa-icon-wrap{ width:36px;height:36px;min-width:36px;display:flex;align-items:center;justify-content:center;border-radius:8px }
.sa-sidebar.collapsed .sa-logo-text, .sa-sidebar.collapsed .sa-link-text{ display:none !important }
.sa-sidebar.collapsed .sa-sidebar-link{ justify-content:center !important; padding-left:0 !important; padding-right:0 !important }

.sa-sidebar-footer{ padding:12px;border-top:1px solid rgba(0,0,0,0.04) }
.sa-sidebar-link.logout{ color:#ef4444 }

/* Floating collapse */
.sa-collapse-floating{ position:fixed; top:22px; left:calc(var(--sidebar-width) + -22px); transform:translateX(-50%); background:white;border:1px solid rgba(0,0,0,0.08); box-shadow:0 6px 18px rgba(0,0,0,0.08); border-radius:50%; padding:6px; z-index:1200; cursor:pointer; transition:left .28s ease }
.sa-collapse-floating.collapsed{ left:calc(var(--sidebar-collapsed) + -22px) }

/* Mobile toggle */
.sa-sidebar-toggle{ position:fixed; top:16px; left:16px; background:white;border:none;padding:8px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08); z-index:1500; display:none }
@media (max-width:768px){ .sa-sidebar{ transform:translateX(-100%); } .sa-sidebar.open{ transform:translateX(0); } .sa-sidebar-toggle{ display:block } .sa-collapse-floating{ display:none } }

/* Main content */
.demo-main{ margin-left:var(--sidebar-width); padding:20px; width:calc(100% - var(--sidebar-width)); min-height:100vh; transition:margin-left .28s ease, width .28s ease }
.demo-app.collapsed .demo-main{ margin-left:var(--sidebar-collapsed); width:calc(100% - var(--sidebar-collapsed)) }

.demo-topbar{ display:flex; justify-content:space-between; align-items:center; gap:12px; padding-bottom:12px; border-bottom:1px solid rgba(0,0,0,0.04) }
.demo-topbar h3{ margin:0 }
.top-right{ display:flex; align-items:center; gap:12px }
.ghost{ background:transparent; border:1px solid rgba(0,0,0,0.06); padding:8px 10px; border-radius:8px }
.profile{ width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2); display:flex;align-items:center;justify-content:center;color:white }

.demo-content{ padding:18px }
.placeholder{ background:linear-gradient(180deg, #fff, #fbfbff); padding:20px; border-radius:12px; box-shadow:0 6px 18px rgba(16,24,40,0.04) }
.placeholder-grid{ display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-top:14px }
.card{ background:white;border-radius:10px;padding:14px; box-shadow:0 6px 16px rgba(99,102,241,0.06); min-height:80px; display:flex; align-items:center; justify-content:center }

.sa-sidebar-overlay{ position:fixed; inset:0; background:rgba(0,0,0,0.2); z-index:900 }
`;
