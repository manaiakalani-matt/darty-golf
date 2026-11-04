/**
 * Server-side checks for a finished Darty Golf round.
 *
 * Anyone can send a request to the API, so nothing is trusted as sent: the
 * game is rebuilt from scratch, keeping only fields that pass strict checks.
 */

export interface CleanCompetitor {
  id: string;
  name: string;
  scores: number[];
}

export interface CleanGame {
  id: string;
  mode: "solo" | "group";
  holes: 9 | 18;
  createdAt: string;
  completedAt: string;
  competitors: CleanCompetitor[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const fail = (message: string): never => { throw new ValidationError(message); };

const cleanDate = (value: unknown, label: string): string => {
  const date = new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) fail(`The ${label} is not valid.`);
  return date.toISOString();
};

export const cleanGame = (raw: unknown): CleanGame => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail("A completed Darty Golf game is required.");
  const game = raw as Record<string, unknown>;

  const id = typeof game.id === "string" ? game.id : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) fail("The game ID is not valid.");
  if (game.mode !== "solo" && game.mode !== "group") fail("The game mode is not valid.");
  const mode = game.mode as "solo" | "group";
  if (game.holes !== 9 && game.holes !== 18) fail("A round must be 9 or 18 holes.");
  const holes = game.holes as 9 | 18;
  const createdAt = cleanDate(game.createdAt, "start time");
  const completedAt = cleanDate(game.completedAt, "finish time");

  const rawCompetitors = game.competitors;
  if (!Array.isArray(rawCompetitors) || rawCompetitors.length < 1 || rawCompetitors.length > 8) fail("A round needs 1 to 8 players.");
  const list = rawCompetitors as unknown[];
  if (mode === "solo" && list.length !== 1) fail("A solo round has one player.");

  const seen = new Set<string>();
  const competitors = list.map((entry): CleanCompetitor => {
    const competitor = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const name = typeof competitor.name === "string" ? competitor.name.trim() : "";
    if (!name || name.length > 28) fail("Each player needs a name of up to 28 characters.");
    if (seen.has(name.toLowerCase())) fail("Player names must be different.");
    seen.add(name.toLowerCase());
    const scores = competitor.scores;
    if (!Array.isArray(scores) || scores.length !== holes) fail("Every player needs a score for each hole.");
    const cleanScores = (scores as unknown[]).map((score) => {
      if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 7) {
        fail("Each hole score must be a whole number from 1 to 7.");
      }
      return score as number;
    });
    return { id: typeof competitor.id === "string" ? competitor.id.slice(0, 64) : "", name, scores: cleanScores };
  });

  return { id, mode, holes, createdAt, completedAt, competitors };
};

export const totalOf = (competitor: { scores: number[] }): number =>
  competitor.scores.reduce((sum, score) => sum + score, 0);

/** Lowest total wins; ties share the win, joined the same way the Sheets backend did. */
export const winnersOf = (game: CleanGame): string => {
  const lowest = Math.min(...game.competitors.map(totalOf));
  return game.competitors.filter((competitor) => totalOf(competitor) === lowest).map((competitor) => competitor.name).join(" & ");
};
