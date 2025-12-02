import React from "react";

const Loader = ({ text = "Loading..." }) => (
  <div className="loader-container">
    <div className="spinner"></div>
    <p>{text}</p>
  </div>
);

export default Loader;
    