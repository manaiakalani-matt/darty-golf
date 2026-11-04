/**
 * Player statistics built from the round history. Pure functions: everything
 * is worked out on the phone from the records the API already returns.
 *
 * Names are matched ignoring capitals and spaces at the ends, so "Zaccyboi18"
 * and "zaccyboi18" are one player. Different nicknames stay separate unless
 * they are listed in NICKNAMES.
 */
import { PAR } from "./golf";
import type { GameRecord } from "./records";

/**
 * Nicknames for the same person, in lowercase: nickname → the name their stats
 * are kept under. Add a line here to merge two names. The profile shows
 * whichever name they played under most recently.
 */
export const NICKNAMES: Record<string, string> = {
  zaccyboi18: "zac",
};

export const playerKey = (name: string): string => {
  const key = name.trim().toLowerCase();
  return NICKNAMES[key] ?? key;
};

export interface RoundLine {
  recordId: string;
  completedAt: string;
  holes: 9 | 18;
  mode: GameRecord["mode"];
  total: number;
  holesPlayed: number;
  toPar: number;
  /** Position in the round (1 = won or tied for first). Solo rounds count as 1. */
  place: number;
  tiedFirst: boolean;
  opponents: number;
}

export interface HeadToHead {
  opponentKey: string;
  opponent: string;
  wins: number;
  losses: number;
  ties: number;
}

export interface PlayerProfile {
  key: string;
  name: string;
  rounds: RoundLine[];
  roundsPlayed: number;
  holesPlayed: number;
  /** Average strokes per hole; par is 3. Lower is better. */
  averagePerHole: number;
  /** Average score to par over a full 18, to compare players fairly across 9- and 18-hole rounds. */
  average18ToPar: number;
  best9: RoundLine | null;
  best18: RoundLine | null;
  wins: number;
  groupRounds: number;
  holesInOne: number;
  birdies: number;
  pars: number;
  bounceOuts: number;
  /** Hole numbers with the lowest and highest average, from holes played at least twice. */
  bestHole: { hole: number; average: number } | null;
  nemesisHole: { hole: number; average: number } | null;
  /** Average strokes per hole for each round, oldest first: the form line. */
  form: number[];
  headToHead: HeadToHead[];
  lastPlayed: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

interface Tally {
  names: Array<{ name: string; at: string }>;
  rounds: RoundLine[];
  holeScores: Map<number, number[]>;
  scores: number[];
  h2h: Map<string, HeadToHead>;
}

export const buildProfiles = (records: GameRecord[]): PlayerProfile[] => {
  const byKey = new Map<string, Tally>();
  const ordered = [...records].sort((a, b) => Date.parse(a.completedAt) - Date.parse(b.completedAt));

  for (const record of ordered) {
    const totals = record.competitors.map((competitor) => competitor.total);
    for (const competitor of record.competitors) {
      const key = playerKey(competitor.name);
      if (!key) continue;
      const entry: Tally = byKey.get(key) ?? { names: [], rounds: [], holeScores: new Map(), scores: [], h2h: new Map() };
      byKey.set(key, entry);
      entry.names.push({ name: competitor.name.trim(), at: record.completedAt });

      const played = competitor.scores.filter((score) => score > 0);
      const better = totals.filter((total) => total < competitor.total).length;
      const tiedFirst = better === 0 && totals.filter((total) => total === competitor.total).length > 1;
      entry.rounds.push({
        recordId: record.id, completedAt: record.completedAt, holes: record.holes, mode: record.mode,
        total: competitor.total, holesPlayed: played.length, toPar: competitor.total - played.length * PAR,
        place: better + 1, tiedFirst, opponents: record.competitors.length - 1,
      });
      competitor.scores.forEach((score, index) => {
        if (score <= 0) return;
        entry.scores.push(score);
        const list = entry.holeScores.get(index + 1) ?? [];
        list.push(score);
        entry.holeScores.set(index + 1, list);
      });

      for (const other of record.competitors) {
        const otherKey = playerKey(other.name);
        if (otherKey === key) continue;
        const h2h = entry.h2h.get(otherKey) ?? { opponentKey: otherKey, opponent: other.name.trim(), wins: 0, losses: 0, ties: 0 };
        h2h.opponent = other.name.trim();
        if (competitor.total < other.total) h2h.wins += 1;
        else if (competitor.total > other.total) h2h.losses += 1;
        else h2h.ties += 1;
        entry.h2h.set(otherKey, h2h);
      }
    }
  }

  return [...byKey.entries()].map(([key, entry]): PlayerProfile => {
    const holesPlayed = entry.scores.length;
    const averagePerHole = holesPlayed ? entry.scores.reduce((sum, score) => sum + score, 0) / holesPlayed : PAR;
    const count = (target: number) => entry.scores.filter((score) => score === target).length;
    const holeAverages = [...entry.holeScores.entries()]
      .filter(([, scores]) => scores.length >= 2)
      .map(([hole, scores]) => ({ hole, average: round1(scores.reduce((sum, score) => sum + score, 0) / scores.length) }))
      .sort((a, b) => a.average - b.average || a.hole - b.hole);
    const bestOf = (holes: 9 | 18) => entry.rounds.filter((round) => round.holes === holes)
      .reduce<RoundLine | null>((best, round) => (!best || round.total < best.total ? round : best), null);
    const groupRounds = entry.rounds.filter((round) => round.opponents > 0);
    const latestName = entry.names[entry.names.length - 1];

    return {
      key,
      name: latestName.name,
      rounds: [...entry.rounds].reverse(),
      roundsPlayed: entry.rounds.length,
      holesPlayed,
      averagePerHole: Math.round(averagePerHole * 100) / 100,
      average18ToPar: round1((averagePerHole - PAR) * 18),
      best9: bestOf(9),
      best18: bestOf(18),
      wins: groupRounds.filter((round) => round.place === 1 && !round.tiedFirst).length,
      groupRounds: groupRounds.length,
      holesInOne: count(1),
      birdies: count(2),
      pars: count(3),
      bounceOuts: count(7),
      bestHole: holeAverages.length >= 2 ? holeAverages[0] : null,
      nemesisHole: holeAverages.length >= 2 ? holeAverages[holeAverages.length - 1] : null,
      form: entry.rounds.slice(-10).map((round) => (round.holesPlayed ? Math.round((round.total / round.holesPlayed) * 100) / 100 : PAR)),
      headToHead: [...entry.h2h.values()].sort((a, b) => (b.wins + b.losses + b.ties) - (a.wins + a.losses + a.ties) || a.opponent.localeCompare(b.opponent)),
      lastPlayed: entry.rounds[entry.rounds.length - 1].completedAt,
    };
  });
};

/** Players ranked for the clubhouse table: by average per hole, among those with enough rounds to be fair. */
export const clubhouseRankings = (profiles: PlayerProfile[], minimumRounds = 2): { ranked: PlayerProfile[]; unranked: PlayerProfile[] } => {
  const ranked = profiles.filter((profile) => profile.roundsPlayed >= minimumRounds)
    .sort((a, b) => a.averagePerHole - b.averagePerHole || b.roundsPlayed - a.roundsPlayed);
  const unranked = profiles.filter((profile) => profile.roundsPlayed < minimumRounds)
    .sort((a, b) => Date.parse(b.lastPlayed) - Date.parse(a.lastPlayed));
  return { ranked, unranked };
};

/** "Daz leads Darren 3–1", "All square with Zac 2–2". */
export const headToHeadLine = (me: string, record: HeadToHead): string => {
  const score = `${Math.max(record.wins, record.losses)}–${Math.min(record.wins, record.losses)}${record.ties ? ` (${record.ties} tied)` : ""}`;
  if (record.wins > record.losses) return `${me} leads ${record.opponent} ${score}`;
  if (record.losses > record.wins) return `${record.opponent} leads ${me} ${score}`;
  return `All square with ${record.opponent} ${record.wins}–${record.losses}${record.ties ? ` (${record.ties} tied)` : ""}`;
};
