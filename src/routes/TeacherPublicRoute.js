// src/routes/TeacherPublicRoute.js
import React from "react";
import { Navigate } from "react-router-dom";
import { useTeacherAuth } from "../context/TeacherAuthContext";

const TeacherPublicRoute = ({ element }) => {
  const { teacher, loading } = useTeacherAuth();

  if (loading) return <div>Loading...</div>;
  if (teacher) return <Navigate to="/teacher-dashboard" replace />;
  return element;
};

export default TeacherPublicRoute;
