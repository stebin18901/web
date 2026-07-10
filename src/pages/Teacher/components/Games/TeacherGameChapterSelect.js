import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuiz } from "../../../../context/QuizContext";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";

const normalizeSubjectToken = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

const getQuizTitle = (quiz) =>
  quiz?.title || quiz?.metadata?.chapter || quiz?.quizData?.quizTitle || quiz?.chapter || "Quiz";

const getQuizOrderIndex = (quiz) => Number(quiz?.orderIndex ?? quiz?.quizData?.orderIndex ?? 999999);
const getQuizSubject = (quiz) =>
  String(quiz?.subject || quiz?.metadata?.subject || quiz?.quizData?.subject || "General").trim() || "General";
const getQuizChapter = (quiz) =>
  String(quiz?.chapter || quiz?.metadata?.chapter || quiz?.quizData?.chapter || getQuizTitle(quiz)).trim() || "Untitled Chapter";

const TeacherGameChapterSelect = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const { teacher } = useTeacherAuth();
  const { quizzes, loading } = useQuiz();
  const [activeSubject, setActiveSubject] = useState("all");

  const subjects = useMemo(() => {
    const map = new Map();
    quizzes.forEach((quiz) => {
      const raw = getQuizSubject(quiz);
      const key = normalizeSubjectToken(raw);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: raw,
          total: 0,
          lastTopic: getQuizChapter(quiz),
        });
      }
      const entry = map.get(key);
      entry.total += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [quizzes]);

  const chapters = useMemo(() => {
    const chapterMap = new Map();
    const sortedQuizzes = [...quizzes].sort(
      (a, b) =>
        getQuizOrderIndex(a) - getQuizOrderIndex(b) ||
        getQuizChapter(a).localeCompare(getQuizChapter(b))
    );

    sortedQuizzes.forEach((quiz) => {
      const chapterName = getQuizChapter(quiz);
      const subjectName = getQuizSubject(quiz);
      const chapterKey = `${subjectName.toLowerCase()}__${chapterName.toLowerCase()}`;

      if (!chapterMap.has(chapterKey)) {
        chapterMap.set(chapterKey, {
          chapterKey,
          chapterName,
          subject: subjectName,
          quizIds: [],
          quizCount: 0,
        });
      }

      const entry = chapterMap.get(chapterKey);
      entry.quizIds.push(quiz.id);
      entry.quizCount += 1;
    });

    return Array.from(chapterMap.values()).sort(
      (a, b) => a.subject.localeCompare(b.subject) || a.chapterName.localeCompare(b.chapterName)
    );
  }, [quizzes]);

  const filteredChapters = useMemo(() => {
    if (activeSubject === "all") return chapters;
    return chapters.filter((chapter) => normalizeSubjectToken(chapter.subject) === activeSubject);
  }, [activeSubject, chapters]);

  if (loading) return <Loader text="Loading chapters..." />;

  return (
    <div className="teacher-game-select-page">
      <section className="teacher-game-select-hero">
        <div>
          <span className="teacher-games-kicker">Game Setup</span>
          <h2 className="gradient-text">Choose a chapter for {gameId === "quiz-league" ? "Quiz League" : "the game"}.</h2>
          <p>
            Select a chapter from the same quiz bank used in the student dashboard. After that, we’ll open the live play screen for
            {` ${teacher?.assignedClass || teacher?.assignedClasses?.[0] || "your class"}`}.
          </p>
        </div>
        <div className="teacher-game-select-summary">
          <article>
            <span>Subjects</span>
            <strong>{subjects.length}</strong>
          </article>
          <article>
            <span>Chapters</span>
            <strong>{chapters.length}</strong>
          </article>
          <article>
            <span>Active Class</span>
            <strong>{teacher?.assignedClass || teacher?.assignedClasses?.[0] || "Not set"}</strong>
          </article>
        </div>
      </section>

      <section className="teacher-game-filter-bar">
        <div className="teacher-game-filter-copy">
          <span className="teacher-games-section-label">Filter Chapters</span>
          <h3>Browse by subject</h3>
        </div>
        <div className="teacher-game-filter-pills">
          <button
            type="button"
            className={`teacher-game-filter-pill ${activeSubject === "all" ? "active" : ""}`}
            onClick={() => setActiveSubject("all")}
          >
            All Subjects
          </button>
          {subjects.map((subject) => (
            <button
              key={subject.key}
              type="button"
              className={`teacher-game-filter-pill ${activeSubject === subject.key ? "active" : ""}`}
              onClick={() => setActiveSubject(subject.key)}
            >
              {subject.name}
            </button>
          ))}
        </div>
      </section>

      <section className="teacher-game-chapter-grid">
        {filteredChapters.map((chapter) => (
          <article key={chapter.chapterKey} className="teacher-game-chapter-card">
            <span>{chapter.subject}</span>
            <h3>{chapter.chapterName}</h3>
            <p>{chapter.quizCount} quiz set(s) available for this chapter.</p>
            <button
              type="button"
              className="teacher-game-start-btn"
              onClick={() =>
                navigate(`/teacher-dashboard/games/${gameId}/play`, {
                  state: {
                    chapterName: chapter.chapterName,
                    quizIds: chapter.quizIds,
                    subject: chapter.subject,
                  },
                })
              }
            >
              Start Game
            </button>
          </article>
        ))}
        {filteredChapters.length === 0 ? (
          <div className="teacher-game-empty">
            <h2>No chapters found</h2>
            <button type="button" className="teacher-game-start-btn secondary" onClick={() => setActiveSubject("all")}>
              Clear Filter
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
};

export default TeacherGameChapterSelect;
