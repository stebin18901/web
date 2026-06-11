import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import Navbar from "../components/Navbar";
import { db } from "../firebase/firebaseConfig";
import "./LeaguePage.css";

const pad2 = (n) => String(n).padStart(2, "0");

const toIcsUtc = (date) => {
  const d = new Date(date);
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(
    d.getUTCHours()
  )}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
};

const downloadIcs = ({ title, description, startAt, endAt }) => {
  if (!startAt) return;
  const now = new Date();
  const uid = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}@hepsy`;

  const dtStart = toIcsUtc(startAt);
  const dtEnd = toIcsUtc(endAt || new Date(new Date(startAt).getTime() + 30 * 60 * 1000));

  const safeTitle = String(title || "Contest").replace(/\r?\n/g, " ").trim();
  const safeDesc = String(description || "").replace(/\r?\n/g, "\\n").trim();

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HEPSY//League Contest//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${safeTitle}`,
    safeDesc ? `DESCRIPTION:${safeDesc}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeTitle || "contest"}.ics`.replace(/[\\/:*?"<>|]+/g, "_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const coerceFirestoreDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (date) => {
  if (!date) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getContestStatus = (startAt, endAt) => {
  const now = Date.now();
  const start = startAt ? startAt.getTime() : null;
  const end = endAt ? endAt.getTime() : null;
  if (!start) return { label: "Open", tone: "neutral" };
  if (now < start) return { label: "Upcoming", tone: "info" };
  if (!end || now <= end) return { label: "Live", tone: "success" };
  return { label: "Ended", tone: "muted" };
};

const LeaguePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("workspace");
  const [leagues, setLeagues] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [contestSearch, setContestSearch] = useState("");
  const [leagueDraft, setLeagueDraft] = useState({
    name: "",
    description: "",
    topic: "",
    level: "Intermediate",
    durationMinutes: 30,
    quizIds: [],
    quizAllocations: {}, // quizId -> number of questions
    startDate: "",
    startTime: "09:00",
    endDate: "",
    endTime: "",
  });

  const loadWorkspace = async () => {
    const [leagueSnap, quizSnap] = await Promise.all([
      getDocs(collection(db, "leagueBuilderLeagues")),
      getDocs(collection(db, "leagueBuilderQuizzes")),
    ]);

    const fetchedLeagues = leagueSnap.docs.map((leagueDoc) => ({
      id: leagueDoc.id,
      ...leagueDoc.data(),
    }));
    const fetchedQuizzes = quizSnap.docs.map((quizDoc) => ({
      id: quizDoc.id,
      ...quizDoc.data(),
    }));

    setLeagues(fetchedLeagues);
    setQuizzes(fetchedQuizzes);
  };

  useEffect(() => {
    loadWorkspace().catch((error) => {
      console.error("Failed to load league workspace:", error);
      alert("Unable to load league workspace. Please try again.");
    });
  }, []);

  const quizMap = useMemo(() => {
    return quizzes.reduce((acc, quiz) => {
      acc[quiz.id] = quiz;
      return acc;
    }, {});
  }, [quizzes]);

  const availableContests = useMemo(() => {
    const needle = contestSearch.trim().toLowerCase();
    return leagues
      .filter((league) => {
        if (!needle) return true;
        const haystack = [league.name, league.topic, league.level, league.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .map((league) => {
        const quizIds = Array.isArray(league.quizIds) ? league.quizIds : [];
        const totalQuestions = quizIds.reduce((count, quizId) => {
          const quiz = quizMap[quizId];
          return count + (Array.isArray(quiz?.questions) ? quiz.questions.length : 0);
        }, 0);
        return {
          ...league,
          quizCount: quizIds.length,
          totalQuestions,
        };
      });
  }, [leagues, contestSearch, quizMap]);

  const createLeague = async (event) => {
    event.preventDefault();
    const cleanName = leagueDraft.name.trim();
    if (!cleanName) return;
    if (leagueDraft.quizIds.length === 0) {
      alert("Select at least one quiz for this league.");
      return;
    }

    setIsBusy(true);
    try {
      await addDoc(collection(db, "leagueBuilderLeagues"), {
        name: cleanName,
        description: leagueDraft.description.trim(),
        topic: leagueDraft.topic.trim(),
        level: leagueDraft.level,
        durationMinutes: Number(leagueDraft.durationMinutes) || 0,
        quizIds: [...leagueDraft.quizIds],
        createdAt: serverTimestamp(),
      });

      setLeagueDraft({
        name: "",
        description: "",
        topic: "",
        level: "Intermediate",
        durationMinutes: 30,
        quizIds: [],
      });
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to create league:", error);
      alert("Failed to create league.");
    } finally {
      setIsBusy(false);
    }
  };

  const toggleQuizSelection = (quizId) => {
    setLeagueDraft((prev) => {
      const exists = prev.quizIds.includes(quizId);
      return {
        ...prev,
        quizIds: exists ? prev.quizIds.filter((id) => id !== quizId) : [...prev.quizIds, quizId],
      };
    });
  };

  const deleteLeague = async (leagueId) => {
    setIsBusy(true);
    try {
      await deleteDoc(doc(db, "leagueBuilderLeagues", leagueId));
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to delete league:", error);
      alert("Failed to delete league.");
    } finally {
      setIsBusy(false);
    }
  };

  const deleteQuiz = async (quizId) => {
    setIsBusy(true);
    try {
      const leagueQuery = query(
        collection(db, "leagueBuilderLeagues"),
        where("quizIds", "array-contains", quizId)
      );
      const leagueSnap = await getDocs(leagueQuery);
      await Promise.all(
        leagueSnap.docs.map(async (leagueDoc) => {
          const currentQuizIds = Array.isArray(leagueDoc.data().quizIds)
            ? leagueDoc.data().quizIds
            : [];
          await updateDoc(leagueDoc.ref, {
            quizIds: currentQuizIds.filter((id) => id !== quizId),
          });
        })
      );

      await deleteDoc(doc(db, "leagueBuilderQuizzes", quizId));
      setLeagueDraft((prev) => ({
        ...prev,
        quizIds: prev.quizIds.filter((id) => id !== quizId),
      }));
      await loadWorkspace();
    } catch (error) {
      console.error("Failed to delete quiz:", error);
      alert("Failed to delete quiz.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="league-page">
      <Navbar />

      <main className="league-main">
        <section className="league-hero">
          <h1>League Builder</h1>
          <p>Create quizzes first, then attach selected quizzes while creating a league.</p>
        </section>

        <section className="league-tabs">
          <button
            className={`league-tab ${activeTab === "workspace" ? "active" : ""}`}
            onClick={() => setActiveTab("workspace")}
          >
            Workspace
          </button>
          <button
            className={`league-tab ${activeTab === "later" ? "active" : ""}`}
            onClick={() => setActiveTab("later")}
          >
            Join Contest
          </button>
        </section>

        {activeTab === "workspace" && (
          <div className="league-grid">
            <section className="league-card">
              <div className="league-card-header">
                <h2>Quiz Workspace</h2>
                <span>{quizzes.length} quizzes</span>
              </div>
              <p className="league-empty">
                Build quiz sets with many questions and reuse them across leagues.
              </p>
              <button
                type="button"
                className="league-primary-btn"
                onClick={() => navigate("/league/create-quiz")}
              >
                Create Quiz
              </button>
            </section>

            <section className="league-card">
              <div className="league-card-header">
                <h2>Create League</h2>
                <span>{leagues.length} total</span>
              </div>
              <form className="league-form" onSubmit={createLeague}>
                <label>
                  League Name
                  <input
                    value={leagueDraft.name}
                    onChange={(event) =>
                      setLeagueDraft((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Example: Grade 9 Science Clash"
                    required
                  />
                </label>
                <label>
                  Topic
                  <input
                    value={leagueDraft.topic}
                    onChange={(event) =>
                      setLeagueDraft((prev) => ({ ...prev, topic: event.target.value }))
                    }
                    placeholder="Maths / Physics / Mixed"
                  />
                </label>
                <div className="league-row">
                  <label>
                    Level
                    <select
                      value={leagueDraft.level}
                      onChange={(event) =>
                        setLeagueDraft((prev) => ({ ...prev, level: event.target.value }))
                      }
                    >
                      <option>Beginner</option>
                      <option>Intermediate</option>
                      <option>Advanced</option>
                    </select>
                  </label>
                  <label>
                    Duration (mins)
                    <input
                      type="number"
                      min="1"
                      value={leagueDraft.durationMinutes}
                      onChange={(event) =>
                        setLeagueDraft((prev) => ({
                          ...prev,
                          durationMinutes: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                <label>
                  Description
                  <textarea
                    value={leagueDraft.description}
                    onChange={(event) =>
                      setLeagueDraft((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="What is this league about?"
                    rows={3}
                  />
                </label>

                <div className="league-type-block">
                  <p className="league-block-title">Attach Quizzes</p>
                  {quizzes.length === 0 ? (
                    <p className="league-empty">No quizzes available. Create one first.</p>
                  ) : (
                    <div className="league-quiz-select-list">
                      {quizzes.map((quiz) => (
                        <label key={quiz.id} className="league-check-item">
                          <input
                            type="checkbox"
                            checked={leagueDraft.quizIds.includes(quiz.id)}
                            onChange={() => toggleQuizSelection(quiz.id)}
                          />
                          <span>
                            {quiz.name} ({Array.isArray(quiz.questions) ? quiz.questions.length : 0} questions)
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="league-primary-btn"
                  disabled={quizzes.length === 0 || isBusy}
                >
                  Create League
                </button>
              </form>
            </section>

            <section className="league-card league-wide">
              <div className="league-card-header">
                <h2>Quizzes Created</h2>
                <span>{quizzes.length}</span>
              </div>
              {quizzes.length === 0 ? (
                <p className="league-empty">No quizzes created yet.</p>
              ) : (
                <div className="league-list">
                  {quizzes.map((quiz) => (
                    <article key={quiz.id} className="league-item">
                      <div className="league-item-main">
                        <div className="league-item-title-row">
                          <h3>{quiz.name}</h3>
                          <span className="league-count-pill">
                            {Array.isArray(quiz.questions) ? quiz.questions.length : 0} questions
                          </span>
                        </div>
                        <p>{quiz.description || "No description added."}</p>
                      </div>
                      <div className="league-item-actions">
                        <button
                          className="league-secondary-btn"
                          onClick={() => navigate(`/league/create-quiz/${quiz.id}`)}
                          disabled={isBusy}
                        >
                          Edit
                        </button>
                        <button
                          className="league-danger-btn"
                          onClick={() => deleteQuiz(quiz.id)}
                          disabled={isBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="league-card league-wide">
              <div className="league-card-header">
                <h2>Leagues Created</h2>
                <span>{leagues.length}</span>
              </div>
              {leagues.length === 0 ? (
                <p className="league-empty">No leagues created yet.</p>
              ) : (
                <div className="league-list">
                  {leagues.map((league) => (
                    <article key={league.id} className="league-item">
                      <div className="league-item-main">
                        <div className="league-item-title-row">
                          <h3>{league.name}</h3>
                          <span className="league-count-pill">
                            {Array.isArray(league.quizIds) ? league.quizIds.length : 0} quizzes
                          </span>
                        </div>
                        <p>{league.description || "No description added yet."}</p>
                        <div className="league-meta-row">
                          <span>{league.topic || "General"}</span>
                          <span>{league.level}</span>
                          <span>{league.durationMinutes} mins</span>
                        </div>
                        <div className="league-meta-row">
                          {(Array.isArray(league.quizIds) ? league.quizIds : []).map((quizId) => (
                            <span key={quizId}>{quizMap[quizId]?.name || "Removed quiz"}</span>
                          ))}
                        </div>
                      </div>
                      <button
                        className="league-danger-btn"
                        onClick={() => deleteLeague(league.id)}
                        disabled={isBusy}
                      >
                        Delete
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "later" && (
          <section className="league-card league-later">
            <div className="league-card-header">
              <h2>Join Contest</h2>
              <span>{availableContests.length} available</span>
            </div>

            <div className="league-contest-toolbar">
              <input
                type="text"
                value={contestSearch}
                onChange={(event) => setContestSearch(event.target.value)}
                placeholder="Search contests by name, topic, level..."
              />
            </div>

            {availableContests.length === 0 ? (
              <p className="league-empty">No contests available right now.</p>
            ) : (
              <div className="league-contest-grid">
                {availableContests.map((contest) => (
                  <article key={contest.id} className="league-contest-card">
                    <div className="league-item-title-row">
                      <h3>{contest.name}</h3>
                      <span className="league-count-pill">{contest.level || "Open"}</span>
                    </div>
                    <p>{contest.description || "Challenge yourself and join this contest."}</p>
                    <div className="league-meta-row">
                      <span>{contest.topic || "General"}</span>
                      <span>{contest.durationMinutes || 0} mins</span>
                      <span>{contest.quizCount} quizzes</span>
                      <span>{contest.totalQuestions} questions</span>
                    </div>
                    <button
                      type="button"
                      className="league-primary-btn"
                      onClick={() => alert(`Contest joined: ${contest.name}`)}
                    >
                      Join Contest
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};

export default LeaguePage;
