// components/TopPerformers.js
import React from "react";

export default function TopPerformers({ students = [] }) {
  const top = students.slice(0, 5);
  return (
    <div className="glass-card p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
      {top.length === 0 ? (
        <p className="text-gray-500 text-sm">No data available yet.</p>
      ) : (
        <ul className="space-y-3">
          {top.map((s, i) => (
            <li
              key={i}
              className="flex justify-between items-center bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center font-semibold">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">{s.name}</p>
                  <p className="text-xs text-gray-500">{s.class}</p>
                </div>
              </div>
              <span className="text-indigo-600 font-semibold">{s.score}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
