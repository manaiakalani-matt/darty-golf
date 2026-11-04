-- Darty Golf: one row per finished round, one row per player per hole.
-- Mirrors the Games and Scores tabs of the original Google Sheet, but the
-- database itself refuses impossible values.

PRAGMA foreign_keys = ON;

CREATE TABLE games (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('solo', 'group')),
  holes INTEGER NOT NULL CHECK (holes IN (9, 18)),
  winner TEXT NOT NULL,
  competitors TEXT NOT NULL,
  lowest_score INTEGER NOT NULL,
  game_json TEXT NOT NULL CHECK (json_valid(game_json)),
  -- 'app' for rounds saved by the app, 'sheets-import' for rounds copied from the Google Sheet.
  source TEXT NOT NULL DEFAULT 'app',
  saved_at TEXT NOT NULL
);

CREATE INDEX idx_games_completed_at ON games(completed_at DESC);
CREATE INDEX idx_games_leaderboard ON games(holes, lowest_score);

CREATE TABLE scores (
  game_id TEXT NOT NULL,
  competitor TEXT NOT NULL,
  hole INTEGER NOT NULL CHECK (hole BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL CHECK (strokes BETWEEN 1 AND 7),
  to_par INTEGER NOT NULL,
  PRIMARY KEY (game_id, competitor, hole),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

CREATE INDEX idx_scores_competitor ON scores(competitor);
