import type { GolfGame } from "../domain/golf";
import type { GameRecord } from "../domain/records";

// Cloudflare Worker + D1 (see worker/). The previous Google Apps Script backend in apps-script/
// is no longer used by the app but still runs as a fallback, holding every round up to the move on 4 Nov 2026.
export const DARTY_GOLF_API_URL = "https://darty-golf-api.mattsdarts.workers.dev";
export const isCloudConnected = (): boolean => Boolean(DARTY_GOLF_API_URL);

export async function saveCompletedGame(game: GolfGame): Promise<void> {
  if (!DARTY_GOLF_API_URL || !game.completedAt) return;
  const response = await fetch(DARTY_GOLF_API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "saveGame", game }),
  });
  const payload = await response.json() as { ok: boolean; message?: string };
  if (!payload.ok) throw new Error(payload.message || "The game could not be saved.");
}

export async function fetchRecords(): Promise<GameRecord[]> {
  if (!DARTY_GOLF_API_URL) return [];
  const response = await fetch(`${DARTY_GOLF_API_URL}?action=records`);
  const payload = await response.json() as { ok: boolean; records?: GameRecord[]; message?: string };
  if (!payload.ok) throw new Error(payload.message || "Records could not be loaded.");
  return payload.records ?? [];
}
