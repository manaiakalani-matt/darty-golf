import { useEffect, useMemo, useState } from "react";
import { RESULTS, createGame, type GameMode, type GolfGame } from "./domain/golf";
import { assignColors, initialOf } from "./domain/players";
import { topRecords, type GameRecord } from "./domain/records";
import { Play } from "./components/Play";
import { ClubhouseRankings, PlayerProfileView } from "./components/Players";
import { Scorecard } from "./components/Scorecard";
import { buildProfiles } from "./domain/profiles";
import { fetchRecords, isCloudConnected, saveCompletedGame } from "./services/golfApi";
import {
  addToOutbox, flushOutbox, loadActiveRound, loadRecentPlayers, rememberPlayers, saveActiveRound,
} from "./services/localStore";

type AppView = "home" | "records";

function HomeNav({ view, onChange }: { view: AppView; onChange: (view: AppView) => void }) {
  return <nav className="home-tabs" aria-label="Darty Golf sections">
    <button className={view === "home" ? "active" : ""} onClick={() => onChange("home")}>Home</button>
    <button className={view === "records" ? "active" : ""} onClick={() => onChange("records")}>Records</button>
  </nav>;
}

function ResumeCard({ round, onResume, onDiscard }: { round: GolfGame; onResume: () => void; onDiscard: () => void }) {
  const players = round.competitors.map((competitor) => competitor.name).join(", ");
  const up = round.competitors[round.currentCompetitor];
  return <section className="card resume-card" aria-labelledby="resume-title">
    <p className="eyebrow">Round in progress</p>
    <h2 id="resume-title">Pick up where you left off?</h2>
    <p className="resume-detail"><strong>{players}</strong><span>Hole {round.currentHole} of {round.holes}{round.mode === "group" ? ` · ${up.name} to throw` : ""}</span></p>
    <button className="primary" onClick={onResume}>Resume round</button>
    <button className="text-button danger" onClick={() => window.confirm("Discard this unfinished round? Its scores will be lost.") && onDiscard()}>Discard and start fresh</button>
  </section>;
}

function Setup({ onStart, onRecords, savedRound, onResume, onDiscard }: {
  onStart: (game: GolfGame) => void; onRecords: () => void;
  savedRound: GolfGame | null; onResume: () => void; onDiscard: () => void;
}) {
  const [mode, setMode] = useState<GameMode>("solo");
  const [holes, setHoles] = useState<9 | 18>(18);
  const [names, setNames] = useState([""]);

  const [recent] = useState(loadRecentPlayers);
  const colors = assignColors(names.map((name) => name || "?"));

  const chooseMode = (next: GameMode) => {
    setMode(next);
    setNames(next === "solo" ? [names[0] || ""] : [names[0] || "", names[1] || ""]);
  };
  const isPicked = (name: string) => names.some((entry) => entry.trim().toLowerCase() === name.toLowerCase());
  /** Tapping a remembered name fills the next empty slot (adding one in group mode); tapping again removes it. */
  const togglePlayer = (name: string) => {
    if (isPicked(name)) {
      const kept = names.filter((entry) => entry.trim().toLowerCase() !== name.toLowerCase());
      const minimum = mode === "solo" ? 1 : 2;
      setNames([...kept, ...Array<string>(Math.max(0, minimum - kept.length)).fill("")]);
      return;
    }
    if (mode === "solo") { setNames([name]); return; }
    const empty = names.findIndex((entry) => !entry.trim());
    if (empty >= 0) setNames(names.map((entry, i) => (i === empty ? name : entry)));
    else if (names.length < 8) setNames([...names, name]);
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

    {savedRound && <ResumeCard round={savedRound} onResume={onResume} onDiscard={onDiscard} />}

    <section className="card">
      <h2>{savedRound ? "Or start a new round" : "Choose your round"}</h2>
      <div className="segmented" aria-label="Game mode">
        <button className={mode === "solo" ? "active" : ""} onClick={() => chooseMode("solo")}>Solo</button>
        <button className={mode === "group" ? "active" : ""} onClick={() => chooseMode("group")}>Group</button>
      </div>
      <div className="segmented compact" aria-label="Round length">
        <button className={holes === 9 ? "active" : ""} onClick={() => setHoles(9)}>Front 9</button>
        <button className={holes === 18 ? "active" : ""} onClick={() => setHoles(18)}>Full 18</button>
      </div>

      {recent.length > 0 && <div className="recent-players" role="group" aria-label="Recent players">
        <p className="recent-label">Tap to add</p>
        <div className="recent-chips">
          {recent.map((name) => {
            const color = assignColors([name])[0];
            const picked = isPicked(name);
            return <button key={name} className={`player-chip${picked ? " picked" : ""}`} aria-pressed={picked} onClick={() => togglePlayer(name)}>
              <span className="chip-avatar" style={{ background: color.fill, color: color.ink }} aria-hidden="true">{picked ? "✓" : initialOf(name)}</span>
              {name}
            </button>;
          })}
        </div>
      </div>}

      <div className="names">
        {names.map((name, index) => <label key={index}>
          {mode === "solo" ? "Player name" : `Player ${index + 1}`}
          <span className="name-field">
            <span className="name-dot" style={{ background: name.trim() ? colors[index].fill : "#d5d0bf" }} aria-hidden="true">{name.trim() ? initialOf(name) : ""}</span>
            <input value={name} maxLength={28} autoFocus={index === 0 && !savedRound && recent.length === 0} placeholder={mode === "solo" ? "Your name" : `Player ${index + 1} name`}
              onChange={(event) => setNames(names.map((old, i) => i === index ? event.target.value : old))} />
          </span>
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
      <Scorecard holes={record.holes} players={(() => {
        const colors = assignColors(record.competitors.map((competitor) => competitor.name));
        return record.competitors.map((competitor, i) => ({ key: competitor.name, name: competitor.name, scores: competitor.scores, color: colors[i] }));
      })()} />
    </section>
  </div>;
}

function Records({ onHome }: { onHome: () => void }) {
  const [records, setRecords] = useState<GameRecord[] | null>(null);
  const [selected, setSelected] = useState<GameRecord | null>(null);
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(0);
  const load = () => {
    setRecords(null);
    setError("");
    // Upload rounds waiting on this phone first, so a just-finished game shows up in the records.
    flushOutbox(saveCompletedGame)
      .then((remaining) => { setWaiting(remaining); return fetchRecords(); })
      .then(setRecords)
      .catch(() => {
        setRecords([]);
        setError("Records could not be loaded. Please try again.");
      });
  };

  useEffect(load, []);

  const top9 = useMemo(() => topRecords(records ?? [], 9), [records]);
  const top18 = useMemo(() => topRecords(records ?? [], 18), [records]);
  const profiles = useMemo(() => buildProfiles(records ?? []), [records]);
  const profile = profiles.find((entry) => entry.key === profileKey) ?? null;
  const scoreSheet = selected && <RecordScoreSheet record={selected} onClose={() => setSelected(null)} />;

  if (profile) return <>
    <PlayerProfileView profile={profile} onBack={() => setProfileKey(null)}
      onOpenRound={(id) => setSelected((records ?? []).find((record) => record.id === id) ?? null)} />
    {scoreSheet}
  </>;
  const date = (value: string) => new Intl.DateTimeFormat("en-NZ", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));

  return <main className="shell records-shell">
    <HomeNav view="records" onChange={(view) => view === "home" && onHome()} />
    <header className="records-header">
      <p className="eyebrow">Clubhouse history</p>
      <h1>Records</h1>
      <p>Lowest score wins. Tap a player for their stats, or any round for its score sheet.</p>
    </header>

    {records === null ? <section className="card records-message"><span className="loader" />Loading records…</section> : <>
      <section className="top-rounds-grid">
        <TopRounds title="Top 5 · Front 9" records={top9} onSelect={setSelected} />
        <TopRounds title="Top 5 · Full 18" records={top18} onSelect={setSelected} />
      </section>

      <ClubhouseRankings profiles={profiles} onSelect={setProfileKey} />

      {waiting > 0 && <section className="card records-message">{waiting === 1 ? "1 round is" : `${waiting} rounds are`} waiting on this phone to upload. They'll appear here once you're back online.</section>}
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
    {scoreSheet}
  </main>;
}

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [game, setGame] = useState<GolfGame | null>(null);
  const [savedRound, setSavedRound] = useState<GolfGame | null>(() => loadActiveRound());

  // Upload any rounds that finished while offline: on launch and whenever the connection returns.
  useEffect(() => {
    if (!isCloudConnected()) return;
    const flush = () => { void flushOutbox(saveCompletedGame); };
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  // Every score is saved to the device immediately; a finished round moves to the upload outbox.
  const updateGame = (next: GolfGame) => {
    setGame(next);
    if (next.completedAt) {
      addToOutbox(next);
      saveActiveRound(null);
      setSavedRound(null);
    } else {
      saveActiveRound(next);
      setSavedRound(next);
    }
  };
  const startGame = (next: GolfGame) => {
    if (savedRound && !window.confirm("Starting a new round will discard your unfinished one. Continue?")) return;
    rememberPlayers(next.competitors.map((competitor) => competitor.name));
    updateGame(next);
  };
  const discardSaved = () => { saveActiveRound(null); setSavedRound(null); };
  const leaveGame = (nextView: AppView) => {
    // Leaving mid-round from the Exit button means the round is abandoned.
    if (game && !game.completedAt) discardSaved();
    setGame(null);
    setView(nextView);
  };

  if (game) return <Play game={game} setGame={updateGame} onNew={() => leaveGame("home")} onRecords={() => leaveGame("records")} />;
  return view === "records"
    ? <Records onHome={() => setView("home")} />
    : <Setup onStart={startGame} onRecords={() => setView("records")}
      savedRound={savedRound} onResume={() => savedRound && setGame(savedRound)} onDiscard={discardSaved} />;
}
