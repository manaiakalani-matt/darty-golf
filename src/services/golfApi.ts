import type { GolfGame } from "../domain/golf";
import type { GameRecord } from "../domain/records";

export const DARTY_GOLF_API_URL = "https://script.google.com/macros/s/AKfycbx16vpj0FIFRm1fyBhA3x12RTO936-2oLBPXWsMdpwCbCoDg5OcSZ0xyY5Wp3TReCPxUw/exec";
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
