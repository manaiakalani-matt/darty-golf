import { isGolfGame, type GolfGame } from "../domain/golf";

/**
 * Everything Darty Golf keeps on the scoring device.
 *
 * - The active round is saved after every throw, so a reload, a crash or iOS
 *   putting the tab to sleep never loses a game in progress.
 * - Finished rounds wait in an outbox until the Google Sheet confirms it has
 *   them, so a dropped connection at the end of a game never loses a result.
 *
 * Storage can be unavailable (private browsing, blocked site data), so every
 * read and write is wrapped and the app keeps working without it.
 */

const ACTIVE_KEY = "darty-golf:active-round";
const OUTBOX_KEY = "darty-golf:outbox";

type KeyValueStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const defaultStore = (): KeyValueStore | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

const readJson = (store: KeyValueStore | null, key: string): unknown => {
  try {
    const raw = store?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJson = (store: KeyValueStore | null, key: string, value: unknown): boolean => {
  try {
    if (!store) return false;
    if (value === null) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

export const loadActiveRound = (store = defaultStore()): GolfGame | null => {
  const game = readJson(store, ACTIVE_KEY);
  return isGolfGame(game) && !game.completedAt ? game : null;
};

export const saveActiveRound = (game: GolfGame | null, store = defaultStore()): boolean =>
  writeJson(store, ACTIVE_KEY, game);

export const loadOutbox = (store = defaultStore()): GolfGame[] => {
  const games = readJson(store, OUTBOX_KEY);
  return Array.isArray(games) ? games.filter((game): game is GolfGame => isGolfGame(game) && Boolean(game.completedAt)) : [];
};

/** Adds a finished round to the outbox. Returns false if the device could not store it. */
export const addToOutbox = (game: GolfGame, store = defaultStore()): boolean => {
  const others = loadOutbox(store).filter((queued) => queued.id !== game.id);
  return writeJson(store, OUTBOX_KEY, [...others, game]);
};

export const removeFromOutbox = (gameId: string, store = defaultStore()): void => {
  const remaining = loadOutbox(store).filter((queued) => queued.id !== gameId);
  writeJson(store, OUTBOX_KEY, remaining.length ? remaining : null);
};

const PLAYERS_KEY = "darty-golf:recent-players";
const MAX_RECENT_PLAYERS = 12;

/** Names of people who've played on this phone, most recent first. */
export const loadRecentPlayers = (store = defaultStore()): string[] => {
  const names = readJson(store, PLAYERS_KEY);
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string" && Boolean(name.trim())).slice(0, MAX_RECENT_PLAYERS) : [];
};

export const rememberPlayers = (names: string[], store = defaultStore()): void => {
  const fresh = names.map((name) => name.trim()).filter(Boolean);
  const seen = new Set(fresh.map((name) => name.toLowerCase()));
  const older = loadRecentPlayers(store).filter((name) => !seen.has(name.toLowerCase()));
  writeJson(store, PLAYERS_KEY, [...fresh, ...older].slice(0, MAX_RECENT_PLAYERS));
};

export const forgetPlayer = (name: string, store = defaultStore()): void => {
  writeJson(store, PLAYERS_KEY, loadRecentPlayers(store).filter((saved) => saved.toLowerCase() !== name.toLowerCase()));
};

/**
 * Tries to upload every waiting round. Rounds that upload are removed; the
 * rest stay for next time. Returns how many are still waiting.
 */
export const flushOutbox = async (
  upload: (game: GolfGame) => Promise<void>,
  store = defaultStore(),
): Promise<number> => {
  for (const game of loadOutbox(store)) {
    try {
      await upload(game);
      removeFromOutbox(game.id, store);
    } catch {
      // Leave it queued; the next flush will retry.
    }
  }
  return loadOutbox(store).length;
};
