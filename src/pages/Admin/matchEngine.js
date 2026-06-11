// Admin/matchEngine.js

const MATCH_DAYS = [0, 2, 4]; // Sun, Tue, Thu

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getNextValidMatchDay(date) {
  const d = new Date(date.getTime());
  do {
    d.setDate(d.getDate() + 1);
  } while (!MATCH_DAYS.includes(d.getDay()));
  return d;
}

export function generateRoundRobinSchedule(teams, startDate, startTime) {
  if (teams.length < 2) {
    throw new Error("Minimum 2 teams required");
  }

  let teamList = [...teams];

  // Add BYE if odd
  if (teamList.length % 2 !== 0) {
    teamList.push({ id: "BYE", name: "BYE", isBye: true });
  }

  const rounds = teamList.length - 1;
  const matchesPerRound = teamList.length / 2;

  // Parse start date safely (LOCAL)
  const [y, m, d] = startDate.split("-").map(Number);
  let matchDate = new Date(y, m - 1, d, 12, 0, 0);

  // Align to first valid match day
  while (!MATCH_DAYS.includes(matchDate.getDay())) {
    matchDate.setDate(matchDate.getDate() + 1);
  }

  const fixtures = [];

  for (let round = 0; round < rounds; round++) {
    const roundDate = new Date(matchDate);

    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = teamList[i];
      const teamB = teamList[teamList.length - 1 - i];

      if (teamA.isBye || teamB.isBye) continue;

      fixtures.push({
        round: round + 1,
        date: formatDate(roundDate),
        startTime,
        teamA: {
          id: teamA.id,
          name: teamA.name,
          logoUrl: teamA.logoUrl || null,
        },
        teamB: {
          id: teamB.id,
          name: teamB.name,
          logoUrl: teamB.logoUrl || null,
        },
      });
    }

    // Rotate (round robin)
    teamList.splice(1, 0, teamList.pop());

    // Next valid match day
    matchDate = getNextValidMatchDay(matchDate);
  }

  return fixtures;
}
