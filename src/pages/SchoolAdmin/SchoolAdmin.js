// src/pages/SchoolAdmin/SchoolAdmin.js
import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SchoolLogin from "./SchoolLogin";
import MainPage from "./MainPage";

const SchoolAdmin = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [schoolData, setSchoolData] = useState(null);

  useEffect(() => {
    const savedData = localStorage.getItem("schoolData");
    if (savedData) {
      setSchoolData(JSON.parse(savedData));
      setAuthenticated(true);
    }
  }, []);

  const handleLoginSuccess = (data) => {
    setSchoolData(data);
    setAuthenticated(true);
    localStorage.setItem("schoolData", JSON.stringify(data));
  };

  const handleLogout = () => {
    localStorage.removeItem("schoolData");
    setAuthenticated(false);
    setSchoolData(null);
  };

  if (!authenticated) {
    return <SchoolLogin onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <Routes>
      <Route path="/*" element={<MainPage school={schoolData} onLogout={handleLogout} />} />
    </Routes>
  );
};

export default SchoolAdmin;
