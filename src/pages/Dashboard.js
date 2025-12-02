import React, { useState } from "react";
import "./Dashboard.css";
import Subjects from "../components/Subjects";
import Settings from "../components/Settings";
import Navbar from "../components/Navbar";
import Profile from "../components/Profile";
import Leaderboard from "../components/Leaderboard";
import RecentChapters from "./new/RecentChapters";

// Main Dashboard Component with Tabs
const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("subjects");

  return (
    <div className="background">
      <div className="dashboardmain">
      
      <Navbar />
      <div className="dashboard">
      
      
      {/* Tabs */}
      

      {/* Tab Content */}
      <div className="tab-content1">
        <div className="tabs">
        <button
          className={activeTab === "subjects" ? "active" : ""}
          onClick={() => setActiveTab("subjects")}
        >
          Subjects
        </button>
        <button
          className={activeTab === "training" ? "active" : ""}
          onClick={() => setActiveTab("training")}
        >
          Training
        </button>
        <button
          className={activeTab === "leaderb" ? "active" : ""}
          onClick={() => setActiveTab("leaderb")}
        >
          Leader Board
        </button>
        <button
          className={activeTab === "profile" ? "active" : ""}
          onClick={() => setActiveTab("profile")}
        >
          Profile
        </button>
        {/* Uncomment if you need settings
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </button> */}
      </div>
        {activeTab === "subjects" && <Subjects />}
        {activeTab === "training" && <RecentChapters />}
        {activeTab === "profile" && <Profile />}
        {activeTab === "settings" && <Settings />}
        {activeTab === "leaderb" && <Leaderboard />}
      </div>
    </div>
    </div>
    </div>
    
    
  );
};

export default Dashboard;