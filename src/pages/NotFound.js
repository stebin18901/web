import React from 'react';
import { useNavigate } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <div className="error-code">
          <span className="digit">4</span>
          <span className="digit">0</span>
          <span className="digit">4</span>
        </div>
        
        <h1 className="error-title">Page Not Found</h1>
        
        <p className="error-message">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <button 
          className="home-button"
          onClick={() => navigate('/')}
        >
          <span className="button-text">Return to Safety</span>
          <span className="button-icon">
            <svg viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
          </span>
        </button>
        
        <div className="error-decoration">
          <div className="decoration-line"></div>
          <div className="decoration-dots">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="dot"></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;