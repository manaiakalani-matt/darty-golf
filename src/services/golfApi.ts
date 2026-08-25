import type { GolfGame } from "../domain/golf";

// Add the deployed Apps Script /exec URL here after following apps-script/README.md.
export const DARTY_GOLF_API_URL = "";
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
