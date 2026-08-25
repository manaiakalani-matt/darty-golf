import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  RESULTS, completedHoles, createGame, scoreHole,
  totalScore, undoLastScore, winnerNames, type GameMode, type GolfGame, type Stroke,
} from "./domain/golf";
import { topRecords, type GameRecord } from "./domain/records";
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
        <button className={mode === "group" ? "active" : ""} onClick={() => chooseMode("group")}>Group</button>
      </div>
      <div className="segmented compact" aria-label="Round length">
        <button className={holes === 9 ? "active" : ""} onClick={() => setHoles(9)}>Front 9</button>
        <button className={holes === 18 ? "active" : ""} onClick={() => setHoles(18)}>Full 18</button>
      </div>

      <div className="names">
        {names.map((name, index) => <label key={index}>
          {mode === "solo" ? "Player name" : `Player ${index + 1}`}
          <input value={name} maxLength={28} autoFocus={index === 0} placeholder={mode === "solo" ? "Your name" : `Player ${index + 1} name`}
            onChange={(event) => setNames(names.map((old, i) => i === index ? event.target.value : old))} />
        </label>)}
      </div>
      {mode === "group" && names.length < 8 && <button className="text-button" onClick={() => setNames([...names, ""])}>+ Add another player</button>}
      {mode === "group" && names.length > 2 && <button className="text-button danger" onClick={() => setNames(names.slice(0, -1))}>Remove last player</button>}
      <button className="primary" disabled={!canStart} onClick={() => onStart(createGame(mode, names, holes))}>Tee off</button>
    </section>

    <section className="rules card">
      <h2>Quick rules</h2>
      <p>Throw up to three darts. When you are finished, tap where your final dart landed—only that result is scored.</p>
      <div className="rule-grid">{RESULTS.map((result) => <div key={result.strokes}><b>{result.strokes}</b><span>{result.label}</span></div>)}</div>
    </section>
  </main>;
}

function TopRounds({ title, records, onSelect }: { title: string; records: GameRecord[]; onSelect: (record: GameRecord) => void }) {
  return <section className="top-rounds card">
    <h2>{title}</h2>
    {records.length === 0 ? <p className="empty-list">No completed rounds yet</p> : <ol>
      {records.map((record) => <li key={record.id}>
        <button onClick={() => onSelect(record)}>
          <span className="rank" aria-hidden="true" />
          <span><strong>{record.winner}</strong><small>{record.mode === "solo" ? "Solo" : "Group"}</small></span>
          <b>{record.lowestScore}</b>
        </button>
      </li>)}
    </ol>}
  </section>;
}

function RecordScoreSheet({ record, onClose }: { record: GameRecord; onClose: () => void }) {
  return <div className="score-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="score-sheet-modal card" role="dialog" aria-modal="true" aria-labelledby="score-sheet-title">
      <div className="score-sheet-head">
        <div><p className="eyebrow">{record.holes}-hole score sheet</p><h2 id="score-sheet-title">{record.winner}</h2></div>
        <button className="score-toggle" onClick={onClose} aria-label="Close score sheet">Close</button>
      </div>
      <div className="scorecard-wrap">
        <table className="scorecard">
          <thead><tr><th>Hole</th>{record.competitors.map((competitor) => <th key={competitor.name}>{competitor.name}</th>)}</tr></thead>
          <tbody>{Array.from({ length: record.holes }, (_, index) => <tr key={index}>
            <th>{index + 1}</th>{record.competitors.map((competitor) => <td key={competitor.name}>{competitor.scores[index] ?? "–"}</td>)}
          </tr>)}</tbody>
          <tfoot><tr><th>Total</th>{record.competitors.map((competitor) => <td key={competitor.name}>{competitor.total}</td>)}</tr></tfoot>
        </table>
      </div>
    </section>
  </div>;
}

function Records({ onHome }: { onHome: () => void }) {
  const [records, setRecords] = useState<GameRecord[] | null>(null);
  const [selected, setSelected] = useState<GameRecord | null>(null);
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

  const top9 = useMemo(() => topRecords(records ?? [], 9), [records]);
  const top18 = useMemo(() => topRecords(records ?? [], 18), [records]);
  const date = (value: string) => new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <main className="shell records-shell">
    <HomeNav view="records" onChange={(view) => view === "home" && onHome()} />
    <header className="records-header">
      <p className="eyebrow">Clubhouse history</p>
      <h1>Records</h1>
      <p>Lowest score wins. Tap any round to see its full score sheet.</p>
    </header>

    {records === null ? <section className="card records-message"><span className="loader" />Loading records…</section> : <>
      <section className="top-rounds-grid">
        <TopRounds title="Top 5 · Front 9" records={top9} onSelect={setSelected} />
        <TopRounds title="Top 5 · Full 18" records={top18} onSelect={setSelected} />
      </section>

      {error && <section className="card records-message error">{error}<button className="text-button" onClick={load}>Try again</button></section>}
      {!error && records.length === 0 && <section className="card records-message">No rounds yet. Complete a game to set the first record.</section>}

      {records.length > 0 && <section className="recent-records">
        <div className="section-title"><div><p className="eyebrow">Score archive</p><h2>Latest games</h2></div><button className="score-toggle" onClick={load}>Refresh</button></div>
        {records.map((record) => <button className="game-record card" key={record.id} onClick={() => setSelected(record)}>
          <span><strong>{record.winner}</strong><small>{record.mode === "solo" ? "Solo round" : "Group round"} · {record.holes} holes · {date(record.completedAt)}</small></span>
          <b>{record.lowestScore}</b>
        </button>)}
      </section>}
    </>}
    {selected && <RecordScoreSheet record={selected} onClose={() => setSelected(null)} />}
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

const polarPoint = (radius: number, angle: number): [number, number] => {
  const radians = angle * Math.PI / 180;
  return [180 + radius * Math.cos(radians), 292 + radius * Math.sin(radians)];
};

const wedgePath = (inner: number, outer: number, start: number, end: number): string => {
  const [outerStartX, outerStartY] = polarPoint(outer, start);
  const [outerEndX, outerEndY] = polarPoint(outer, end);
  const [innerEndX, innerEndY] = polarPoint(inner, end);
  const [innerStartX, innerStartY] = polarPoint(inner, start);
  return `M ${outerStartX} ${outerStartY} A ${outer} ${outer} 0 0 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${inner} ${inner} 0 0 0 ${innerStartX} ${innerStartY} Z`;
};

function DartboardSegment({ hole, onScore }: { hole: number; onScore: (score: Stroke) => void }) {
  const boardOrder = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const redRing = boardOrder.indexOf(hole) % 2 === 0;
  const ring = redRing ? "red" : "green";
  const single = redRing ? "dark" : "light";
  const adjacentRing = redRing ? "green" : "red";
  const adjacentSingle = redRing ? "light" : "dark";
  const activate = (score: Stroke) => onScore(score);
  const keyActivate = (event: KeyboardEvent<SVGGElement>, score: Stroke) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(score); }
  };
  const zone = (score: Stroke, label: string, children: ReactNode) => <g className="svg-zone"
    role="button" tabIndex={0} aria-label={`${label}, ${score} ${score === 1 ? "stroke" : "strokes"}`}
    onClick={() => activate(score)} onKeyDown={(event) => keyActivate(event, score)}>{children}</g>;

  return <section className="dartboard-picker" aria-label="Where did the dart land?">
    <svg className="dartboard-segment" viewBox="0 0 360 310" role="img" aria-label={`Dartboard segment for target ${hole}`}>
      <defs>
        <filter id="board-shadow" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#09251b" floodOpacity=".22" /></filter>
      </defs>
      <g filter="url(#board-shadow)">
        {zone(5, "Wrong number", <>
          <path className={`board-single ${adjacentSingle}`} d={wedgePath(24, 242, -128, -111)} />
          <path className={`board-ring ${adjacentRing}`} d={wedgePath(220, 242, -128, -111)} />
          <path className={`board-ring ${adjacentRing}`} d={wedgePath(130, 151, -128, -111)} />
          <text className={`board-number adjacent ${adjacentSingle}`} x="91" y="151">5</text>
          <path className={`board-single ${adjacentSingle}`} d={wedgePath(24, 242, -69, -52)} />
          <path className={`board-ring ${adjacentRing}`} d={wedgePath(220, 242, -69, -52)} />
          <path className={`board-ring ${adjacentRing}`} d={wedgePath(130, 151, -69, -52)} />
          <text className={`board-number adjacent ${adjacentSingle}`} x="269" y="151">5</text>
        </>)}
        {zone(6, "Outside board", <><path className="board-outside" d={wedgePath(242, 267, -111, -69)} /><text className="board-number outside" x="180" y="36">6</text></>)}
        {zone(1, "Double", <><path className={`board-ring ${ring}`} d={wedgePath(220, 242, -111, -69)} /><text className="board-number ring" x="180" y="67">1</text></>)}
        {zone(4, "Large single", <><path className={`board-single ${single}`} d={wedgePath(151, 220, -111, -69)} /><text className="board-number" x="180" y="109">4</text></>)}
        {zone(2, "Treble", <><path className={`board-ring ${ring}`} d={wedgePath(130, 151, -111, -69)} /><text className="board-number ring" x="180" y="153">2</text></>)}
        {zone(3, "Small single", <><path className={`board-single ${single}`} d={wedgePath(24, 130, -111, -69)} /><text className="board-number" x="180" y="213">3</text></>)}
        <circle className="board-bull-outer" cx="180" cy="292" r="24" /><circle className="board-bull" cx="180" cy="292" r="10" />
      </g>
    </svg>
    <button className="bounce-zone" onClick={() => activate(7)} aria-label="Bounce Out / Off The Board, 7 strokes">
      <span className="bounce-arrow">↩</span><span className="zone-score">7</span><span><b>Bounce out</b><small>or off the board</small></span>
    </button>
  </section>;
}

function Play({ game, setGame, onNew, onRecords }: { game: GolfGame; setGame: (game: GolfGame) => void; onNew: () => void; onRecords: () => void }) {
  const active = game.competitors[game.currentCompetitor];
  const canUndo = game.competitors.some((competitor) => completedHoles(competitor) > 0);
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
        {leaders.map((competitor, index) => <div className="leader-row" key={competitor.id}><span className="place">{index + 1}</span><strong>{competitor.name}</strong><b>{totalScore(competitor)}</b></div>)}
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
      <div className="round-line"><span>Current score</span><strong>{totalScore(active)}</strong></div>
    </section>

    <section className="score-prompt">
      <strong>Score your final dart</strong>
      <p>Tap where it landed to move to the next turn.</p>
    </section>

    <DartboardSegment hole={game.currentHole} onScore={(score) => setGame(scoreHole(game, score))} />

    <div className="round-actions">
      <button className="secondary" disabled={!canUndo} onClick={() => setGame(undoLastScore(game))}>Undo last score</button>
      <button className="exit-button" onClick={() => window.confirm("Exit this round? Your unfinished scores will be lost.") && onNew()}>Exit round</button>
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
