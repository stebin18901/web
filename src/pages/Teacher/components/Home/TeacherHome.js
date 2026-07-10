import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../../../firebase/firebaseConfig";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";

const GAME_CARDS = [
  {
    id: "quiz-league",
    title: "Quiz League",
    badge: "Live Prototype",
    description: "Run school quiz seasons, track team progress, and manage leaderboard moments from one game desk.",
    tone: "violet",
    status: "Setup in progress",
  },
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    badge: "Coming Next",
    description: "A fast classroom challenge format for speed rounds, short bursts, and instant score reveals.",
    tone: "cyan",
    status: "Dummy card",
  },
  {
    id: "treasure-hunt",
    title: "Treasure Hunt",
    badge: "Concept Board",
    description: "A chapter-based mission flow where students unlock clues through practice, hints, and streaks.",
    tone: "amber",
    status: "Dummy card",
  },
  {
    id: "battle-room",
    title: "Battle Room",
    badge: "Planned",
    description: "Head-to-head academic battles for sections or houses with teacher-controlled rounds and rewards.",
    tone: "emerald",
    status: "Dummy card",
  },
];

const TeacherHome = () => {
  const navigate = useNavigate();
  const { teacher } = useTeacherAuth();
  const [stats, setStats] = useState({ classes: 0, subjects: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const isClassTeacher = teacher?.role === "class_teacher";

  useEffect(() => {
    if (!teacher?.schoolId) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", teacher.schoolId));
    const unsub = onSnapshot(q, (snap) => {
      let totalClasses = 0, totalSubjects = 0, totalStudents = 0;
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const team = data.team || [];
        if (isClassTeacher && data.classTeacherEmail === teacher.email) {
          totalClasses++;
          totalStudents += data.totalStudents || 0;
        }
        team.forEach((t) => {
          if (t.email === teacher.email) totalSubjects += t.subjects?.length || 0;
        });
      });
      setStats({ classes: totalClasses, subjects: totalSubjects, students: totalStudents });
      setLoading(false);
    });
    return () => unsub();
  }, [teacher, isClassTeacher]);

  if (loading) return <Loader text="Loading Dashboard..." />;

  return (
    <div className="teacher-home-games">
      <section className="teacher-games-hero">
        <div className="teacher-games-copy">
          <span className="teacher-games-kicker">Teacher Game Hub</span>
          <h2 className="gradient-text">Build classroom games from one clean dashboard.</h2>
          <p>
            This is the starter dummy page for upcoming teacher-managed games. We can plug real creation flows,
            reports, and player activity into these cards next.
          </p>
        </div>
        <div className="teacher-games-stats">
          <article className="teacher-games-stat-card">
            <span>Classes</span>
            <strong>{stats.classes}</strong>
          </article>
          <article className="teacher-games-stat-card">
            <span>{isClassTeacher ? "Students" : "Subjects"}</span>
            <strong>{isClassTeacher ? stats.students : stats.subjects}</strong>
          </article>
          <article className="teacher-games-stat-card">
            <span>Games Listed</span>
            <strong>{GAME_CARDS.length}</strong>
          </article>
        </div>
      </section>

      <section className="teacher-games-board">
        <div className="teacher-games-board-head">
          <div>
            <span className="teacher-games-section-label">Game Cards</span>
            <h3>Choose the experience you want to build next</h3>
          </div>
          <div className="teacher-games-board-note">Dummy cards for now</div>
        </div>

        <div className="teacher-games-grid">
          {GAME_CARDS.map((game, index) => (
            <article
              key={game.id}
              className={`teacher-game-card tone-${game.tone}`}
              style={{ "--card-delay": `${index * 40}ms` }}
            >
              <div className="teacher-game-card-top">
                <span className="teacher-game-badge">{game.badge}</span>
                <span className="teacher-game-status">{game.status}</span>
              </div>
              <h4>{game.title}</h4>
              <p>{game.description}</p>
              <div className="teacher-game-card-footer">
                {game.id === "quiz-league" ? (
                  <button
                    type="button"
                    className="teacher-game-card-btn interactive"
                    onClick={() => navigate("/teacher-dashboard/games/quiz-league")}
                  >
                    Open Game
                  </button>
                ) : (
                  <button type="button" className="teacher-game-card-btn" disabled>
                    Open Soon
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      
      <div className="teacher-games-placeholder-strip">
        <span>Future add-ons</span>
        <strong>Game analytics, launch controls, player invites, and season results will plug in here.</strong>
      </div>
    </div>
  );
};

export default TeacherHome;
