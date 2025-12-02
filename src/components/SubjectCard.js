// src/components/SubjectCard.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { FaCalculator, FaAtom, FaFlask, FaSeedling, FaGlobeAmericas } from "react-icons/fa"; // Import icons
import "./SubjectCard.css"; // Import the CSS file

// Map subjects to their respective icons
const subjectIcons = {
  Mathematics: <FaCalculator />,
  Physics: <FaAtom />,
  Chemistry: <FaFlask />,
  Biology: <FaSeedling />,
  "Social Science": <FaGlobeAmericas />,
};

const SubjectCard = ({ subject }) => {
  const navigate = useNavigate();

  return (
    <div className="subject-container">
      <div
        className="subject-card"
        onClick={() => navigate(`/subject/${subject}`)} // Navigate to subject page
      >
        <h3 className="subject-name">{subject}</h3>
        <div className="subject-icon">{subjectIcons[subject]}</div>
      </div>
    </div>
  );
};

export default SubjectCard;