import React from "react";
import { Navigate } from "react-router-dom";
import { useTeacherAuth } from "../../context/TeacherAuthContext";

const TeacherProtect = ({ element }) => {
  const { teacher, loading } = useTeacherAuth();

  if (loading) return <div>Loading...</div>;
  if (!teacher) return <Navigate to="/teacher-login" replace />;

  return element;
};

export default TeacherProtect;
