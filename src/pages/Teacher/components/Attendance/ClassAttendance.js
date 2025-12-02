import React, { useState } from "react";

const ClassAttendance = () => {
  const [attendance, setAttendance] = useState([]);
  return (
    <div className="class-attendance">
      <h2 className="gradient-text">Class Attendance</h2>
      <p>Mark daily attendance for your class here.</p>
    </div>
  );
};

export default ClassAttendance;
