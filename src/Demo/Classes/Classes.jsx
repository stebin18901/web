import React, { useState } from "react";
import "./Classes.css";
import { classes } from "../data/dummyData";

export default function Classes() {
  const classList = classes || [];

  const [selectedClass, setSelectedClass] = useState(classList[0]);


  // periods (your schedule has only 3 periods per day → expand to 6 realistically)
  const PERIODS = [
    "08:30 - 09:15",
    "09:15 - 10:00",
    "10:00 - 10:45",
    "11:00 - 11:45",
    "12:00 - 12:45",
    "01:30 - 02:15",
  ];

  // build timetable (if day has only 3 subjects, fill the rest as Free/Activity)
  function buildFullDay(dayArray) {
    const filled = [...dayArray];
    while (filled.length < 6) filled.push("Activity / Free Period");
    return filled;
  }

  return (
    <div className="cls-wrapper">

      <h1 className="cls-title">CLASSES & TIMETABLE</h1>

      {/* CLASS CARDS */}
      <div className="cls-cards">
        {classList.map((cls) => (
          <div
            key={cls.id}
            onClick={() => setSelectedClass(cls)}
            className={`cls-card ${
              selectedClass.id === cls.id ? "active" : ""
            }`}
          >
            <div className="cls-stripe"></div>

            <h2>Class {cls.className}</h2>

            <p className="cls-info">
              👥 Strength: <span>{cls.strength}</span>
            </p>

            <p className="cls-info">
              👨‍🏫 Teacher: <span>{cls.teacher}</span>
            </p>
          </div>
        ))}
      </div>

      {/* TIMETABLE SECTION */}
      <h2 className="tt-title">
        Weekly Timetable – Class {selectedClass?.className}
      </h2>

      <div className="tt-card">
        <table className="tt-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Time</th>
              <th>Monday</th>
              <th>Tuesday</th>
              <th>Wednesday</th>
              <th>Thursday</th>
              <th>Friday</th>
            </tr>
          </thead>

          <tbody>
            {PERIODS.map((time, i) => {
              return (
                <tr key={i}>
                  <td className="tt-period">Period {i + 1}</td>
                  <td className="tt-time">{time}</td>

                  {/* Monday */}
                  <td className="tt-cell">
                    {buildFullDay(selectedClass.schedule.Monday)[i]}
                  </td>

                  {/* Tuesday */}
                  <td className="tt-cell">
                    {buildFullDay(selectedClass.schedule.Tuesday)[i]}
                  </td>

                  {/* Wednesday */}
                  <td className="tt-cell">
                    {buildFullDay(selectedClass.schedule.Wednesday)[i]}
                  </td>

                  {/* Thursday */}
                  <td className="tt-cell">
                    {buildFullDay(selectedClass.schedule.Thursday)[i]}
                  </td>

                  {/* Friday */}
                  <td className="tt-cell">
                    {buildFullDay(selectedClass.schedule.Friday)[i]}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
