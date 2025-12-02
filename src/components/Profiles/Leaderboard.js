import React from "react";
import { FaLock } from "react-icons/fa"; // Importing the lock icon from react-icons
const Leaderboard = () => {
  // Example leaderboard data
  const leaderboardData = [
    { rank: 1, name: "John Doe", score: 95 },
    { rank: 2, name: "Jane Smith", score: 90 },
    { rank: 3, name: "Alice Johnson", score: 85 },
  ];

  return (
    <div className="leaderboard-container">
      <h1 className="leaderboard-title">
        <FaLock /> Leaderboard
      </h1>
      <p className="leaderboard-notice">
        The leaderboard will be active after the first test.
      </p>
      {/* <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {leaderboardData.map((entry) => (
            <tr key={entry.rank}>
              <td>{entry.rank}</td>
              <td>{entry.name}</td>
              <td>{entry.score}</td>
            </tr>
          ))}
        </tbody>
      </table> */}
    </div>
  );
};

export default Leaderboard;