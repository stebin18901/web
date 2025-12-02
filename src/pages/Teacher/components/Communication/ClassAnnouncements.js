import React, { useState } from "react";

const ClassAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  return (
    <div className="class-announcements">
      <h2 className="gradient-text">Class Announcements</h2>
      <p>Post important updates and circulars for your students.</p>
    </div>
  );
};

export default ClassAnnouncements;
