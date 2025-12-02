import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './QuizResult.css';

const QuizResult = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { score, totalQuestions, subjectName, chapter, concept } = location.state;

  const percentage = Math.round((score / totalQuestions) * 100);

  return (
    <div className="result-container">
      <h2>Quiz Completed!</h2>
      <h3>{subjectName}: {chapter} - {concept}</h3>
      
      <div className="score-card">
        <div className="score-circle">
          <span>{percentage}%</span>
        </div>
        <p>You scored {score} out of {totalQuestions}</p>
      </div>
      
      <div className="result-actions">
        <button 
          onClick={() => navigate('/dashboard')}
          className="home-button"
        >
          Back to Dashboard
        </button>
        <button 
          onClick={() => navigate(-1)} // Go back to concept list
          className="retry-button"
        >
          Try Another Concept
        </button>
      </div>
    </div>
  );
};

export default QuizResult;