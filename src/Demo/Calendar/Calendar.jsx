import React, { useState } from "react";
import "./Calendar.css";
import { calendarEvents } from "../data/dummyData";

export default function Calendar() {
  const [events, setEvents] = useState(calendarEvents);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);

  const [newEvent, setNewEvent] = useState({
    title: "",
    date: "",
    description: "",
    category: "General",
  });

  const categories = {
    Holiday: "#00b894",
    Exam: "#d63031",
    "Parent Meeting": "#fdcb6e",
    Competition: "#6c5ce7",
    Academic: "#0984e3",
    General: "#b2bec3",
  };

  // Calendar Data
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const calendarCells = [];
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  for (let i = 0; i < offset; i++) calendarCells.push(null);
  for (let day = 1; day <= daysInMonth; day++)
    calendarCells.push(new Date(year, month, day));

  const getEventsForDay = (date) => {
    const d = date.toISOString().split("T")[0];
    return events.filter((e) => e.date === d);
  };

  const handleAddEvent = () => {
    if (!newEvent.title || !newEvent.date) {
      alert("Enter title and date");
      return;
    }
    const newObj = {
      id: "E" + (events.length + 1),
      ...newEvent,
    };
    setEvents([...events, newObj]);
    setShowForm(false);
    setNewEvent({
      title: "",
      date: "",
      description: "",
      category: "General",
    });
  };

  const handleDelete = (id) =>
    window.confirm("Delete this event?") &&
    setEvents(events.filter((e) => e.id !== id));

  return (
    <div className="fifa-wrapper">
      
      {/* TOP TITLE BAR */}
      <div className="fifa-header">
        <h1 className="fifa-title">CALENDAR</h1>
        <div className="fifa-month-nav">
          <button onClick={() => setSelectedDate(new Date(year, month - 1, 1))}>
            ◀
          </button>
          <span>
            {selectedDate.toLocaleString("default", {
              month: "long",
            })}{" "}
            {year}
          </span>
          <button onClick={() => setSelectedDate(new Date(year, month + 1, 1))}>
            ▶
          </button>
        </div>
        <button className="fifa-add-btn" onClick={() => setShowForm(true)}>
          ＋ NEW EVENT
        </button>
      </div>

      {/* BODY */}
      <div className="fifa-body">

        {/* LEFT — GRID */}
        <div className="fifa-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="fifa-day-name">
              {d}
            </div>
          ))}

          {calendarCells.map((date, i) =>
            date === null ? (
              <div key={i} className="fifa-empty"></div>
            ) : (
              <div
                key={i}
                className="fifa-cell"
                onClick={() => setSelectedDate(date)}
              >
                <div className="fifa-date-number">
                  {date.getDate()}
                </div>

                <div className="fifa-mini-events">
                  {getEventsForDay(date).map((ev, idx) => (
                    <div
                      key={idx}
                      className="fifa-mini-dot"
                      style={{
                        background: categories[ev.category],
                      }}
                    ></div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* RIGHT — CARD PANEL */}
        <div className="fifa-card-panel">
          <h2 className="fifa-card-title">
            {selectedDate.toDateString()}
          </h2>

          <div className="fifa-events-list">
            {getEventsForDay(selectedDate).length === 0 ? (
              <p className="fifa-no-events">No events today</p>
            ) : (
              getEventsForDay(selectedDate).map((event) => (
                <div key={event.id} className="fifa-event-card">
                  <div
                    className="fifa-event-bar"
                    style={{ background: categories[event.category] }}
                  ></div>

                  <div className="fifa-event-content">
                    <h3>{event.title}</h3>
                    <small>{event.category}</small>
                    <p>{event.description}</p>
                  </div>

                  <button
                    className="fifa-delete"
                    onClick={() => handleDelete(event.id)}
                  >
                    ✖
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* EVENT FORM */}
      {showForm && (
        <div className="fifa-form-overlay">
          <div className="fifa-form">
            <h2>Add Event</h2>

            <input
              placeholder="Title"
              value={newEvent.title}
              onChange={(e) =>
                setNewEvent({ ...newEvent, title: e.target.value })
              }
            />

            <input
              type="date"
              value={newEvent.date}
              onChange={(e) =>
                setNewEvent({ ...newEvent, date: e.target.value })
              }
            />

            <select
              value={newEvent.category}
              onChange={(e) =>
                setNewEvent({ ...newEvent, category: e.target.value })
              }
            >
              {Object.keys(categories).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <textarea
              rows="3"
              placeholder="Description"
              value={newEvent.description}
              onChange={(e) =>
                setNewEvent({ ...newEvent, description: e.target.value })
              }
            ></textarea>

            <div className="fifa-form-buttons">
              <button className="save" onClick={handleAddEvent}>
                Save
              </button>
              <button className="cancel" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
