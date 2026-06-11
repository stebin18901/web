// leagueEngine.js

/**
 * Generates a Round Robin schedule using the Circle Method (Berger Table).
 * @param {Array} teams - Array of team objects
 * @param {Date} startDate - The date to start searching for match days
 * @param {Array} allowedDays - [0, 2, 4] for Sun, Tue, Thu
 * @returns {Array} List of formatted fixtures
 */
export const generateRoundRobin = (league, teamsInLeague, allowedDays) => {
  let teams = [...teamsInLeague].sort(() => Math.random() - 0.5);

  // If odd number of teams, add a "BYE" team
  if (teams.length % 2 !== 0) {
    teams.push({ id: "bye", name: "BYE", isBye: true });
  }

  const numTeams = teams.length;
  const numRounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;
  const fixtures = [];

  let currentDate = new Date(league.startDate);
  
  // Ensure we start on or after the selected start date's midnight
  currentDate.setHours(0, 0, 0, 0);

  for (let round = 0; round < numRounds; round++) {
    // 1. Find the next valid match day
    while (!allowedDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const dateStr = currentDate.toISOString().split("T")[0];

    for (let i = 0; i < matchesPerRound; i++) {
      const teamA = teams[i];
      const teamB = teams[numTeams - 1 - i];

      // Skip the fixture if it's a BYE
      if (!teamA.isBye && !teamB.isBye) {
        fixtures.push({
          leagueId: league.id,
          teamA: { id: teamA.id, name: teamA.name, logoUrl: teamA.logoUrl || null },
          teamB: { id: teamB.id, name: teamB.name, logoUrl: teamB.logoUrl || null },
          date: dateStr,
          startTime: league.startTime,
          status: "UPCOMING",
          round: round + 1,
          scoreA: 0,
          scoreB: 0,
        });
      }
    }

    // 2. Rotate teams for the next round (Circle Method)
    // Keep the first team fixed, rotate the rest
    const fixedTeam = teams[0];
    const rotatingTeams = teams.slice(1);
    const lastTeam = rotatingTeams.pop();
    teams = [fixedTeam, lastTeam, ...rotatingTeams];

    // 3. Move to the next day for the next round search
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return fixtures;
};