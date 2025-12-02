import React, { useEffect, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  isToday,
} from "date-fns";
import "./Calendar.css";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

const Calendar = () => {
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  );
  const [activeDayIndex, setActiveDayIndex] = useState(null);
  const [closing, setClosing] = useState(false); // for close animation
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "calendarEvents"), orderBy("date", "asc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const arr = [];
        snap.forEach((doc) => arr.push({ id: doc.id, ...doc.data() }));
        setEvents(arr);
        setLoading(false);
      },
      (err) => {
        console.error("calendar onSnapshot error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const prevWeek = () => setWeekStart((s) => addDays(s, -7));
  const nextWeek = () => setWeekStart((s) => addDays(s, 7));
  const goToday = () =>
    setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const eventsForDay = (day) =>
    events.filter((ev) => {
      const evDate = ev.date?.seconds
        ? new Date(ev.date.seconds * 1000)
        : ev.date
        ? parseISO(ev.date)
        : null;
      return evDate && isSameDay(evDate, day);
    });

  const closePanel = () => {
    setClosing(true);
    setTimeout(() => {
      setActiveDayIndex(null);
      setClosing(false);
    }, 300); // match animation duration
  };

  return (
    <div className="calendar-wrapper">
      {/* Calendar Panel */}
      <div className="calendar-container">
        {/* Header */}
        <div className="calendar-header">
          <div className="controls">
            <button className="nav-btn" onClick={prevWeek}>◀</button>
            <button className="today-btn" onClick={goToday}>Today</button>
            <button className="nav-btn" onClick={nextWeek}>▶</button>
          </div>

          <div className="title-block">
            <div className="header-title">CALENDAR</div>
            <div className="header-month">{format(weekStart, "MMM yyyy")}</div>
          </div>
        </div>

        {/* Week Row */}
        <div className="week-row">
          {days.map((day, index) => {
            const dayEvents = eventsForDay(day);
            return (
              <div
                key={index}
                className={`day-card 
                  ${activeDayIndex === index ? "selected-card" : ""} 
                  ${isToday(day) ? "today-card" : ""}`}
                onClick={() => setActiveDayIndex(index)}
              >
                <div className="day-top">
                  <div className="day-name">{format(day, "EEE").toUpperCase()}</div>
                  <div className="day-date">{format(day, "d")}</div>
                </div>

                <div className="day-body">
                  {loading && <div className="muted">Loading…</div>}
                  {!loading && dayEvents.length === 0 && (
                    <div className="muted">No events</div>
                  )}

                  {dayEvents.slice(0, 2).map((ev) => (
                    <div
                      key={ev.id}
                      className={`event-badge ${ev.type === "quiz" ? "quiz" : ""}`}
                    >
                      {ev.imageUrl && (
                        <img src={ev.imageUrl} alt="" className="badge-thumb" />
                      )}
                      <div className="badge-text">
                        <div className="badge-title">{ev.title}</div>
                      </div>
                    </div>
                  ))}

                  {dayEvents.length > 2 && (
                    <div className="more-count">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Event Panel */}
      {activeDayIndex !== null &&
        eventsForDay(days[activeDayIndex]).length > 0 && (
          <div className={`event-panel ${closing ? "closing" : "open"}`}>
            <button className="close-btn" onClick={closePanel}>✖</button>
            <DayPanel
              events={eventsForDay(days[activeDayIndex])}
              day={days[activeDayIndex]}
            />
          </div>
        )}
    </div>
  );
};

// Right Event Panel Component
function DayPanel({ day, events }) {
  return (
    <div>
      <h2 style={{ marginBottom: "15px" }}>{format(day, "EEEE, MMM d")}</h2>
      {events.map((ev) => (
        <div key={ev.id} className="event-row" style={{ marginBottom: "15px" }}>
          {ev.imageUrl && (
            <img src={ev.imageUrl} alt={ev.title} className="event-image" />
          )}
          <div className="event-meta">
            <div className="event-title">{ev.title}</div>
            {ev.subject && <div className="muted small">{ev.subject}</div>}
            <div className="muted small">{ev.time || ""}</div>
            <p className="event-desc">{ev.description}</p>
            {ev.type === "quiz" && ev.quizLink && (
              <a
                className="btn-link"
                href={ev.quizLink}
                target="_blank"
                rel="noreferrer"
              >
                Open Quiz
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Calendar;
