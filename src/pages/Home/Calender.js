import React, { useState } from 'react';
import './Calender.css';

// A static array of game events.
// The dates are formatted as 'YYYY-MM-DD' for easy lookup.
const rawEvents = [
  { id: 1, name: "Starlight Chess Tournament", date: "2025-10-26" },
  { id: 2, name: "Cosmic Racers Final", date: "2025-10-30" },
  { id: 3, name: "Mythic Saga RPG Livestream", date: "2025-11-05" },
  { id: 4, name: "Interstellar Warzone: Season 3 Kickoff", date: "2025-11-12" },
  { id: 5, name: "Fortress Defense Championship", date: "2025-11-18" },
  { id: 6, name: "Virtual Reality League Finals", date: "2025-11-18" },
  { id: 7, name: "Cyberpunk 2077 Night City Raid", date: "2025-11-25" },
];

// Helper function to get the number of days in a month
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

// Helper function to get the first day of the month (0 for Sunday, 1 for Monday, etc.)
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

const Calendar = () => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [currentDate] = useState(new Date());

  // Prepare events for quick lookup
  const eventsByDay = rawEvents.reduce((acc, event) => {
    const day = new Date(event.date).getDate();
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(event);
    return acc;
  }, {});

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed (0 = January)
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Pad the start of the calendar with empty cells for spacing
  const emptyCells = Array.from({ length: firstDay }, (_, i) => null);

  const handleDayClick = (day) => {
    const eventsForDay = eventsByDay[day] || [];
    setSelectedDate(day);
    setSelectedEvents(eventsForDay);
  };

  return (
    <div className="calendar-container">
      <h2 className="calendar-title">Game Calendar</h2>
      <div className="calendar-header">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="day-label">{day}</div>
        ))}
      </div>
      <div className="calendar-grid">
        {emptyCells.map((_, index) => (
          <div key={`empty-${index}`} className="day-cell empty"></div>
        ))}
        {daysArray.map(day => (
          <div
            key={day}
            className={`day-cell ${eventsByDay[day] ? 'has-event' : ''} ${selectedDate === day ? 'selected-day' : ''}`}
            onClick={() => handleDayClick(day)}
          >
            <span>{day}</span>
          </div>
        ))}
      </div>
      {selectedDate && (
        <div className="event-details-dropdown">
          <h3 className="dropdown-title">Events for Day {selectedDate}</h3>
          {selectedEvents.length > 0 ? (
            <ul>
              {selectedEvents.map(event => (
                <li key={event.id} className="event-detail-item">
                  <span className="event-detail-name">{event.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-events-message">No events on this day.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Calendar;

