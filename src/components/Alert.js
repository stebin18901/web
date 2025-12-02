import React from "react";

const Alert = ({ message, type, onClose }) => {
  if (!message) return null;

  return (
    <div className={`alert ${type}`}>
      <span>{message}</span>
      <button onClick={onClose} className="alert-close">
        &times;
      </button>
    </div>
  );
};

export default Alert;