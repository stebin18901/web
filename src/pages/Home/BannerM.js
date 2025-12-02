import React from 'react';
import { Link } from 'react-router-dom';
import './BannerM.css';

const BannerM = () => {
  const bannerImage = '/images/13.webp';

  return (
    <div className="banner-container1">
      <div className="banner-text-container">
        <h1 className="banner-title1">
          What We Are?
        </h1>
        <p className="banner-subtitle1">
          Hepsy Enterprise empowers students through interactive learning, fostering innovation, leadership, entrepreneurship, and holistic personal growth.
        </p>
        <div className="button-container1">
          <Link to="/about" className="banner-button1 secondary">Learn More</Link>
          <button className="banner-button1 primary">Watch Demo</button>
        </div>
      </div>
      <div className="banner-image-container1">
        <img src={bannerImage} alt="Responsive Banner" className="banner-image1" />
      </div>
    </div>
  );
};

export default BannerM;