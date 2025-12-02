import React from 'react';
import { FaUserCircle, FaFire, FaFutbol, FaRunning, FaPassport } from 'react-icons/fa'; // Icons
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from 'recharts'; // For radar chart
import './GameProfile.css'
// Sample data for the radar chart
const data = [
  { skill: 'Speed', value: 85 },
  { skill: 'Shooting', value: 90 },
  { skill: 'Passing', value: 80 },
  { skill: 'Dribbling', value: 88 },
  { skill: 'Defense', value: 75 },
  { skill: 'Physical', value: 82 },
];

const GameProfile = () => {
  return (
    <div className="profile-container">
      <div className="profile-header">
        <FaUserCircle className="profile-icon" />
        <div className="profile-details">
          <h1 className="profile-name">John Doe</h1>
          <p className="profile-position">Striker | Overall: 89</p>
        </div>
      </div>

      <div className="overall-rating">
        <div className="rating-label">Overall Rating</div>
        <div className="rating-bar">
          <div className="rating-progress" style={{ width: '89%' }}></div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-item">
          <div className="stat-icon"><FaRunning /></div>
          <div>
            <div className="stat-value">92</div>
            <div className="stat-label">Pace</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon"><FaFutbol /></div>
          <div>
            <div className="stat-value">89</div>
            <div className="stat-label">Shooting</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon"><FaPassport /></div>
          <div>
            <div className="stat-value">85</div>
            <div className="stat-label">Passing</div>
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-icon"><FaFire /></div>
          <div>
            <div className="stat-value">88</div>
            <div className="stat-label">Dribbling</div>
          </div>
        </div>
      </div>

      <div className="graph-container">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart outerRadius={90} data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="skill" />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Skills" dataKey="value" stroke="#ff6b6b" fill="#ff6b6b" fillOpacity={0.6} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GameProfile;