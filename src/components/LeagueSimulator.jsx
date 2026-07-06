import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Crown,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Star,
  Target,
  TimerReset,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./LeagueSimulator.css";

const PROFILE_FALLBACK = `${process.env.PUBLIC_URL || ""}/images/propic.png`;
const STORAGE_PREFIX = "hepsy_fantasy_league_v3";
const LEAGUE_TABS = [
  { key: "overview", label: "Overview" },
  { key: "market", label: "Student Pool" },
  { key: "match", label: "Match Center" },
  { key: "standings", label: "Standings" },
  { key: "timeline", label: "Season Timeline" },
];
const TIMELINE_STEPS = ["Formation", "Practice Lock", "Matchday", "Results"];

const safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toMillis = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  if (typeof value?._seconds === "number") return value._seconds * 1000;
  return 0;
};

const getStorageKey = (session) =>
  `${STORAGE_PREFIX}_${session?.schoolId || "school"}_${session?.id || "guest"}`;

const getSavedState = (session) => {
  if (typeof window === "undefined") {
    return {
      lineupIds: [],
      captainId: "",
      viceCaptainId: "",
      phaseIndex: 0,
      activeTab: "overview",
      classFilter: "all",
      seasonStats: null,
      simulationSummary: null,
      notice: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(session));
    if (!raw) {
      return {
        lineupIds: [],
        captainId: "",
        viceCaptainId: "",
        phaseIndex: 0,
        activeTab: "overview",
        classFilter: "all",
        seasonStats: null,
        simulationSummary: null,
        notice: "",
      };
    }
    const parsed = JSON.parse(raw);
    return {
      lineupIds: Array.isArray(parsed?.lineupIds) ? parsed.lineupIds : [],
      captainId: parsed?.captainId || "",
      viceCaptainId: parsed?.viceCaptainId || "",
      phaseIndex: safeNumber(parsed?.phaseIndex),
      activeTab: parsed?.activeTab || "overview",
      classFilter: parsed?.classFilter || "all",
      seasonStats: parsed?.seasonStats || null,
      simulationSummary: parsed?.simulationSummary || null,
      notice: parsed?.notice || "",
    };
  } catch {
    return {
      lineupIds: [],
      captainId: "",
      viceCaptainId: "",
      phaseIndex: 0,
      activeTab: "overview",
      classFilter: "all",
      seasonStats: null,
      simulationSummary: null,
      notice: "",
    };
  }
};

const readAvatar = (student) =>
  student?.profilePic ||
  student?.profileImage ||
  student?.photoURL ||
  student?.photoUrl ||
  student?.avatar ||
  PROFILE_FALLBACK;

const getInitials = (name = "") =>
  String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "HQ";

const buildStudentMetrics = (student, reports, progressDocs) => {
  const studentReports = reports
    .filter((report) => (report.studentId || report.userId) === student.id)
    .sort((a, b) => toMillis(b.submittedAt || b.createdAt) - toMillis(a.submittedAt || a.createdAt));
  const studentProgress = progressDocs.filter((item) => item.studentId === student.id);

  const attempts = studentReports.length;
  const totalScore = studentReports.reduce((sum, item) => sum + safeNumber(item.score), 0);
  const avgAccuracy = attempts
    ? Math.round(studentReports.reduce((sum, item) => sum + safeNumber(item.percentage), 0) / attempts)
    : 0;
  const fastestSeconds = studentReports.reduce((best, item) => {
    const duration =
      safeNumber(item.avgResponseTime) ||
      safeNumber(item.averageResponseTime) ||
      safeNumber(item.responseTime) ||
      safeNumber(item.durationSeconds);
    if (!duration) return best;
    if (!best) return duration;
    return Math.min(best, duration);
  }, 0);
  const completionCount = studentProgress.filter(
    (item) => item.attemptCompleted || item.noteCompleted || item.completed
  ).length;
  const practiceXp =
    studentProgress.reduce(
      (sum, item) =>
        sum +
        safeNumber(item.xp) +
        safeNumber(item.points) +
        safeNumber(item.totalXp) +
        safeNumber(item.progressPoints),
      0
    ) || completionCount * 20;
  const recentReports = studentReports.slice(0, 5);
  const recentForm = recentReports.length
    ? Math.round(
        recentReports.reduce(
          (sum, item) => sum + safeNumber(item.percentage) + safeNumber(item.score) / 10,
          0
        ) / recentReports.length
      )
    : 0;
  const consistency = Math.min(
    99,
    Math.round(avgAccuracy * 0.58 + Math.min(25, attempts * 2.5) + Math.min(18, completionCount * 1.5))
  );
  const speed = fastestSeconds
    ? Math.max(45, Math.min(98, Math.round(100 - fastestSeconds)))
    : Math.max(50, Math.round(avgAccuracy * 0.72));
  const rating = Math.max(
    60,
    Math.min(
      99,
      Math.round(avgAccuracy * 0.42 + Math.min(totalScore / 8, 26) + Math.min(practiceXp / 24, 18) + Math.min(attempts * 2, 12))
    )
  );
  const fantasyPoints = Math.round(
    avgAccuracy * 3.4 +
      totalScore * 0.7 +
      practiceXp * 0.18 +
      attempts * 14 +
      completionCount * 8 +
      recentForm * 1.4
  );

  return {
    attempts,
    totalScore,
    avgAccuracy,
    fastestSeconds,
    completionCount,
    practiceXp,
    recentForm,
    consistency,
    speed,
    rating,
    fantasyPoints,
  };
};

const PlayerBadge = ({
  player,
  selected,
  locked,
  isCaptain,
  isViceCaptain,
  isCurrentUser,
  onInspect,
  onSelect,
  onViceCaptain,
  showAcquire = true,
}) => (
  <article
    className={`league-student-card ${selected ? "selected" : ""} ${isCaptain ? "captain" : ""}`}
    onClick={() => onInspect(player)}
    role="button"
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onInspect(player);
      }
    }}
  >
    <div className="league-student-card-top">
      <span className="league-rating-badge">{player.rating}</span>
      <span className="league-class-pill">{player.className}</span>
    </div>

    <div className="league-student-avatar-shell">
      <img src={player.avatar} alt={player.name} />
      {isCaptain ? (
        <span className="league-captain-chip">
          <Crown size={14} />
          C
        </span>
      ) : null}
      {isViceCaptain ? (
        <span className="league-vice-captain-chip">
          VC
        </span>
      ) : null}
    </div>

    <div className="league-student-copy">
      <h4>{player.name}</h4>
      <p>{player.schoolName}</p>
    </div>

    <div className="league-student-metrics">
      <div>
        <span>ACC</span>
        <strong>{player.avgAccuracy}%</strong>
      </div>
      <div>
        <span>XP</span>
        <strong>{player.practiceXp}</strong>
      </div>
      <div>
        <span>PTS</span>
        <strong>{player.fantasyPoints}</strong>
      </div>
    </div>

    <div className="league-student-price">
      <span>Projected KP</span>
      <strong>{player.marketValue}</strong>
    </div>

    {showAcquire ? (
      <button
        type="button"
        className="league-acquire-btn"
        onClick={(event) => {
          event.stopPropagation();
          onSelect(player);
        }}
        disabled={locked || isCurrentUser}
      >
        {isCurrentUser ? "Locked In Team" : selected ? "Remove" : "Add To Team"}
      </button>
    ) : null}

    {selected ? (
      <button
        type="button"
        className="league-captain-btn"
        onClick={(event) => {
          event.stopPropagation();
          onViceCaptain(player.id);
        }}
        disabled={isCurrentUser}
      >
        {isCurrentUser ? "You Are Captain" : isViceCaptain ? "Vice Captain Locked" : "Make Vice Captain"}
      </button>
    ) : null}
  </article>
);

export default function LeagueSimulator({ session }) {
  const savedState = useMemo(() => getSavedState(session), [session]);
  const [activeTab, setActiveTab] = useState(savedState.activeTab);
  const [classFilter, setClassFilter] = useState(savedState.classFilter);
  const [lineupIds, setLineupIds] = useState(savedState.lineupIds);
  const [captainId, setCaptainId] = useState(savedState.captainId);
  const [viceCaptainId, setViceCaptainId] = useState(savedState.viceCaptainId);
  const [phaseIndex, setPhaseIndex] = useState(savedState.phaseIndex);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seasonStats, setSeasonStats] = useState(
    savedState.seasonStats || { played: 0, wins: 0, losses: 0, totalPoints: 0 }
  );
  const [simulationSummary, setSimulationSummary] = useState(savedState.simulationSummary);
  const [notice, setNotice] = useState(savedState.notice || "");
  const [insightSlide, setInsightSlide] = useState(0);
  const currentUserId = session?.id || "";

  useEffect(() => {
    const nextSaved = getSavedState(session);
    setActiveTab(nextSaved.activeTab);
    setClassFilter(nextSaved.classFilter);
    setLineupIds(nextSaved.lineupIds);
    setCaptainId(nextSaved.captainId);
    setViceCaptainId(nextSaved.viceCaptainId);
    setPhaseIndex(nextSaved.phaseIndex);
    setSeasonStats(nextSaved.seasonStats || { played: 0, wins: 0, losses: 0, totalPoints: 0 });
    setSimulationSummary(nextSaved.simulationSummary || null);
    setNotice(nextSaved.notice || "");
  }, [session]);

  useEffect(() => {
    const loadLeague = async () => {
      if (!session?.schoolId) {
        setStudents([]);
        setError("School details are missing for this account.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [studentsSnap, reportsSnap, progressSnap] = await Promise.all([
          getDocs(query(collection(db, "defaultSchoolEnrollments"), where("schoolId", "==", session.schoolId))),
          getDocs(query(collection(db, "reports"), where("schoolId", "==", session.schoolId))),
          getDocs(query(collection(db, "learningProgress"), where("schoolId", "==", session.schoolId))),
        ]);

        const studentDocs = studentsSnap.docs.map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }));
        const reports = reportsSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const progressDocs = progressSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

        const rankedStudents = studentDocs
          .map((student) => {
            const metrics = buildStudentMetrics(student, reports, progressDocs);
            const marketValue = Math.max(
              120,
              Math.round(metrics.avgAccuracy * 4 + metrics.practiceXp * 0.6 + metrics.totalScore * 0.35 + metrics.attempts * 18)
            );
            return {
              id: student.id,
              name: student.name || student.fullName || "Student",
              className: student.className || "Class",
              schoolId: student.schoolId || session.schoolId,
              schoolName: student.schoolName || session.schoolName || "Hepsy School",
              avatar: readAvatar(student),
              location: student.location || session.schoolName || "School Campus",
              marketValue,
              ...metrics,
            };
          })
          .sort((a, b) => b.fantasyPoints - a.fantasyPoints || b.rating - a.rating || a.name.localeCompare(b.name));

        setStudents(rankedStudents);
        setSelectedPlayerId((current) => current || rankedStudents[0]?.id || "");
      } catch (loadError) {
        setError("League data could not be loaded right now.");
      } finally {
        setLoading(false);
      }
    };

    loadLeague();
  }, [session]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      getStorageKey(session),
      JSON.stringify({
        lineupIds,
        captainId,
        viceCaptainId,
        phaseIndex,
        activeTab,
        classFilter,
        seasonStats,
        simulationSummary,
        notice,
      })
    );
  }, [activeTab, captainId, classFilter, lineupIds, notice, phaseIndex, seasonStats, session, simulationSummary, viceCaptainId]);

  const classOptions = useMemo(() => {
    const values = Array.from(new Set(students.map((student) => student.className).filter(Boolean)));
    return ["all", ...values];
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (classFilter === "all") return students;
    return students.filter((student) => student.className === classFilter);
  }, [students, classFilter]);

  const lineupPlayers = useMemo(() => {
    const playerMap = new Map(students.map((student) => [student.id, student]));
    return lineupIds.map((id) => playerMap.get(id)).filter(Boolean);
  }, [lineupIds, students]);

  useEffect(() => {
    const validIds = lineupIds.filter((id) => students.some((student) => student.id === id));
    const nextLineupIds = [];

    if (currentUserId && validIds.includes(currentUserId)) {
      nextLineupIds.push(currentUserId);
    }

    validIds.forEach((id) => {
      if (!nextLineupIds.includes(id) && nextLineupIds.length < 5) {
        nextLineupIds.push(id);
      }
    });

    if (currentUserId && !nextLineupIds.includes(currentUserId)) {
      const currentUserPlayer = students.find((student) => student.id === currentUserId);
      if (currentUserPlayer) {
        nextLineupIds.unshift(currentUserId);
        nextLineupIds.splice(5);
      }
    }

    const validLineupIds = nextLineupIds.slice(0, 5);
    if (validLineupIds.length !== lineupIds.length) {
      setLineupIds(validLineupIds);
    }
    if (currentUserId && validLineupIds.includes(currentUserId) && captainId !== currentUserId) {
      setCaptainId(currentUserId);
    } else if (captainId && !validLineupIds.includes(captainId)) {
      setCaptainId(validLineupIds[0] || "");
    }
    if (viceCaptainId && (!validLineupIds.includes(viceCaptainId) || viceCaptainId === currentUserId)) {
      setViceCaptainId(validLineupIds.find((id) => id !== currentUserId) || "");
    }
    if (!viceCaptainId && validLineupIds.length > 1) {
      setViceCaptainId(validLineupIds.find((id) => id !== currentUserId) || "");
    }
    if (!selectedPlayerId && (students.find((student) => student.id === currentUserId)?.id || students[0]?.id)) {
      setSelectedPlayerId(students.find((student) => student.id === currentUserId)?.id || students[0].id);
    }
  }, [students, lineupIds, captainId, selectedPlayerId, currentUserId, viceCaptainId]);

  const selectedPlayer =
    students.find((student) => student.id === selectedPlayerId) || filteredStudents[0] || students[0] || null;

  const totalLineupPoints = lineupPlayers.reduce(
    (sum, player) =>
      sum +
      player.fantasyPoints +
      (player.id === captainId ? player.fantasyPoints : 0) +
      (player.id === viceCaptainId ? Math.round(player.fantasyPoints * 0.5) : 0),
    0
  );
  const totalLineupXp = lineupPlayers.reduce((sum, player) => sum + player.practiceXp, 0);
  const averageLineupAccuracy = lineupPlayers.length
    ? Math.round(lineupPlayers.reduce((sum, player) => sum + player.avgAccuracy, 0) / lineupPlayers.length)
    : 0;
  const projectedKp = lineupPlayers.reduce((sum, player) => sum + player.marketValue, 0);

  const rivalSquad = useMemo(() => {
    const selectedSet = new Set(lineupIds);
    return students.filter((student) => !selectedSet.has(student.id)).slice(0, 5);
  }, [students, lineupIds]);

  const rivalPoints = rivalSquad.reduce((sum, player, index) => sum + player.fantasyPoints * (index === 0 ? 2 : 1), 0);

  const insightSlides = [
    {
      key: "captain",
      title: "Captain Spotlight",
      content: captainId ? (
        (() => {
          const captain = students.find((student) => student.id === captainId);
          if (!captain) return <p className="league-note">Choose a captain from your selected five.</p>;
          return (
            <div className="league-captain-spotlight">
              <img src={captain.avatar} alt={captain.name} />
              <strong>{captain.name}</strong>
              <span>{captain.fantasyPoints * 2} boosted points</span>
            </div>
          );
        })()
      ) : (
        <p className="league-note">Choose a captain to unlock the 2x points multiplier.</p>
      ),
    },
    {
      key: "vice-captain",
      title: "Vice Captain",
      content: viceCaptainId ? (
        (() => {
          const viceCaptain = students.find((student) => student.id === viceCaptainId);
          if (!viceCaptain) return <p className="league-note">Pick one more lineup player as vice captain.</p>;
          return (
            <div className="league-captain-spotlight">
              <img src={viceCaptain.avatar} alt={viceCaptain.name} />
              <strong>{viceCaptain.name}</strong>
              <span>{viceCaptain.fantasyPoints + Math.round(viceCaptain.fantasyPoints * 0.5)} boosted points</span>
            </div>
          );
        })()
      ) : (
        <p className="league-note">Pick one more lineup player as vice captain for a 1.5x boost.</p>
      ),
    },
    {
      key: "league-info",
      title: "League Info",
      content: (
        <div className="league-info-list">
          <div><span>League Type</span><strong>School Fantasy</strong></div>
          <div><span>Student Pool</span><strong>{students.length}</strong></div>
          <div><span>Captain Rule</span><strong>Captain 2x, VC 1.5x</strong></div>
          <div><span>Scoring</span><strong>Reports + XP + Practice</strong></div>
          <div><span>Matches Played</span><strong>{seasonStats.played}</strong></div>
        </div>
      ),
    },
    {
      key: "points",
      title: "How Points Work",
      content: (
        <div className="league-inline-stats compact">
          <div><Trophy size={16} /><span>Quiz scores raise fantasy points</span></div>
          <div><Star size={16} /><span>XP and completed practice boost value</span></div>
          <div><TrendingUp size={16} /><span>Recent form and consistency improve rating</span></div>
        </div>
      ),
    },
  ];

  const activeInsightSlide = insightSlides[insightSlide] || insightSlides[0];

  useEffect(() => {
    if (insightSlides.length <= 1) return undefined;

    const slideTimer = window.setInterval(() => {
      setInsightSlide((current) => (current + 1) % insightSlides.length);
    }, 3000);

    return () => window.clearInterval(slideTimer);
  }, [insightSlides.length]);

  const inspectPlayer = (player) => {
    setSelectedPlayerId(player.id);
  };

  const toggleLineupPlayer = (player) => {
    if (player.id === currentUserId) {
      setSelectedPlayerId(player.id);
      return;
    }

    setSelectedPlayerId(player.id);
    setNotice("");
    setLineupIds((current) => {
      if (current.includes(player.id)) {
        return current.filter((id) => id !== player.id);
      }
      if (current.length >= 5) {
        return current;
      }
      return [...current, player.id];
    });
    setCaptainId((currentCaptain) => {
      if (lineupIds.includes(player.id) && currentCaptain === player.id) {
        return lineupIds.filter((id) => id !== player.id)[0] || "";
      }
      if (!currentCaptain && lineupIds.length < 5) {
        return player.id;
      }
      return currentCaptain;
    });
    setViceCaptainId((currentViceCaptain) => {
      if (currentViceCaptain === player.id && lineupIds.includes(player.id)) {
        const nextPool = lineupIds.filter((id) => id !== player.id && id !== currentUserId);
        return nextPool[0] || "";
      }
      if (!lineupIds.includes(player.id) && !currentViceCaptain && player.id !== currentUserId) {
        return player.id;
      }
      return currentViceCaptain;
    });
  };

  const handleViceCaptain = (playerId) => {
    if (!lineupIds.includes(playerId) || playerId === currentUserId) return;
    setNotice("");
    setViceCaptainId(playerId);
  };

  const buildTeamScores = (players, mainCaptainId, secondaryCaptainId) =>
    players.map((player) => {
      const baseScore =
        player.avgAccuracy * 0.38 +
        player.fantasyPoints * 0.12 +
        player.practiceXp * 0.08 +
        player.recentForm * 0.22 +
        player.consistency * 0.18;
      const variance = Math.round((Math.random() - 0.5) * 18);
      const rawScore = Math.max(8, Math.round(baseScore + variance));
      const multiplier =
        player.id === mainCaptainId
          ? 2
          : player.id === secondaryCaptainId
            ? 1.5
            : 1;

      return {
        ...player,
        matchScore: rawScore,
        boostedScore: Math.round(rawScore * multiplier),
        multiplier,
      };
    });

  const advanceLeaguePhase = () => {
    setNotice("");

    if (lineupPlayers.length < 5) {
      setNotice("Select all 5 students before advancing the fantasy season.");
      return;
    }

    if (phaseIndex === 0) {
      setSimulationSummary({
        title: "Formation locked",
        body: `Your squad is set with ${averageLineupAccuracy}% average accuracy and ${totalLineupXp} total XP.`,
        details: [
          `${lineupPlayers.length}/5 players selected`,
          `${captainId ? "Captain bonus live" : "Captain missing"}`,
          `${viceCaptainId ? "Vice captain assigned" : "Vice captain missing"}`,
        ],
      });
      setNotice("Formation locked. Move into practice lock to prepare for matchday.");
      setPhaseIndex(1);
      return;
    }

    if (phaseIndex === 1) {
      setSimulationSummary({
        title: "Practice lock complete",
        body: "Practice data has been locked in. Matchday simulation is ready.",
        details: lineupPlayers.map(
          (player) => `${player.name}: ${player.avgAccuracy}% ACC, ${player.practiceXp} XP`
        ),
      });
      setNotice("Practice lock complete. You can now simulate matchday.");
      setPhaseIndex(2);
      return;
    }

    if (phaseIndex === 2) {
      const userScores = buildTeamScores(lineupPlayers, captainId, viceCaptainId);
      const rivalCaptainId = rivalSquad[0]?.id || "";
      const rivalViceCaptainId = rivalSquad[1]?.id || "";
      const rivalScores = buildTeamScores(rivalSquad, rivalCaptainId, rivalViceCaptainId);
      const yourTotal = userScores.reduce((sum, item) => sum + item.boostedScore, 0);
      const rivalTotal = rivalScores.reduce((sum, item) => sum + item.boostedScore, 0);
      const didWin = yourTotal >= rivalTotal;

      setSeasonStats((current) => ({
        played: safeNumber(current?.played) + 1,
        wins: safeNumber(current?.wins) + (didWin ? 1 : 0),
        losses: safeNumber(current?.losses) + (didWin ? 0 : 1),
        totalPoints: safeNumber(current?.totalPoints) + yourTotal,
      }));

      setSimulationSummary({
        title: didWin ? "Victory secured" : "Matchday complete",
        body: `${teamName} scored ${yourTotal} against School Rivals XI on ${rivalTotal}.`,
        details: userScores
          .sort((a, b) => b.boostedScore - a.boostedScore)
          .map((player) => `${player.name}: ${player.boostedScore} pts${player.multiplier > 1 ? ` (${player.multiplier}x)` : ""}`),
        opponentDetails: rivalScores
          .sort((a, b) => b.boostedScore - a.boostedScore)
          .map((player) => `${player.name}: ${player.boostedScore} pts`),
        yourTotal,
        rivalTotal,
        didWin,
      });
      setNotice(didWin ? "Matchday won. Review the results tab and reset for another round." : "Matchday finished. Review the results and tweak your squad.");
      setActiveTab("match");
      setPhaseIndex(3);
      return;
    }

    setNotice("Season reset to formation. Adjust your five and run another fantasy round.");
    setSimulationSummary(null);
    setPhaseIndex(0);
  };

  const timelineSummary = [
    `${lineupPlayers.length}/5 students locked`,
    `${averageLineupAccuracy}% average accuracy`,
    `${totalLineupXp} total XP`,
    simulationSummary?.yourTotal && simulationSummary?.rivalTotal
      ? `${simulationSummary.yourTotal} vs ${simulationSummary.rivalTotal}`
      : `${totalLineupPoints} projected match points`,
  ];

  const leaderboard = useMemo(
    () =>
      students
        .map((student) => ({
          id: student.id,
          name: student.name,
          className: student.className,
          score: student.fantasyPoints,
          xp: student.practiceXp,
          selected: lineupIds.includes(student.id),
        }))
        .sort((a, b) => b.score - a.score || b.xp - a.xp || a.name.localeCompare(b.name))
        .slice(0, 12),
    [students, lineupIds]
  );

  const teamName = `${session?.schoolName || "Hepsy"} Captains`;
  const currentPhase = TIMELINE_STEPS[phaseIndex] || TIMELINE_STEPS[0];

  if (loading) {
    return <section className="league-shell"><div className="league-state-card">Loading league roster...</div></section>;
  }

  if (error) {
    return <section className="league-shell"><div className="league-state-card error">{error}</div></section>;
  }

  return (
    <section className="league-shell">
        <div className="league-topbar">
        <div>
          <p className="league-eyebrow">hepsy quiz league</p>
          <h1>{session?.schoolName || "School League"} Fantasy Arena</h1>
          <span>Build a 5-student squad from your school and let real practice performance drive the points.</span>
        </div>

        <div className="league-topbar-meta">
          <div>
            <span>Captain</span>
            <strong>{session?.name || "Student Leader"}</strong>
          </div>
          <div>
            <span>School</span>
            <strong>{session?.schoolName || "Hepsy Network"}</strong>
          </div>
          <div>
            <span>Live Phase</span>
            <strong>{currentPhase}</strong>
          </div>
        </div>
        </div>

      {notice ? <div className="league-notice-banner">{notice}</div> : null}

      <div className="league-hero-grid">
        <article className="league-panel league-profile-panel">
          <div className="league-panel-title">Team Profile</div>
          <div className="league-team-profile">
            <div className="league-crest">
              <Shield size={42} />
              <strong>{getInitials(session?.schoolName)}</strong>
            </div>
            <div>
              <h2>{teamName}</h2>
              <p>{session?.className || "All Classes"} fantasy squad</p>
            </div>
          </div>
          <div className="league-profile-stats">
            <div>
              <span>Ranked Pool</span>
              <strong>{students.length}</strong>
            </div>
            <div>
              <span>Lineup Power</span>
              <strong>{totalLineupPoints}</strong>
            </div>
            <div>
              <span>Win Signal</span>
              <strong>{averageLineupAccuracy}%</strong>
            </div>
          </div>
          <div className="league-profile-badge">Academic Fantasy Division</div>
        </article>

        <article className="league-panel league-lineup-panel">
          <div className="league-panel-heading">
            <div>
              <div className="league-panel-title">Active Lineup</div>
              <h3>Choose any 5 students from your school</h3>
            </div>
            <button
              type="button"
              className="league-ghost-btn"
              onClick={advanceLeaguePhase}
            >
              <TimerReset size={16} />
              {phaseIndex === 0
                ? "Lock Formation"
                : phaseIndex === 1
                  ? "Lock Practice"
                  : phaseIndex === 2
                    ? "Simulate Matchday"
                    : "Restart Season"}
            </button>
          </div>

          <div className="league-lineup-strip">
            {Array.from({ length: 5 }, (_, index) => {
              const player = lineupPlayers[index];
              return (
                <div key={player?.id || `slot-${index}`} className={`league-lineup-slot ${player ? "filled" : ""}`}>
                  {player ? (
                    <>
                      <div className="league-slot-avatar">
                        <img src={player.avatar} alt={player.name} />
                        {captainId === player.id ? (
                          <span className="league-slot-captain">
                            <Crown size={12} />
                          </span>
                        ) : null}
                        {viceCaptainId === player.id ? (
                          <span className="league-slot-vice-captain">VC</span>
                        ) : null}
                      </div>
                      <strong>{player.rating}</strong>
                      <span>{player.name}</span>
                      <button
                        type="button"
                        onClick={() => handleViceCaptain(player.id)}
                        disabled={player.id === currentUserId}
                      >
                        {captainId === player.id ? "Captain" : viceCaptainId === player.id ? "Vice Captain" : "Set VC"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="league-empty-slot">
                        <div className="league-empty-avatar">
                          <Plus size={22} />
                        </div>
                        <strong>Add Player</strong>
                        <span>Select from the pool</span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <aside className="league-sidebar-stack">
          <article className="league-panel league-sidebar-card">
            <div className="league-panel-title">League Hub</div>
            <div className="league-sidebar-stat">
              <Sparkles size={18} />
              <div>
                <span>Knowledge Points</span>
                <strong>{projectedKp} KP</strong>
              </div>
            </div>
            <div className="league-sidebar-stat">
              <Users size={18} />
              <div>
                <span>Squad Slots</span>
                <strong>{lineupPlayers.length} / 5</strong>
              </div>
            </div>
            <div className="league-sidebar-stat">
              <Trophy size={18} />
              <div>
                <span>Season Record</span>
                <strong>{seasonStats.wins}-{seasonStats.losses}</strong>
              </div>
            </div>
          </article>

          <article className="league-panel league-sidebar-card">
            <div className="league-panel-title">Season Status</div>
            <p className="league-phase-copy">{currentPhase}</p>
            <div className="league-mini-timeline">
              {TIMELINE_STEPS.map((step, index) => (
                <div
                  key={step}
                  className={`league-mini-node ${index <= phaseIndex ? "done" : ""} ${index === phaseIndex ? "active" : ""} ${index > phaseIndex ? "locked" : ""}`}
                >
                  <span>
                    {index < phaseIndex ? (
                      <CheckCircle2 size={12} />
                    ) : index === phaseIndex ? (
                      <Star size={12} />
                    ) : (
                      <Lock size={11} />
                    )}
                  </span>
                  <small>{step}</small>
                </div>
              ))}
            </div>
            <button type="button" className="league-confirm-btn" onClick={advanceLeaguePhase}>
              <CheckCircle2 size={18} />
              {phaseIndex === 0
                ? "Confirm Lineup"
                : phaseIndex === 1
                  ? "Confirm Practice Lock"
                  : phaseIndex === 2
                    ? "Run Matchday"
                    : "Reset Season"}
            </button>
          </article>
        </aside>
      </div>

      <div className="league-tabs">
        {LEAGUE_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={tab.key === activeTab ? "active" : ""}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="league-content-grid">
        <div className="league-main-column">
          {activeTab === "overview" ? (
            <>
              <div className="league-filter-row">
                {classOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={option === classFilter ? "active" : ""}
                    onClick={() => setClassFilter(option)}
                  >
                    {option === "all" ? "All Classes" : option}
                  </button>
                ))}
              </div>

              <div className="league-card-grid">
                {filteredStudents.slice(0, 8).map((player) => (
                  <PlayerBadge
                    key={player.id}
                    player={player}
                    selected={lineupIds.includes(player.id)}
                    locked={lineupIds.length >= 5 && !lineupIds.includes(player.id)}
                    isCaptain={captainId === player.id}
                    isViceCaptain={viceCaptainId === player.id}
                    isCurrentUser={player.id === currentUserId}
                    onInspect={inspectPlayer}
                    onSelect={toggleLineupPlayer}
                    onViceCaptain={handleViceCaptain}
                  />
                ))}
              </div>
            </>
          ) : null}

          {activeTab === "market" ? (
            <div className="league-market-layout">
              <div className="league-scroll-panel league-market-pool">
                <div className="league-card-grid">
                  {filteredStudents.map((player) => (
                    <PlayerBadge
                      key={player.id}
                      player={player}
                      selected={lineupIds.includes(player.id)}
                      locked={lineupIds.length >= 5 && !lineupIds.includes(player.id)}
                      isCaptain={captainId === player.id}
                      isViceCaptain={viceCaptainId === player.id}
                      isCurrentUser={player.id === currentUserId}
                      onInspect={inspectPlayer}
                      onSelect={toggleLineupPlayer}
                      onViceCaptain={handleViceCaptain}
                    />
                  ))}
                </div>
              </div>

              <aside className="league-detail-panel">
                {selectedPlayer ? (
                  <>
                    <div className="league-detail-head">
                      <img src={selectedPlayer.avatar} alt={selectedPlayer.name} />
                      <div>
                        <h3>{selectedPlayer.name}</h3>
                        <p>{selectedPlayer.className}</p>
                      </div>
                    </div>

                    <div className="league-radar-list">
                      <div><span>Accuracy</span><strong>{selectedPlayer.avgAccuracy}%</strong></div>
                      <div><span>Practice XP</span><strong>{selectedPlayer.practiceXp}</strong></div>
                      <div><span>Total Score</span><strong>{selectedPlayer.totalScore}</strong></div>
                      <div><span>Attempts</span><strong>{selectedPlayer.attempts}</strong></div>
                      <div><span>Consistency</span><strong>{selectedPlayer.consistency}</strong></div>
                      <div><span>Speed</span><strong>{selectedPlayer.speed}</strong></div>
                    </div>

                    <div className="league-history-card">
                      <div className="league-history-bars">
                        {[selectedPlayer.avgAccuracy, selectedPlayer.recentForm, selectedPlayer.consistency, selectedPlayer.speed].map((value, index) => (
                          <span key={`${selectedPlayer.id}-bar-${index}`} style={{ height: `${Math.max(18, value)}%` }} />
                        ))}
                      </div>
                      <p>Live profile built from reports, practice completion, and progress updates already stored in Firebase.</p>
                    </div>

                    {!lineupIds.includes(selectedPlayer.id) || selectedPlayer.id === currentUserId ? null : (
                      <button
                        type="button"
                        className="league-captain-btn"
                        onClick={() => handleViceCaptain(selectedPlayer.id)}
                      >
                        {viceCaptainId === selectedPlayer.id ? "Vice Captain Active" : "Set As Vice Captain"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="league-confirm-btn"
                      onClick={() => toggleLineupPlayer(selectedPlayer)}
                      disabled={
                        selectedPlayer.id === currentUserId ||
                        (lineupIds.length >= 5 && !lineupIds.includes(selectedPlayer.id))
                      }
                    >
                      {selectedPlayer.id === currentUserId
                        ? "Current User Locked"
                        : lineupIds.includes(selectedPlayer.id)
                          ? "Remove From Lineup"
                          : "Acquire Player"}
                    </button>
                  </>
                ) : (
                  <p>Select a student to inspect the profile.</p>
                )}
              </aside>
            </div>
          ) : null}

          {activeTab === "match" ? (
            <div className="league-match-layout">
              <section className="league-match-banner">
                <div>
                  <span>{teamName}</span>
                  <strong>{totalLineupPoints}</strong>
                </div>
                <div className="league-match-vs">VS</div>
                <div>
                  <span>School Rivals XI</span>
                  <strong>{rivalPoints}</strong>
                </div>
              </section>

              <div className="league-match-stats">
                <article className="league-panel">
                  <div className="league-panel-title">Your Squad Edge</div>
                  <div className="league-inline-stats">
                    <div><Target size={16} /><span>{averageLineupAccuracy}% accuracy</span></div>
                    <div><TrendingUp size={16} /><span>{totalLineupXp} team XP</span></div>
                    <div><Star size={16} /><span>{viceCaptainId ? "Captain + vice captain bonuses active" : "Choose a vice captain"}</span></div>
                  </div>
                </article>

                <article className="league-panel">
                  <div className="league-panel-title">Projected Result</div>
                  <p className="league-result-copy">
                    {simulationSummary?.body ||
                      (totalLineupPoints >= rivalPoints
                        ? "Your current five look stronger than the school rival projection."
                        : "You need a stronger captain or higher-form players to overtake the rival projection.")}
                  </p>
                </article>
              </div>

              {simulationSummary?.details ? (
                <article className="league-panel">
                  <div className="league-panel-title">Simulation Summary</div>
                  <div className="league-summary-stack">
                    <strong>{simulationSummary.title}</strong>
                    <p>{simulationSummary.body}</p>
                    {simulationSummary.details.map((line) => (
                      <div key={line} className="league-summary-row">{line}</div>
                    ))}
                  </div>
                </article>
              ) : null}
            </div>
          ) : null}

          {activeTab === "standings" ? (
            <div className="league-scroll-panel">
              <div className="league-standings-table">
                {leaderboard.map((entry, index) => (
                  <div key={entry.id} className={`league-standing-row ${entry.selected ? "selected" : ""}`}>
                    <span>#{index + 1}</span>
                    <strong>{entry.name}</strong>
                    <small>{entry.className}</small>
                    <span>{entry.xp} XP</span>
                    <strong>{entry.score} pts</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "timeline" ? (
            <div className="league-timeline-panel">
              {TIMELINE_STEPS.map((step, index) => (
                <article key={step} className={`league-timeline-card ${index === phaseIndex ? "active" : ""} ${index < phaseIndex ? "done" : ""}`}>
                  <div className="league-timeline-icon">
                    {index < phaseIndex ? <CheckCircle2 size={18} /> : <CalendarRange size={18} />}
                  </div>
                  <div>
                    <h4>{step}</h4>
                    <p>{timelineSummary[index] || "Continue building the best five-player school squad."}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <aside className="league-right-column">
          <article className="league-panel league-insight-slider">
            <div className="league-insight-slider-head">
              <div className="league-panel-title">{activeInsightSlide.title}</div>
              <div className="league-insight-dots" aria-label="Insight slides">
                {insightSlides.map((slide, index) => (
                  <button
                    key={slide.key}
                    type="button"
                    className={index === insightSlide ? "active" : ""}
                    onClick={() => setInsightSlide(index)}
                    aria-label={`Show ${slide.title}`}
                  />
                ))}
              </div>
            </div>
            <div className="league-insight-body">
              {activeInsightSlide.content}
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
