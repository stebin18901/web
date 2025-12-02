// Banner.js
import React from 'react';
import PropTypes from 'prop-types';
import './Banner.css'; // Create this CSS file for styling

const Banner = ({ imageUrl, title, description, buttonText, onButtonClick }) => {
  return (
    <div 
      className="banner-container" 
      style={{ backgroundImage: `url(${imageUrl})` }}
    >
      <div className="banner-content">
        <h2 className="banner-title">{title}</h2>
        <p className="banner-description">{description}</p>
        <button 
          className="banner-button" 
          onClick={onButtonClick}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

Banner.propTypes = {
  imageUrl: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  buttonText: PropTypes.string,
  onButtonClick: PropTypes.func,
};

Banner.defaultProps = {
  buttonText: 'On the way',
  onButtonClick: () => console.log('patience 😄!!'),
};

export default Banner;