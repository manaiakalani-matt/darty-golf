/**
 * Darty Golf API: a Cloudflare Worker backed by a D1 database.
 *
 * It speaks the same small protocol as the original Google Apps Script, so the
 * app only needed its URL changed:
 *   GET  ?action=records              -> { ok, records }
 *   POST { action: "saveGame", game } -> { ok }
 */
import { cleanGame, totalOf, ValidationError, winnersOf, type CleanGame } from "./validate";

export interface Env {
  DB: D1Database;
}

/** Sites allowed to call this API from a browser. */
const ALLOWED_ORIGINS = new Set([
  "https://manaiakalani-matt.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost:5174", // safe local demo (npm run dev with VITE_DARTY_GOLF_API_URL)
]);

const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};

const json = (request: Request, payload: unknown, status = 200): Response =>
  Response.json(payload, { status, headers: corsHeaders(request) });

const MAX_BODY_BYTES = 32_000;

interface GameRow {
  id: string;
  completed_at: string;
  mode: string;
  holes: number;
  winner: string;
  lowest_score: number;
  game_json: string;
}

const listRecords = async (db: D1Database) => {
  const { results } = await db
    .prepare("SELECT id, completed_at, mode, holes, winner, lowest_score, game_json FROM games ORDER BY completed_at DESC")
    .all<GameRow>();
  return results.map((row) => {
    const game = JSON.parse(row.game_json) as CleanGame;
    return {
      id: row.id,
      completedAt: row.completed_at,
      mode: row.mode,
      holes: row.holes,
      winner: row.winner,
      competitors: game.competitors.map((competitor) => ({
        name: competitor.name,
        total: totalOf(competitor),
        scores: competitor.scores,
      })),
      lowestScore: row.lowest_score,
    };
  });
};

/** Saves a round. Saving the same round twice is harmless: the second save changes nothing. */
const saveGame = async (db: D1Database, game: CleanGame, source: string): Promise<boolean> => {
  const lowest = Math.min(...game.competitors.map(totalOf));
  const insertGame = db.prepare(
    `INSERT OR IGNORE INTO games (id, created_at, completed_at, mode, holes, winner, competitors, lowest_score, game_json, source, saved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    game.id, game.createdAt, game.completedAt, game.mode, game.holes, winnersOf(game),
    game.competitors.map((competitor) => competitor.name).join(", "), lowest,
    JSON.stringify(game), source, new Date().toISOString(),
  );
  const insertScore = db.prepare(
    "INSERT OR IGNORE INTO scores (game_id, competitor, hole, strokes, to_par) VALUES (?, ?, ?, ?, ?)",
  );
  const scoreRows = game.competitors.flatMap((competitor) =>
    competitor.scores.map((strokes, index) => insertScore.bind(game.id, competitor.name, index + 1, strokes, strokes - 3)));
  // A batch runs as one transaction: the game and all its scores are saved together or not at all.
  const [gameResult] = await db.batch([insertGame, ...scoreRows]);
  return gameResult.meta.changes > 0;
};

const readBody = async (request: Request): Promise<Record<string, unknown>> => {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ValidationError("The request is too large.");
  try {
    const body: unknown = JSON.parse(text || "{}");
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // Fall through to the error below.
  }
  throw new ValidationError("The request is not valid JSON.");
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
    try {
      if (request.method === "GET") {
        const action = new URL(request.url).searchParams.get("action");
        if (action === "records") return json(request, { ok: true, records: await listRecords(env.DB) });
        return json(request, { ok: true, app: "Darty Golf", status: "ready" });
      }
      if (request.method === "POST") {
        const body = await readBody(request);
        if (body.action !== "saveGame") throw new ValidationError("A completed Darty Golf game is required.");
        const game = cleanGame(body.game);
        const source = body.source === "sheets-import" ? "sheets-import" : "app";
        const created = await saveGame(env.DB, game, source);
        return json(request, { ok: true, created });
      }
      return json(request, { ok: false, message: "Method not allowed." }, 405);
    } catch (error) {
      if (error instanceof ValidationError) return json(request, { ok: false, message: error.message }, 400);
      console.error("Darty Golf API error", error);
      const message = request.method === "POST" ? "Something went wrong saving to the clubhouse." : "Something went wrong loading the clubhouse records.";
      return json(request, { ok: false, message }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
