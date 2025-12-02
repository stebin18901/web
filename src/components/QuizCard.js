// src/components/QuizCard.js
import React from "react";

const QuizCard = ({ title, description, imageUrl, googleFormLink }) => {
  return (
    <div className="quiz-card">
      <img src={imageUrl} alt={title} className="quiz-image" />
      <h3>{title}</h3>
      <p>{description}</p>
      <a href={googleFormLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
        Play Now
      </a>
    </div>
  );
};

export default QuizCard;
