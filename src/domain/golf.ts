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

export const winnerNames = (game: GolfGame): string[] => {
  const lowest = Math.min(...game.competitors.map(totalScore));
  return game.competitors.filter((competitor) => totalScore(competitor) === lowest).map((competitor) => competitor.name);
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
