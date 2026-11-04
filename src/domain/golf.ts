export type GameMode = "solo" | "group";

export const RESULTS = [
  { strokes: 1, short: "D", label: "Double", detail: "Hole in one" },
  { strokes: 2, short: "T", label: "Treble", detail: "Two strokes" },
  { strokes: 3, short: "S", label: "Small single", detail: "Inner single" },
  { strokes: 4, short: "L", label: "Large single", detail: "Outer single" },
  { strokes: 5, short: "×", label: "Wrong number", detail: "Hit another number" },
  { strokes: 6, short: "O", label: "Outside board", detail: "Non-scoring board area" },
  { strokes: 7, short: "B", label: "Bounce Out / Off The Board", detail: "Bounced out or missed the board completely" },
] as const;

export type Stroke = (typeof RESULTS)[number]["strokes"];

export interface Competitor {
  id: string;
  name: string;
  scores: Array<Stroke | null>;
}

export interface GolfGame {
  id: string;
  mode: GameMode;
  holes: 9 | 18;
  createdAt: string;
  completedAt: string | null;
  currentHole: number;
  currentCompetitor: number;
  competitors: Competitor[];
}

export const totalScore = (competitor: Competitor): number =>
  competitor.scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);

export const completedHoles = (competitor: Competitor): number =>
  competitor.scores.filter((score) => score !== null).length;

export const scoreToPar = (competitor: Competitor): number =>
  totalScore(competitor) - completedHoles(competitor) * 3;

export const formatToPar = (value: number): string => value === 0 ? "E" : value > 0 ? `+${value}` : `${value}`;

export const PAR = 3;

export type HoleTone = "ace" | "under" | "par" | "over" | "disaster";

/** What a hole score is called on a par-3 golf card. */
export const holeOutcome = (strokes: Stroke): { name: string; tone: HoleTone } => {
  switch (strokes) {
    case 1: return { name: "Hole in one", tone: "ace" };
    case 2: return { name: "Birdie", tone: "under" };
    case 3: return { name: "Par", tone: "par" };
    case 4: return { name: "Bogey", tone: "over" };
    case 5: return { name: "Double bogey", tone: "over" };
    case 6: return { name: "Triple bogey", tone: "disaster" };
    default: return { name: "Quadruple bogey", tone: "disaster" };
  }
};

export interface Standing {
  competitor: Competitor;
  index: number;
  toPar: number;
  thru: number;
  /** "1", "2", or "T2" when tied. */
  position: string;
}

/** Golf-style standings: ordered by score to par, ties sharing a position. */
export const standings = (game: GolfGame): Standing[] => {
  const rows = game.competitors
    .map((competitor, index) => ({ competitor, index, toPar: scoreToPar(competitor), thru: completedHoles(competitor) }))
    .sort((a, b) => a.toPar - b.toPar || a.index - b.index);
  return rows.map((row) => {
    const rank = rows.findIndex((other) => other.toPar === row.toPar) + 1;
    const tied = rows.filter((other) => other.toPar === row.toPar).length > 1;
    return { ...row, position: `${tied ? "T" : ""}${rank}` };
  });
};

/** One line of context for the player about to throw, e.g. "2 behind Daz with 12 to play". */
export const stakesLine = (game: GolfGame, index: number): string => {
  const me = game.competitors[index];
  const toPlay = game.holes - completedHoles(me);
  const playing = `${toPlay} to play`;
  if (game.competitors.length === 1) {
    return completedHoles(me) === 0 ? `${game.holes} holes to play` : `${formatToPar(scoreToPar(me))} with ${playing}`;
  }
  const table = standings(game);
  const mine = table.find((row) => row.index === index)!;
  const best = table[0].toPar;
  const leaders = table.filter((row) => row.toPar === best);
  if (table.every((row) => row.thru === 0)) return `${game.holes} holes to play`;
  if (mine.toPar === best) {
    if (leaders.length > 1) return `Tied for the lead with ${playing}`;
    const gap = table[1].toPar - best;
    return `Leading by ${gap} with ${playing}`;
  }
  const leaderName = leaders.length > 1 ? "the leaders" : leaders[0].competitor.name;
  return `${mine.toPar - best} behind ${leaderName} with ${playing}`;
};

/** True when this hole and the player's previous one were both holes in one. */
export const isBackToBackAce = (scores: Array<Stroke | null>, holeIndex: number): boolean =>
  holeIndex > 0 && scores[holeIndex] === 1 && scores[holeIndex - 1] === 1;

export interface Award {
  title: string;
  winners: string[];
  detail: string;
}

/** Fun end-of-round awards. Only awards someone actually earned are returned. */
export const roundAwards = (game: GolfGame): Award[] => {
  const awards: Award[] = [];
  const count = (competitor: Competitor, test: (score: Stroke) => boolean) =>
    competitor.scores.filter((score): score is Stroke => score !== null && test(score)).length;

  const aces = game.competitors.flatMap((competitor) => competitor.scores
    .map((score, hole) => (score === 1 ? `${competitor.name} on ${hole + 1}` : null))
    .filter((entry): entry is string => entry !== null));
  // At this club players aim for the double, so holes in one are common: list a couple, otherwise crown the leader.
  if (aces.length > 0 && aces.length <= 2) awards.push({ title: aces.length > 1 ? "Holes in one" : "Hole in one", winners: [], detail: aces.join(", ") });

  const mostOf = (title: string, test: (score: Stroke) => boolean, unit: (n: number) => string) => {
    const tallies = game.competitors.map((competitor) => ({ name: competitor.name, n: count(competitor, test) }));
    const best = Math.max(...tallies.map((tally) => tally.n));
    if (best === 0) return;
    const winners = tallies.filter((tally) => tally.n === best).map((tally) => tally.name);
    if (game.competitors.length > 1 && winners.length === game.competitors.length) return; // everyone tied: no award
    awards.push({ title, winners, detail: unit(best) });
  };
  if (aces.length > 2) mostOf("Most holes in one", (score) => score === 1, (n) => `${n} hole${n === 1 ? "" : "s"} in one`);
  mostOf("Most birdies", (score) => score === 2, (n) => `${n} birdie${n === 1 ? "" : "s"}`);
  mostOf("Par machine", (score) => score === 3, (n) => `${n} par${n === 1 ? "" : "s"}`);
  mostOf("Bounce-out champ", (score) => score === 7, (n) => `${n} bounce-out${n === 1 ? "" : "s"}`);
  return awards;
};

/** Front-nine and back-nine totals, as on a real golf card. */
export const splitTotals = (scores: Array<number | null>): { out: number; in: number | null } => {
  const sum = (part: Array<number | null>) => part.reduce<number>((total, score) => total + (score ?? 0), 0);
  return { out: sum(scores.slice(0, 9)), in: scores.length > 9 ? sum(scores.slice(9)) : null };
};

export const winnerNames = (game: GolfGame): string[] => {
  const lowest = Math.min(...game.competitors.map(totalScore));
  return game.competitors.filter((competitor) => totalScore(competitor) === lowest).map((competitor) => competitor.name);
};

const isStroke = (value: unknown): value is Stroke =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;

/** Checks that data read back from storage is a playable game, so a corrupt save can never crash the app. */
export const isGolfGame = (value: unknown): value is GolfGame => {
  if (!value || typeof value !== "object") return false;
  const game = value as Partial<GolfGame>;
  if (typeof game.id !== "string" || (game.mode !== "solo" && game.mode !== "group")) return false;
  if (game.holes !== 9 && game.holes !== 18) return false;
  if (typeof game.createdAt !== "string" || (game.completedAt !== null && typeof game.completedAt !== "string")) return false;
  if (!Array.isArray(game.competitors) || game.competitors.length < 1 || game.competitors.length > 8) return false;
  if (typeof game.currentHole !== "number" || game.currentHole < 1 || game.currentHole > game.holes) return false;
  if (typeof game.currentCompetitor !== "number" || game.currentCompetitor < 0 || game.currentCompetitor >= game.competitors.length) return false;
  return game.competitors.every((competitor) => Boolean(competitor)
    && typeof competitor.id === "string"
    && typeof competitor.name === "string"
    && Array.isArray(competitor.scores)
    && competitor.scores.length === game.holes
    && competitor.scores.every((score) => score === null || isStroke(score)));
};

export const createGameId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === "x" ? random : (random & 0x3) | 0x8).toString(16);
  });
};

export const createGame = (mode: GameMode, names: string[], holes: 9 | 18 = 18): GolfGame => ({
  id: createGameId(),
  mode,
  holes,
  createdAt: new Date().toISOString(),
  completedAt: null,
  currentHole: 1,
  currentCompetitor: 0,
  competitors: names.map((name, index) => ({
    id: `${Date.now()}-${index}`,
    name: name.trim(),
    scores: Array.from({ length: holes }, () => null),
  })),
});

export const scoreHole = (game: GolfGame, score: Stroke): GolfGame => {
  if (game.completedAt) return game;
  const competitors = game.competitors.map((competitor, index) => index === game.currentCompetitor
    ? { ...competitor, scores: competitor.scores.map((old, hole) => hole === game.currentHole - 1 ? score : old) }
    : competitor);
  const lastCompetitor = game.currentCompetitor === game.competitors.length - 1;
  const lastHole = game.currentHole === game.holes;
  return {
    ...game,
    competitors,
    currentCompetitor: lastCompetitor ? 0 : game.currentCompetitor + 1,
    currentHole: lastCompetitor && !lastHole ? game.currentHole + 1 : game.currentHole,
    completedAt: lastCompetitor && lastHole ? new Date().toISOString() : null,
  };
};

export const undoLastScore = (game: GolfGame): GolfGame => {
  const completedScores = game.competitors.reduce((count, competitor) => count + completedHoles(competitor), 0);
  if (completedScores === 0) return game;

  const previousCompetitor = game.completedAt
    ? game.competitors.length - 1
    : game.currentCompetitor === 0 ? game.competitors.length - 1 : game.currentCompetitor - 1;
  const previousHole = game.completedAt
    ? game.holes
    : game.currentCompetitor === 0 ? game.currentHole - 1 : game.currentHole;
  const competitors = game.competitors.map((competitor, index) => index === previousCompetitor
    ? { ...competitor, scores: competitor.scores.map((score, hole) => hole === previousHole - 1 ? null : score) }
    : competitor);

  return {
    ...game,
    competitors,
    currentCompetitor: previousCompetitor,
    currentHole: previousHole,
    completedAt: null,
  };
};
