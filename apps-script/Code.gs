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

function saveGame_(game) {
  if (!game.id || !game.completedAt || !Array.isArray(game.competitors) || !game.competitors.length) throw new Error("The game is incomplete.");
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
    games.appendRow([game.id, game.createdAt, game.completedAt, game.mode, game.holes, winners, game.competitors.map(function (c) { return c.name; }).join(", "), JSON.stringify(game)]);
    var rows = [];
    game.competitors.forEach(function (competitor) {
      competitor.scores.forEach(function (score, index) { rows.push([game.id, competitor.name, index + 1, score, Number(score) - 3]); });
    });
    if (rows.length) sheet_(DG_SHEETS.scores).getRange(sheet_(DG_SHEETS.scores).getLastRow() + 1, 1, rows.length, 5).setValues(rows);
  } finally { lock.releaseLock(); }
}

function records_() {
  var games = sheet_(DG_SHEETS.games);
  if (games.getLastRow() < 2) return [];
  return games.getRange(2, 1, games.getLastRow() - 1, 8).getValues().map(function (row) {
    var game = JSON.parse(row[7]);
    var competitors = game.competitors.map(function (competitor) {
      return {
        name: competitor.name,
        total: competitor.scores.reduce(function (sum, score) { return sum + Number(score || 0); }, 0)
      };
    });
    return {
      id: String(row[0]),
      completedAt: String(row[2]),
      mode: String(row[3]),
      holes: Number(row[4]),
      winner: String(row[5]),
      competitors: competitors,
      lowestScore: Math.min.apply(null, competitors.map(function (competitor) { return competitor.total; }))
    };
  }).sort(function (a, b) { return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(); });
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
