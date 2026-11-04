/** @OnlyCurrentDoc */

var DG_SHEETS = {
  games: { name: "Games", headers: ["id", "createdAt", "completedAt", "mode", "holes", "winner", "competitors", "gameJson"] },
  scores: { name: "Scores", headers: ["gameId", "competitor", "hole", "strokes", "toPar"] },
  rules: { name: "Rules", headers: ["strokes", "result", "description"] }
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu("Darty Golf").addItem("Set up sheets", "setupDartyGolf").addToUi();
}

function setupDartyGolf() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(DG_SHEETS).forEach(function (key) { ensureSheet_(spreadsheet, DG_SHEETS[key]); });
  var rules = spreadsheet.getSheetByName(DG_SHEETS.rules.name);
  if (rules.getLastRow() < 2) rules.getRange(2, 1, 7, 3).setValues([
    [1, "Double", "Hole in one"], [2, "Treble", "Two strokes"], [3, "Small single", "Inner single"],
    [4, "Large single", "Outer single"], [5, "Wrong number", "Hit another number"],
    [6, "Outside board", "Non-scoring part of the physical board"], [7, "Bounce Out / Off The Board", "Dart bounced out or missed the board completely"]
  ]);
  return "Darty Golf sheets are ready.";
}

function doGet(event) {
  try {
    if (event && event.parameter && event.parameter.action === "records") return json_({ ok: true, records: records_() });
    return json_({ ok: true, app: "Darty Golf", status: "ready" });
  } catch (error) { return json_({ ok: false, message: String(error.message || error) }); }
}

function doPost(event) {
  try {
    var request = JSON.parse((event && event.postData && event.postData.contents) || "{}");
    if (request.action !== "saveGame" || !request.game) throw new Error("A completed Darty Golf game is required.");
    saveGame_(request.game);
    return json_({ ok: true });
  } catch (error) { return json_({ ok: false, message: String(error.message || error) }); }
}

/**
 * Rebuilds the incoming game from scratch, keeping only fields that pass strict checks.
 * Anyone with the web-app URL can POST here, so nothing is trusted as sent.
 */
function cleanGame_(raw) {
  if (!raw || typeof raw !== "object") throw new Error("A completed Darty Golf game is required.");
  var id = String(raw.id || "");
  if (!/^[A-Za-z0-9-]{8,64}$/.test(id)) throw new Error("The game ID is not valid.");
  if (raw.mode !== "solo" && raw.mode !== "group") throw new Error("The game mode is not valid.");
  var holes = Number(raw.holes);
  if (holes !== 9 && holes !== 18) throw new Error("A round must be 9 or 18 holes.");
  var createdAt = cleanDate_(raw.createdAt, "start time");
  var completedAt = cleanDate_(raw.completedAt, "finish time");
  if (!Array.isArray(raw.competitors) || raw.competitors.length < 1 || raw.competitors.length > 8) throw new Error("A round needs 1 to 8 players.");
  if (raw.mode === "solo" && raw.competitors.length !== 1) throw new Error("A solo round has one player.");
  var seen = {};
  var competitors = raw.competitors.map(function (competitor) {
    var name = String((competitor && competitor.name) || "").trim();
    if (!name || name.length > 28) throw new Error("Each player needs a name of up to 28 characters.");
    if (seen[name.toLowerCase()]) throw new Error("Player names must be different.");
    seen[name.toLowerCase()] = true;
    var scores = competitor.scores;
    if (!Array.isArray(scores) || scores.length !== holes) throw new Error("Every player needs a score for each hole.");
    scores = scores.map(function (score) {
      if (typeof score !== "number" || score % 1 !== 0 || score < 1 || score > 7) throw new Error("Each hole score must be a whole number from 1 to 7.");
      return score;
    });
    return { id: String(competitor.id || "").slice(0, 64), name: name, scores: scores };
  });
  return { id: id, mode: raw.mode, holes: holes, createdAt: createdAt, completedAt: completedAt, competitors: competitors };
}

function cleanDate_(value, label) {
  var date = new Date(String(value || ""));
  if (isNaN(date.getTime())) throw new Error("The " + label + " is not valid.");
  return date.toISOString();
}

/**
 * Stops text from being run as a spreadsheet formula. Sheets treats a cell that
 * starts with = + - @ as a formula, so a player called "=IMPORTXML(...)" could
 * otherwise run code in the sheet. A leading apostrophe forces plain text.
 */
function safeText_(value) {
  var text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function saveGame_(rawGame) {
  var game = cleanGame_(rawGame);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var games = sheet_(DG_SHEETS.games);
    if (findRow_(games, game.id)) return;
    var totals = game.competitors.map(function (competitor) {
      return competitor.scores.reduce(function (sum, score) { return sum + Number(score || 0); }, 0);
    });
    var lowest = Math.min.apply(null, totals);
    var winners = game.competitors.filter(function (_, index) { return totals[index] === lowest; }).map(function (competitor) { return competitor.name; }).join(" & ");
    games.appendRow([game.id, game.createdAt, game.completedAt, game.mode, game.holes, safeText_(winners), safeText_(game.competitors.map(function (c) { return c.name; }).join(", ")), JSON.stringify(game)]);
    var rows = [];
    game.competitors.forEach(function (competitor) {
      competitor.scores.forEach(function (score, index) { rows.push([game.id, safeText_(competitor.name), index + 1, score, score - 3]); });
    });
    if (rows.length) sheet_(DG_SHEETS.scores).getRange(sheet_(DG_SHEETS.scores).getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  } finally { lock.releaseLock(); }
}

function records_() {
  var games = sheet_(DG_SHEETS.games);
  if (games.getLastRow() < 2) return [];
  var records = [];
  games.getRange(2, 1, games.getLastRow() - 1, 8).getValues().forEach(function (row) {
    // One damaged or hand-edited row should not take down the whole leaderboard.
    try { records.push(recordFromRow_(row)); } catch (error) { console.warn("Skipping unreadable game row " + row[0] + ": " + error); }
  });
  return records.sort(function (a, b) { return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(); });
}

function recordFromRow_(row) {
    var game = JSON.parse(row[7]);
    var competitors = game.competitors.map(function (competitor) {
      return {
        name: competitor.name,
        total: competitor.scores.reduce(function (sum, score) { return sum + Number(score || 0); }, 0),
        scores: competitor.scores.map(function (score) { return Number(score || 0); })
      };
    });
    return {
      id: String(row[0]),
      // Read the ISO time from the stored JSON: Sheets turns the date column into a Date object,
      // whose String() form is not reliably parsed by older Safari.
      completedAt: String(game.completedAt || row[2]),
      mode: String(row[3]),
      holes: Number(row[4]),
      winner: String(row[5]),
      competitors: competitors,
      lowestScore: Math.min.apply(null, competitors.map(function (competitor) { return competitor.total; }))
    };
}

function ensureSheet_(spreadsheet, definition) {
  var sheet = spreadsheet.getSheetByName(definition.name) || spreadsheet.insertSheet(definition.name);
  sheet.getRange(1, 1, 1, definition.headers.length).setValues([definition.headers]).setFontWeight("bold").setBackground("#d9ead3");
  sheet.setFrozenRows(1);
  return sheet;
}

function sheet_(definition) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(definition.name);
  if (!sheet) throw new Error("Run setupDartyGolf first.");
  return sheet;
}

function findRow_(sheet, id) {
  if (sheet.getLastRow() < 2) return 0;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) if (String(values[i][0]) === String(id)) return i + 2;
  return 0;
}

function json_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
