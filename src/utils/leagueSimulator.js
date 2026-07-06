const FIRST_NAMES = [
  "Aarav",
  "Ishaan",
  "Vihaan",
  "Reyansh",
  "Arjun",
  "Kabir",
  "Aditya",
  "Krish",
  "Dev",
  "Rohan",
  "Anaya",
  "Diya",
  "Kiara",
  "Myra",
  "Sara",
  "Aanya",
  "Ira",
  "Navya",
  "Zoya",
  "Tara",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Kapoor",
  "Iyer",
  "Nair",
  "Mehta",
  "Bose",
  "Reddy",
  "Patel",
  "Singh",
  "Chopra",
  "Malhotra",
  "Joshi",
  "Khanna",
  "Menon",
  "Gill",
  "Das",
  "Kulkarni",
  "Saxena",
  "Bhat",
];

export const LEAGUE_SPECIALIZATIONS = [
  "Pop Culture",
  "Science",
  "History",
  "Sports",
  "Geography",
  "Literature",
  "Technology",
  "Cinema",
];

export const LEAGUE_PHASES = [
  { key: "opening_transfer", label: "Transfer Window", type: "transfer" },
  { key: "matchday_1", label: "Matchday 1", type: "matchday" },
  { key: "matchday_2", label: "Matchday 2", type: "matchday" },
  { key: "midseason_transfer", label: "Transfer Window", type: "transfer" },
  { key: "finals", label: "Finals", type: "finals" },
];

const MAX_ROSTER_SIZE = 6;
const MIN_USER_ROSTER = 4;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const roundCurrency = (value) => Math.max(0, Math.round(value));

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min, max, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round((Math.random() * (max - min) + min) * factor) / factor;
};

const buildPlayerName = (index) => {
  const first = FIRST_NAMES[index % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
};

const calculateMarketValue = (accuracy, responseTime) => {
  const accuracyWeight = accuracy * 8.2;
  const speedWeight = (12 - responseTime) * 36;
  return clamp(roundCurrency(accuracyWeight + speedWeight + randomInt(-50, 60)), 100, 1000);
};

const createPlayer = (index) => {
  const accuracy = randomInt(56, 94);
  const responseTime = randomFloat(2.8, 10.9);
  const marketValue = calculateMarketValue(accuracy, responseTime);
  return {
    id: `player-${String(index + 1).padStart(3, "0")}`,
    name: buildPlayerName(index),
    specialization: LEAGUE_SPECIALIZATIONS[index % LEAGUE_SPECIALIZATIONS.length],
    accuracy,
    responseTime,
    marketValue,
    teamId: null,
    lastScore: null,
  };
};

const createTeam = (team) => ({
  id: team.id,
  name: team.name,
  isUser: team.isUser || false,
  coins: 5000,
  rosterIds: [],
  wins: 0,
  losses: 0,
  matchesPlayed: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  lastResult: "—",
});

const getPlayerMap = (state) =>
  state.players.reduce((accumulator, player) => {
    accumulator[player.id] = player;
    return accumulator;
  }, {});

export const getCurrentPhase = (state) => LEAGUE_PHASES[state.phaseIndex] || LEAGUE_PHASES[LEAGUE_PHASES.length - 1];

export const getTeamById = (state, teamId) => state.teams.find((team) => team.id === teamId) || null;

export const getRosterForTeam = (state, teamId) => state.players.filter((player) => player.teamId === teamId);

export const getFreeAgents = (state) =>
  state.players
    .filter((player) => !player.teamId)
    .sort((a, b) => b.marketValue - a.marketValue || b.accuracy - a.accuracy);

export const getStandings = (state) =>
  [...state.teams].sort((teamA, teamB) => {
    const pointsA = teamA.wins * 3;
    const pointsB = teamB.wins * 3;
    if (pointsB !== pointsA) return pointsB - pointsA;
    const diffA = teamA.pointsFor - teamA.pointsAgainst;
    const diffB = teamB.pointsFor - teamB.pointsAgainst;
    if (diffB !== diffA) return diffB - diffA;
    if (teamB.pointsFor !== teamA.pointsFor) return teamB.pointsFor - teamA.pointsFor;
    return teamB.coins - teamA.coins;
  });

export const createSeededLeagueState = (userName = "Student") => {
  const players = Array.from({ length: 66 }, (_, index) => createPlayer(index));
  const teams = [
    createTeam({ id: "user", name: `${userName} FC`, isUser: true }),
    createTeam({ id: "cpu-1", name: "Brainwave Bandits" }),
    createTeam({ id: "cpu-2", name: "Neon Night Owls" }),
    createTeam({ id: "cpu-3", name: "Quiztopher United" }),
    createTeam({ id: "cpu-4", name: "Fact Force One" }),
  ];

  const aiPlayerIds = players.slice(0, 16).map((player) => player.id);
  teams
    .filter((team) => !team.isUser)
    .forEach((team, teamIndex) => {
      const assignedIds = aiPlayerIds.slice(teamIndex * 4, teamIndex * 4 + 4);
      team.rosterIds = assignedIds;
      assignedIds.forEach((playerId) => {
        const player = players.find((entry) => entry.id === playerId);
        if (player) player.teamId = team.id;
      });
    });

  return {
    version: 1,
    phaseIndex: 0,
    seasonComplete: false,
    userTeamNameLocked: false,
    transferActions: [],
    results: [],
    players,
    teams,
  };
};

export const updateUserTeamName = (state, name) => ({
  ...state,
  teams: state.teams.map((team) =>
    team.id === "user"
      ? {
          ...team,
          name: name.trim() || team.name,
        }
      : team
  ),
});

export const buyPlayerForUser = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  const team = getTeamById(state, "user");
  const phase = getCurrentPhase(state);

  if (!player || !team || player.teamId || phase.type !== "transfer") return state;
  if (team.coins < player.marketValue || team.rosterIds.length >= MAX_ROSTER_SIZE) return state;

  return {
    ...state,
    players: state.players.map((entry) =>
      entry.id === playerId
        ? {
            ...entry,
            teamId: "user",
          }
        : entry
    ),
    teams: state.teams.map((entry) =>
      entry.id === "user"
        ? {
            ...entry,
            coins: entry.coins - player.marketValue,
            rosterIds: [...entry.rosterIds, playerId],
          }
        : entry
    ),
    transferActions: [
      {
        type: "buy",
        teamId: "user",
        playerId,
        amount: player.marketValue,
        atPhase: phase.key,
      },
      ...state.transferActions,
    ].slice(0, 30),
  };
};

export const sellPlayerFromUser = (state, playerId) => {
  const player = state.players.find((entry) => entry.id === playerId);
  const team = getTeamById(state, "user");
  const phase = getCurrentPhase(state);

  if (!player || !team || player.teamId !== "user" || phase.type !== "transfer") return state;

  return {
    ...state,
    players: state.players.map((entry) =>
      entry.id === playerId
        ? {
            ...entry,
            teamId: null,
          }
        : entry
    ),
    teams: state.teams.map((entry) =>
      entry.id === "user"
        ? {
            ...entry,
            coins: entry.coins + player.marketValue,
            rosterIds: entry.rosterIds.filter((rosterId) => rosterId !== playerId),
          }
        : entry
    ),
    transferActions: [
      {
        type: "sell",
        teamId: "user",
        playerId,
        amount: player.marketValue,
        atPhase: phase.key,
      },
      ...state.transferActions,
    ].slice(0, 30),
  };
};

export const simulateCpuTransfers = (state) => {
  const phase = getCurrentPhase(state);
  if (phase.type !== "transfer") return { nextState: state, summary: null };

  let nextState = {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    teams: state.teams.map((team) => ({ ...team, rosterIds: [...team.rosterIds] })),
    transferActions: [...state.transferActions],
  };
  const moves = [];

  nextState.teams
    .filter((team) => !team.isUser)
    .forEach((team) => {
      const remainingSlots = MAX_ROSTER_SIZE - team.rosterIds.length;
      if (remainingSlots <= 0) return;
      const buyCount = Math.min(remainingSlots, randomInt(1, 2));
      for (let index = 0; index < buyCount; index += 1) {
        const pool = getFreeAgents(nextState).filter((player) => player.marketValue <= team.coins);
        if (!pool.length) break;
        const choice = pool[randomInt(0, Math.min(pool.length - 1, 9))];
        if (!choice) break;
        team.coins -= choice.marketValue;
        team.rosterIds.push(choice.id);
        const player = nextState.players.find((entry) => entry.id === choice.id);
        if (player) player.teamId = team.id;
        const action = {
          type: "buy",
          teamId: team.id,
          playerId: choice.id,
          amount: choice.marketValue,
          atPhase: phase.key,
        };
        nextState.transferActions.unshift(action);
        moves.push({
          teamName: team.name,
          playerName: choice.name,
          amount: choice.marketValue,
        });
      }
    });

  nextState.transferActions = nextState.transferActions.slice(0, 30);

  return {
    nextState,
    summary: {
      title: phase.label,
      subtitle: moves.length ? "CPU teams worked the market." : "CPU teams held their positions.",
      lines: moves.length
        ? moves.map((move) => `${move.teamName} signed ${move.playerName} for ${move.amount} coins.`)
        : ["No CPU moves were made in this transfer window."],
    },
  };
};

const getFixtureTeamIds = (state, phaseKey) => {
  if (phaseKey === "matchday_1") {
    return [
      ["user", "cpu-1"],
      ["cpu-2", "cpu-3"],
    ];
  }
  if (phaseKey === "matchday_2") {
    return [
      ["user", "cpu-2"],
      ["cpu-1", "cpu-4"],
    ];
  }
  if (phaseKey === "finals") {
    const standings = getStandings(state);
    if (standings.length < 2) return [];
    return [[standings[0].id, standings[1].id]];
  }
  return [];
};

const simulatePlayerScore = (player) => {
  const weightedScore =
    player.accuracy * 0.82 +
    (12 - player.responseTime) * 3.7 +
    randomFloat(-12, 18, 1);
  return clamp(Math.round(weightedScore), 20, 100);
};

const applyPlayerMarketMovement = (player, score) => {
  if (score >= 88) return roundCurrency(player.marketValue * 1.1);
  if (score <= 45) return roundCurrency(player.marketValue * 0.95);
  if (score >= 78) return roundCurrency(player.marketValue * 1.03);
  if (score <= 55) return roundCurrency(player.marketValue * 0.98);
  return roundCurrency(player.marketValue);
};

export const simulateCurrentMatchday = (state) => {
  const phase = getCurrentPhase(state);
  if (!["matchday", "finals"].includes(phase.type)) {
    return { nextState: state, summary: null };
  }

  let nextState = {
    ...state,
    players: state.players.map((player) => ({ ...player })),
    teams: state.teams.map((team) => ({ ...team, rosterIds: [...team.rosterIds] })),
    results: [...state.results],
  };
  const playerMap = getPlayerMap(nextState);
  const fixtureIds = getFixtureTeamIds(nextState, phase.key);
  const fixtures = [];

  fixtureIds.forEach(([homeId, awayId]) => {
    const homeTeam = getTeamById(nextState, homeId);
    const awayTeam = getTeamById(nextState, awayId);
    if (!homeTeam || !awayTeam) return;

    const homeRoster = homeTeam.rosterIds.map((playerId) => playerMap[playerId]).filter(Boolean);
    const awayRoster = awayTeam.rosterIds.map((playerId) => playerMap[playerId]).filter(Boolean);

    const homeScores = homeRoster.map((player) => {
      const score = simulatePlayerScore(player);
      player.lastScore = score;
      player.marketValue = applyPlayerMarketMovement(player, score);
      return { playerId: player.id, playerName: player.name, score };
    });
    const awayScores = awayRoster.map((player) => {
      const score = simulatePlayerScore(player);
      player.lastScore = score;
      player.marketValue = applyPlayerMarketMovement(player, score);
      return { playerId: player.id, playerName: player.name, score };
    });

    let homeTotal = homeScores.reduce((sum, player) => sum + player.score, 0);
    let awayTotal = awayScores.reduce((sum, player) => sum + player.score, 0);
    if (homeTotal === awayTotal) {
      homeTotal += randomInt(1, 6);
    }

    const winnerId = homeTotal > awayTotal ? homeId : awayId;
    const loserId = winnerId === homeId ? awayId : homeId;

    nextState.teams = nextState.teams.map((team) => {
      if (team.id !== homeId && team.id !== awayId) return team;
      const scored = team.id === homeId ? homeTotal : awayTotal;
      const conceded = team.id === homeId ? awayTotal : homeTotal;
      const isWinner = team.id === winnerId;
      return {
        ...team,
        coins: team.coins + (isWinner ? 500 : 100),
        wins: team.wins + (isWinner ? 1 : 0),
        losses: team.losses + (isWinner ? 0 : 1),
        matchesPlayed: team.matchesPlayed + 1,
        pointsFor: team.pointsFor + scored,
        pointsAgainst: team.pointsAgainst + conceded,
        lastResult: isWinner ? "W" : "L",
      };
    });

    fixtures.push({
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeScore: homeTotal,
      awayScore: awayTotal,
      winnerId,
      loserId,
      standoutPlayer:
        [...homeScores, ...awayScores].sort((a, b) => b.score - a.score)[0] || null,
      players: {
        [homeId]: homeScores,
        [awayId]: awayScores,
      },
    });
  });

  nextState.results.push({
    phaseKey: phase.key,
    label: phase.label,
    fixtures,
  });

  const standoutLines = fixtures
    .map((fixture) => {
      const winner = getTeamById(nextState, fixture.winnerId);
      const loser = getTeamById(nextState, fixture.loserId);
      const standout = fixture.standoutPlayer;
      return `${winner?.name || "Team"} beat ${loser?.name || "Team"} ${fixture.homeScore}-${fixture.awayScore}. ${
        standout ? `${standout.playerName} posted ${standout.score} points.` : ""
      }`;
    })
    .filter(Boolean);

  return {
    nextState,
    summary: {
      title: phase.label,
      subtitle: phase.type === "finals" ? "The mini-season champion has been decided." : "Coins, standings, and player values have been updated.",
      lines: standoutLines,
      fixtures,
    },
  };
};

export const advanceLeagueCalendar = (state) => {
  const phase = getCurrentPhase(state);
  const userTeam = getTeamById(state, "user");

  if (phase.type === "transfer") {
    if (!userTeam?.name?.trim()) {
      return {
        nextState: state,
        summary: {
          title: "Team setup needed",
          subtitle: "Give your club a name before the league opens.",
          lines: ["Create a team name to begin the simulation."],
          blocked: true,
        },
      };
    }
    if ((userTeam?.rosterIds || []).length < MIN_USER_ROSTER) {
      return {
        nextState: state,
        summary: {
          title: "Roster incomplete",
          subtitle: "You need at least 4 players before the calendar can move.",
          lines: ["Sign 4 players from the free-agent pool to enter the league."],
          blocked: true,
        },
      };
    }
    const { nextState: stateAfterCpu, summary: cpuSummary } = simulateCpuTransfers(state);
    const advancedState = {
      ...stateAfterCpu,
      phaseIndex: Math.min(stateAfterCpu.phaseIndex + 1, LEAGUE_PHASES.length - 1),
      userTeamNameLocked: true,
    };
    return {
      nextState: advancedState,
      summary: cpuSummary || {
        title: phase.label,
        subtitle: "The league is ready to move on.",
        lines: ["Transfer activity is complete. Matchday is next."],
      },
    };
  }

  const { nextState: afterMatch, summary } = simulateCurrentMatchday(state);
  const isFinalPhase = phase.key === "finals";
  const advancedState = {
    ...afterMatch,
    phaseIndex: isFinalPhase ? state.phaseIndex : Math.min(state.phaseIndex + 1, LEAGUE_PHASES.length - 1),
    seasonComplete: isFinalPhase,
  };
  return { nextState: advancedState, summary };
};

export const resetLeagueState = (userName = "Student") => createSeededLeagueState(userName);

export const getUpcomingFixtures = (state) => {
  const phase = getCurrentPhase(state);
  return getFixtureTeamIds(state, phase.key).map(([homeId, awayId]) => {
    const homeTeam = getTeamById(state, homeId);
    const awayTeam = getTeamById(state, awayId);
    return {
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeTeamName: homeTeam?.name || "TBD",
      awayTeamName: awayTeam?.name || "TBD",
    };
  });
};
