import { useEffect, useMemo, useState } from "react";
import {
  RESULTS, bankScore, createGame, formatToPar, scoreToPar, throwDart,
  totalScore, undoDart, winnerNames, type GameMode, type GolfGame, type Stroke,
} from "./domain/golf";
import { bestRecord, recordedHoles, recordToPar, type GameRecord } from "./domain/records";
import { fetchRecords, isCloudConnected, saveCompletedGame } from "./services/golfApi";

type AppView = "home" | "records";

function HomeNav({ view, onChange }: { view: AppView; onChange: (view: AppView) => void }) {
  return <nav className="home-tabs" aria-label="Darty Golf sections">
    <button className={view === "home" ? "active" : ""} onClick={() => onChange("home")}>Home</button>
    <button className={view === "records" ? "active" : ""} onClick={() => onChange("records")}>Records</button>
  </nav>;
}

function Setup({ onStart, onRecords }: { onStart: (game: GolfGame) => void; onRecords: () => void }) {
  const [mode, setMode] = useState<GameMode>("solo");
  const [holes, setHoles] = useState<9 | 18>(18);
  const [names, setNames] = useState([""]);

  const chooseMode = (next: GameMode) => {
    setMode(next);
    setNames(next === "solo" ? [names[0] || ""] : ["", ""]);
  };
  const canStart = names.length > 0 && names.every((name) => name.trim()) && new Set(names.map((name) => name.trim().toLowerCase())).size === names.length;

  return <main className="shell setup-shell">
    <HomeNav view="home" onChange={(view) => view === "records" && onRecords()} />
    <header className="hero">
      <div className="flag">⛳</div>
      <p className="eyebrow">One dart counts. Every decision matters.</p>
      <h1>Darty Golf</h1>
      <p>Play holes 1–{holes}. Lowest score wins.</p>
    </header>

    <section className="card">
      <h2>Choose your round</h2>
      <div className="segmented" aria-label="Game mode">
        <button className={mode === "solo" ? "active" : ""} onClick={() => chooseMode("solo")}>Solo</button>
        <button className={mode === "teams" ? "active" : ""} onClick={() => chooseMode("teams")}>Teams</button>
      </div>
      <div className="segmented compact" aria-label="Round length">
        <button className={holes === 9 ? "active" : ""} onClick={() => setHoles(9)}>Front 9</button>
        <button className={holes === 18 ? "active" : ""} onClick={() => setHoles(18)}>Full 18</button>
      </div>

      <div className="names">
        {names.map((name, index) => <label key={index}>
          {mode === "solo" ? "Player name" : `Team ${index + 1}`}
          <input value={name} maxLength={28} autoFocus={index === 0} placeholder={mode === "solo" ? "Your name" : `Team ${index + 1} name`}
            onChange={(event) => setNames(names.map((old, i) => i === index ? event.target.value : old))} />
        </label>)}
      </div>
      {mode === "teams" && names.length < 8 && <button className="text-button" onClick={() => setNames([...names, ""])}>+ Add another team</button>}
      {mode === "teams" && names.length > 2 && <button className="text-button danger" onClick={() => setNames(names.slice(0, -1))}>Remove last team</button>}
      <button className="primary" disabled={!canStart} onClick={() => onStart(createGame(mode, names, holes))}>Tee off</button>
    </section>

    <section className="rules card">
      <h2>Quick rules</h2>
      <p>Throw once and bank it—or risk a mulligan. You may throw up to three darts, but only your latest dart counts.</p>
      <div className="rule-grid">{RESULTS.map((result) => <div key={result.strokes}><b>{result.strokes}</b><span>{result.label}</span></div>)}</div>
    </section>
  </main>;
}

function RecordHighlight({ label, record }: { label: string; record: GameRecord | null }) {
  return <article className="record-highlight">
    <span>{label}</span>
    {record ? <>
      <strong>{record.lowestScore}</strong>
      <b>{record.winner}</b>
      <small>{formatToPar(recordToPar(record))} to par</small>
    </> : <p>No completed rounds yet</p>}
  </article>;
}

function Records({ onHome }: { onHome: () => void }) {
  const [records, setRecords] = useState<GameRecord[] | null>(null);
  const [error, setError] = useState("");
  const load = () => {
    setRecords(null);
    setError("");
    fetchRecords().then(setRecords).catch(() => {
      setRecords([]);
      setError("Records could not be loaded. Please try again.");
    });
  };

  useEffect(load, []);

  const best9 = useMemo(() => bestRecord(records ?? [], 9), [records]);
  const best18 = useMemo(() => bestRecord(records ?? [], 18), [records]);
  const date = (value: string) => new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <main className="shell records-shell">
    <HomeNav view="records" onChange={(view) => view === "home" && onHome()} />
    <header className="records-header">
      <p className="eyebrow">Clubhouse history</p>
      <h1>Records</h1>
      <p>Lowest score wins. Nine and eighteen-hole records are ranked separately.</p>
    </header>

    {records === null ? <section className="card records-message"><span className="loader" />Loading records…</section> : <>
      <section className="record-highlights">
        <RecordHighlight label="Best front 9" record={best9} />
        <RecordHighlight label="Best full 18" record={best18} />
      </section>

      <section className="record-stats">
        <div><strong>{records.length}</strong><span>Rounds</span></div>
        <div><strong>{recordedHoles(records)}</strong><span>Player holes</span></div>
      </section>

      {error && <section className="card records-message error">{error}<button className="text-button" onClick={load}>Try again</button></section>}
      {!error && records.length === 0 && <section className="card records-message">No rounds yet. Complete a game to set the first record.</section>}

      {records.length > 0 && <section className="recent-records">
        <div className="section-title"><div><p className="eyebrow">Score archive</p><h2>Past games</h2></div><button className="score-toggle" onClick={load}>Refresh</button></div>
        {records.map((record) => <article className="game-record card" key={record.id}>
          <div className="game-record-head">
            <div><strong>{record.winner}</strong><span>{record.mode === "solo" ? "Solo round" : "Team match"} · {record.holes} holes</span></div>
            <div><b>{record.lowestScore}</b><small>{formatToPar(recordToPar(record))}</small></div>
          </div>
          <div className="record-competitors">
            {[...record.competitors].sort((a, b) => a.total - b.total).map((competitor) =>
              <div key={competitor.name}><span>{competitor.name}</span><b>{competitor.total}</b></div>)}
          </div>
          <time dateTime={record.completedAt}>{date(record.completedAt)}</time>
        </article>)}
      </section>}
    </>}
  </main>;
}

function Scorecard({ game }: { game: GolfGame }) {
  return <div className="scorecard-wrap">
    <table className="scorecard">
      <thead><tr><th>Hole</th>{game.competitors.map((competitor) => <th key={competitor.id}>{competitor.name}</th>)}</tr></thead>
      <tbody>{Array.from({ length: game.holes }, (_, index) => <tr className={game.currentHole === index + 1 && !game.completedAt ? "current" : ""} key={index}>
        <th>{index + 1}</th>{game.competitors.map((competitor) => <td key={competitor.id}>{competitor.scores[index] ?? "–"}</td>)}
      </tr>)}</tbody>
      <tfoot><tr><th>Total</th>{game.competitors.map((competitor) => <td key={competitor.id}>{totalScore(competitor)}</td>)}</tr></tfoot>
    </table>
  </div>;
}

function Play({ game, setGame, onNew, onRecords }: { game: GolfGame; setGame: (game: GolfGame) => void; onNew: () => void; onRecords: () => void }) {
  const active = game.competitors[game.currentCompetitor];
  const current = active.darts.at(-1);
  const result = RESULTS.find((item) => item.strokes === current);
  const [showCard, setShowCard] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const leaders = useMemo(() => [...game.competitors].sort((a, b) => totalScore(a) - totalScore(b)), [game]);

  useEffect(() => {
    if (!game.completedAt) return;
    if (!isCloudConnected()) {
      setSaveStatus("Saved on this device");
      return;
    }
    setSaveStatus("Saving…");
    saveCompletedGame(game).then(() => setSaveStatus("Round saved")).catch(() => setSaveStatus("Saved on this device"));
  }, [game.completedAt]);

  if (game.completedAt) {
    const winners = winnerNames(game);
    return <main className="shell results-shell">
      <header className="hero compact-hero"><div className="flag">🏆</div><p className="eyebrow">Clubhouse result</p><h1>{winners.join(" & ")}</h1><p>{winners.length > 1 ? "Finish tied for the lead" : "Wins Darty Golf"}</p></header>
      <section className="card leaderboard">
        {leaders.map((competitor, index) => <div className="leader-row" key={competitor.id}><span className="place">{index + 1}</span><strong>{competitor.name}</strong><span>{formatToPar(scoreToPar(competitor))}</span><b>{totalScore(competitor)}</b></div>)}
        <small>{saveStatus}</small>
      </section>
      <section className="card"><Scorecard game={game} /></section>
      <div className="result-actions">
        <button className="primary" onClick={onNew}>Play another round</button>
        <button className="secondary" onClick={onRecords}>View records</button>
      </div>
    </main>;
  }

  return <main className="shell play-shell">
    <header className="play-header">
      <div><p className="eyebrow">Hole {game.currentHole} of {game.holes}</p><h1>{active.name}</h1></div>
      <button className="score-toggle" onClick={() => setShowCard(!showCard)}>{showCard ? "Close" : "Scorecard"}</button>
    </header>
    {showCard && <section className="card overlay-card"><Scorecard game={game} /></section>}

    <section className="target-card">
      <p>Target number</p><div className="hole-number">{game.currentHole}</div>
      <div className="round-line"><span>Round {totalScore(active)}</span><span>{formatToPar(scoreToPar(active))} to par</span></div>
    </section>

    <section className="dart-state">
      <div className="dart-dots">{[0, 1, 2].map((index) => <span className={index < active.darts.length ? "used" : ""} key={index}>{active.darts[index] ?? index + 1}</span>)}</div>
      {result ? <div><strong>{result.label} · {result.strokes} {result.strokes === 1 ? "stroke" : "strokes"}</strong><p>{active.darts.length < 3 ? "Bank it, or risk another dart." : "Third dart thrown—bank this score."}</p></div>
        : <div><strong>Throw dart one</strong><p>Tap where it landed.</p></div>}
    </section>

    <section className="score-buttons">{RESULTS.map((item) => <button key={item.strokes} disabled={active.darts.length >= 3} onClick={() => setGame(throwDart(game, item.strokes as Stroke))}>
      <span className="stroke-number">{item.strokes}</span><span><b>{item.label}</b><small>{item.detail}</small></span>
    </button>)}</section>

    <div className="play-actions">
      <button className="secondary" disabled={!active.darts.length} onClick={() => setGame(undoDart(game))}>Undo dart</button>
      <button className="primary" disabled={!active.darts.length} onClick={() => setGame(bankScore(game))}>Bank {current ?? ""}</button>
    </div>
  </main>;
}

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [game, setGame] = useState<GolfGame | null>(null);
  const goHome = () => { setGame(null); setView("home"); };
  const goRecords = () => { setGame(null); setView("records"); };

  if (game) return <Play game={game} setGame={setGame} onNew={goHome} onRecords={goRecords} />;
  return view === "records" ? <Records onHome={goHome} /> : <Setup onStart={setGame} onRecords={goRecords} />;
}
