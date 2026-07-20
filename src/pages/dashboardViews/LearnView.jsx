import React from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FlaskConical,
  Globe2,
  Landmark,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Swords,
  Target,
  Trophy,
} from "lucide-react";

const journeyCards = [
  {
    id: "engineer",
    badge: "Engineer",
    title: "AIR 1 JEE Advanced Journey",
    accentClass: "learn-card-engineer",
    stats: [
      { label: "Physics", icon: Brain },
      { label: "Chemistry", icon: FlaskConical },
      { label: "Mathematics", icon: Target },
    ],
    meta: [
      { value: "50,000+", label: "Questions" },
      { value: "4 Years", label: "Roadmap" },
    ],
  },
  {
    id: "doctor",
    badge: "Doctor",
    title: "AIR 1 NEET Journey",
    accentClass: "learn-card-doctor",
    stats: [
      { label: "Biology", icon: Stethoscope },
      { label: "Physics", icon: Brain },
      { label: "Chemistry", icon: FlaskConical },
    ],
    meta: [
      { value: "35,000+", label: "Questions" },
      { value: "4 Years", label: "Roadmap" },
    ],
  },
  {
    id: "leader",
    badge: "Leader",
    title: "UPSC Journey",
    accentClass: "learn-card-leader",
    stats: [
      { label: "History", icon: BookOpen },
      { label: "Polity", icon: ShieldCheck },
      { label: "Geography", icon: Globe2 },
    ],
    meta: [
      { value: "20,000+", label: "Questions" },
      { value: "3+ Years", label: "Roadmap" },
    ],
  },
];

const milestones = [
  { label: "Dreamer", level: "Lv. 1", icon: Sparkles },
  { label: "Explorer", level: "Lv. 10", icon: Target },
  { label: "Performer", level: "Lv. 25", icon: Swords },
  { label: "Achiever", level: "Lv. 50", icon: Landmark },
  { label: "Champion", level: "Lv. 100", icon: Trophy },
];

export default function LearnView({
  session,
  studentStats,
  overallProgress,
  onOpenPractice,
}) {
  const currentLevel =
    studentStats.totalQuizzes >= 50
      ? "Achiever"
      : studentStats.totalQuizzes >= 25
      ? "Performer"
      : studentStats.totalQuizzes >= 10
      ? "Explorer"
      : "Beginner";

  const comparisonRows = [
    { name: "JEE Advanced", questions: "50K+", duration: "4 Years", difficulty: 5 },
    { name: "NEET", questions: "35K+", duration: "4 Years", difficulty: 4 },
    { name: "UPSC", questions: "20K+", duration: "3+ Years", difficulty: 5 },
  ];

  return (
    <section className="learn-hub-shell">
      <div className="learn-hub-hero dashboard-glass-card">
        <div className="learn-hub-copy">
          <span className="learn-hub-kicker">Choose Your Dream Journey</span>
          <h2>
            Pick your goal. We&apos;ll show you the path to success.
          </h2>
          <p>
            {session?.name || "Student"}, unlock focused roadmaps, milestone-based
            practice, and one clear direction for the exam path you want to own.
          </p>
          <div className="learn-hub-streak">
            <span />
            <strong>{overallProgress}% momentum active</strong>
          </div>
        </div>
        <div className="learn-hub-illustration" aria-hidden="true">
          <div className="learn-hub-orb learn-hub-orb-a" />
          <div className="learn-hub-orb learn-hub-orb-b" />
          <div className="learn-hub-figure">
            <div className="learn-hub-figure-card learn-hub-figure-book" />
            <div className="learn-hub-figure-card learn-hub-figure-note" />
          </div>
        </div>
      </div>

      <div className="learn-hub-grid">
        <div className="learn-hub-card-grid">
          {journeyCards.map((card) => (
            <article key={card.id} className={`learn-journey-card ${card.accentClass}`}>
              <div className="learn-journey-top">
                <span className="learn-journey-badge">{card.badge}</span>
                <h3>{card.title}</h3>
              </div>

              <div className="learn-journey-visual" aria-hidden="true">
                <div className="learn-journey-visual-glow" />
                <div className="learn-journey-visual-mark" />
              </div>

              <div className="learn-journey-bottom">
                <div className="learn-journey-subjects">
                  {card.stats.map((item) => (
                    <div key={item.label} className="learn-journey-subject">
                      <item.icon size={15} />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="learn-journey-meta">
                  {card.meta.map((item) => (
                    <div key={item.label}>
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <button type="button" className="learn-journey-cta" onClick={onOpenPractice}>
                  <span>Start Journey</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>

        <div className="learn-hub-side">
          <section className="learn-side-card dashboard-glass-card">
            <div className="learn-side-head">
              <span>Your Current Status</span>
            </div>
            <div className="learn-status-list">
              <div className="learn-status-item">
                <Sparkles size={18} />
                <div>
                  <span>Current Level</span>
                  <strong>{currentLevel}</strong>
                </div>
              </div>
              <div className="learn-status-item">
                <BookOpen size={18} />
                <div>
                  <span>Questions Solved</span>
                  <strong>{studentStats.totalQuizzes}</strong>
                </div>
              </div>
              <div className="learn-status-item">
                <Target size={18} />
                <div>
                  <span>Consistency</span>
                  <strong>{Math.max(1, Math.round(overallProgress / 10))} Days</strong>
                </div>
              </div>
              <div className="learn-status-item">
                <Trophy size={18} />
                <div>
                  <span>Predicted Rank</span>
                  <strong>#{studentStats.rank}</strong>
                </div>
              </div>
            </div>
          </section>

          <section className="learn-side-card dashboard-glass-card">
            <div className="learn-side-head">
              <span>Journey Comparison</span>
            </div>
            <div className="learn-comparison-table">
              {comparisonRows.map((row) => (
                <div key={row.name} className="learn-comparison-row">
                  <strong>{row.name}</strong>
                  <span>{row.questions}</span>
                  <span>{row.duration}</span>
                  <span>{"★".repeat(row.difficulty)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="learn-bottom-bar dashboard-glass-card">
        <div className="learn-bottom-copy">
          <div className="learn-bottom-icon">
            <Target size={28} />
          </div>
          <div>
            <strong>One Goal. One Plan. One You.</strong>
            <p>Stay consistent, follow your roadmap, and achieve your dream.</p>
          </div>
        </div>
        <div className="learn-milestones">
          {milestones.map((item, index) => (
            <div key={item.label} className="learn-milestone">
              <div className="learn-milestone-icon">
                <item.icon size={16} />
              </div>
              <strong>{item.label}</strong>
              <span>{item.level}</span>
              {index < milestones.length - 1 ? <div className="learn-milestone-line" /> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
