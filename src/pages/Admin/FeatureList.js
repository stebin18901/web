import React from 'react';
import LoadingSpinner from '../UI/LoadingSpinner';

const FeatureList = ({ features, onEdit, onDelete, currentEditId, isLoading }) => {
  if (features.length === 0) {
    return <div className="empty-state">No features found</div>;
  }

  return (
    <div className="feature-list">
      {features.map(feature => (
        <div 
          key={feature.id}
          className={`feature-card ${currentEditId === feature.id ? 'editing' : ''}`}
        >
          <div className="feature-header">
            <h3 style={{ color: feature.color || '#4a6bff' }}>{feature.title}</h3>
            <span className="feature-date">
              {new Date(feature.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          <div className="feature-content">
            {feature.image && (
              <div className="feature-image">
                <img src={feature.image} alt={feature.title} />
              </div>
            )}
            <p className="feature-description">{feature.description}</p>
          </div>

          <div className="feature-actions">
            <button
              onClick={() => onEdit(feature)}
              disabled={isLoading}
              className="edit-btn"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(feature.id, feature.image)}
              disabled={isLoading}
              className="delete-btn"
            >
              Delete
            </button>
          </div>
        </div>
      ))}

      <style jsx>{`
        .feature-list {
          display: grid;
          gap: 1rem;
        }
        .feature-card {
          border: 1px solid #eee;
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.2s;
        }
        .feature-card.editing {
          border-color: #4a6bff;
          background-color: #f5f8ff;
        }
        .feature-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        .feature-date {
          color: #999;
          font-size: 0.8rem;
        }
        .feature-content {
          display: grid;
          grid-template-columns: 100px 1fr;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }
        .feature-image img {
          width: 100%;
          height: 80px;
          object-fit: cover;
          border-radius: 4px;
        }
        .feature-description {
          margin: 0;
          color: #666;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .feature-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        .edit-btn {
          background: #4a6bff;
          color: white;
        }
        .delete-btn {
          background: #ff6b6b;
          color: white;
        }
        .empty-state {
          text-align: center;
          padding: 2rem;
          color: #999;
        }
      `}</style>
    </div>
  );
};

export default FeatureList;