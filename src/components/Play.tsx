import { useEffect, useMemo, useRef, useState } from "react";
import {
  RESULTS, completedHoles, formatToPar, holeOutcome, roundAwards, scoreHole, scoreToPar, stakesLine, standings,
  totalScore, undoLastScore, winnerNames, type GolfGame, type HoleTone, type Stroke,
} from "../domain/golf";
import { assignColors, initialOf, type PlayerColor } from "../domain/players";
import { isCloudConnected, saveCompletedGame } from "../services/golfApi";
import { loadOutbox, removeFromOutbox } from "../services/localStore";
import { playThrow, setSoundEnabled, soundEnabled } from "../ui/sound";
import { Dartboard, type BoardPoint } from "./Dartboard";
import { Scorecard } from "./Scorecard";

/** How long the dart sits in the board before play moves on. Long enough to see, short enough not to wait. */
const LANDING_MS = 650;
const CALLOUT_MS = 1700;
const UNDO_MS = 4500;

interface Callout { key: number; name: string; tone: HoleTone; detail: string }
interface UndoNotice { key: number; text: string }

function LiveLeaderboard({ game, colors }: { game: GolfGame; colors: PlayerColor[] }) {
  const table = standings(game);
  const started = table.some((row) => row.thru > 0);
  // Up to three players share the width evenly; bigger groups scroll sideways.
  return <ol className={`live-board${table.length <= 3 ? " fit" : ""}`} aria-label="Live standings"
    style={table.length <= 3 ? { gridTemplateColumns: `repeat(${table.length}, minmax(0, 1fr))` } : undefined}>
    {table.map((row) => {
      const color = colors[row.index];
      const throwing = row.index === game.currentCompetitor;
      return <li key={row.competitor.id} className={throwing ? "throwing" : ""} aria-current={throwing ? "true" : undefined}>
        <span className="live-avatar" style={{ background: color.fill, color: color.ink }} aria-hidden="true">{initialOf(row.competitor.name)}</span>
        <span className="live-text">
          <span className="live-name">{started && <span className="live-pos">{row.position}</span>}{row.competitor.name}</span>
          <span className="live-meta"><b className="live-par">{formatToPar(row.toPar)}</b> {row.thru === game.holes ? "F" : `thru ${row.thru}`}</span>
        </span>
      </li>;
    })}
  </ol>;
}

function TurnCard({ game, color }: { game: GolfGame; color: PlayerColor | null }) {
  const active = game.competitors[game.currentCompetitor];
  const style = color ? { background: color.fill, color: color.ink } : undefined;
  return <section className={`target-card turn-card${color ? " player-colored" : ""}`} style={style} aria-live="polite">
    <div className="turn-top">
      <p>Hole {game.currentHole} of {game.holes}</p>
      {color && <span className="turn-avatar" aria-hidden="true">{initialOf(active.name)}</span>}
    </div>
    <div className="turn-main">
      <div className="hole-number" key={`${game.currentHole}`}>{game.currentHole}</div>
      <div className="turn-who">
        <span className="turn-label">{game.competitors.length > 1 ? "Up next" : "Throwing"}</span>
        <strong className="turn-name" key={active.id}>{active.name}</strong>
      </div>
    </div>
    <div className="round-line"><span>{stakesLine(game, game.currentCompetitor)}</span><strong>{formatToPar(scoreToPar(active))}</strong></div>
  </section>;
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 42 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.25,
    duration: 1.2 + Math.random() * 0.9,
    color: ["#efc24f", "#bd493c", "#247057", "#fffced", "#2f5d9e"][i % 5],
    size: 6 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 120,
  })), []);
  return <div className="confetti" aria-hidden="true">
    {pieces.map((piece, i) => <span key={i} style={{
      left: `${piece.left}%`, background: piece.color, width: piece.size, height: piece.size * 0.45,
      animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`,
      ["--drift" as string]: `${piece.drift}px`,
    }} />)}
  </div>;
}

function SoundToggle() {
  const [on, setOn] = useState(soundEnabled);
  return <button className="icon-button" aria-pressed={on} aria-label={on ? "Sound on" : "Sound off"}
    onClick={() => { setSoundEnabled(!on); setOn(!on); }}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {on
        ? <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        : <path d="M16.5 9.5l5 5m0-5l-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
    </svg>
  </button>;
}

function Results({ game, colors, onNew, onRecords }: { game: GolfGame; colors: PlayerColor[]; onNew: () => void; onRecords: () => void }) {
  const [saveStatus, setSaveStatus] = useState("");
  const winners = winnerNames(game);
  const table = standings(game);
  const awards = roundAwards(game);
  const champion = colors[table[0].index];

  useEffect(() => {
    const keptOnDevice = loadOutbox().some((queued) => queued.id === game.id);
    const offlineMessage = keptOnDevice
      ? "Couldn't reach the clubhouse. This round is kept on this phone and will upload automatically."
      : "This round couldn't be saved. Screenshot the scorecard to keep a copy.";
    if (!isCloudConnected()) {
      setSaveStatus(keptOnDevice ? "Saved on this phone" : offlineMessage);
      return;
    }
    let cancelled = false;
    setSaveStatus("Saving to the clubhouse…");
    saveCompletedGame(game)
      .then(() => { removeFromOutbox(game.id); if (!cancelled) setSaveStatus("Round saved to the clubhouse ✓"); })
      .catch(() => { if (!cancelled) setSaveStatus(offlineMessage); });
    return () => { cancelled = true; };
  }, [game.completedAt]);

  return <main className="shell results-shell">
    <Confetti />
    <header className="hero compact-hero">
      <div className="trophy" style={{ background: champion.fill, color: champion.ink }} aria-hidden="true">🏆</div>
      <p className="eyebrow">Clubhouse result</p>
      <h1>{winners.join(" & ")}</h1>
      <p>{winners.length > 1 ? "Tied for the win" : game.competitors.length > 1 ? "Wins Darty Golf" : "Round complete"} · {formatToPar(table[0].toPar)}</p>
    </header>

    <section className="card leaderboard">
      {table.map((row) => {
        const color = colors[row.index];
        return <div className="leader-row" key={row.competitor.id}>
          <span className="place">{row.position}</span>
          <span className="live-avatar" style={{ background: color.fill, color: color.ink }} aria-hidden="true">{initialOf(row.competitor.name)}</span>
          <strong>{row.competitor.name}</strong>
          <span className="leader-par">{formatToPar(row.toPar)}</span>
          <b>{totalScore(row.competitor)}</b>
        </div>;
      })}
      <small>{saveStatus}</small>
    </section>

    {awards.length > 0 && <section className="awards" aria-label="Awards">
      {awards.map((award) => <div className="award" key={award.title}>
        <span className="award-title">{award.title}</span>
        <strong>{award.winners.length ? award.winners.join(" & ") : award.detail}</strong>
        {award.winners.length > 0 && <small>{award.detail}</small>}
      </div>)}
    </section>}

    <section className="card">
      <Scorecard holes={game.holes} players={game.competitors.map((competitor, i) => ({ key: competitor.id, name: competitor.name, scores: competitor.scores, color: colors[i] }))} />
    </section>
    <div className="result-actions">
      <button className="primary" onClick={onNew}>Play another round</button>
      <button className="secondary" onClick={onRecords}>View records</button>
    </div>
  </main>;
}

export function Play({ game, setGame, onNew, onRecords }: { game: GolfGame; setGame: (game: GolfGame) => void; onNew: () => void; onRecords: () => void }) {
  const colors = useMemo(() => assignColors(game.competitors.map((competitor) => competitor.name)), [game.id]);
  const [showCard, setShowCard] = useState(false);
  const [dart, setDart] = useState<BoardPoint | null>(null);
  const [landing, setLanding] = useState(false);
  const [callout, setCallout] = useState<Callout | null>(null);
  const [undo, setUndo] = useState<UndoNotice | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  if (game.completedAt) return <Results game={game} colors={colors} onNew={onNew} onRecords={onRecords} />;

  const group = game.competitors.length > 1;
  const active = game.competitors[game.currentCompetitor];
  const canUndo = game.competitors.some((competitor) => completedHoles(competitor) > 0);

  const onThrow = (score: Stroke, point: BoardPoint | null) => {
    if (landing) return;
    const outcome = holeOutcome(score);
    const result = RESULTS.find((entry) => entry.strokes === score)!;
    const next = scoreHole(game, score);
    const nowToPar = scoreToPar(next.competitors[game.currentCompetitor]);
    const key = Date.now();

    playThrow(score === 1 ? "ace" : score === 7 ? "bounce" : "hit");
    setLanding(true);
    setDart(point);
    setUndo(null);
    setCallout({
      key, name: outcome.name, tone: outcome.tone,
      detail: `${score === 7 ? "Bounced out" : result.label} · ${group ? `${active.name} ` : ""}${formatToPar(nowToPar)}`,
    });

    later(() => {
      setGame(next);
      setDart(null);
      setLanding(false);
      setUndo({ key, text: `${result.label} on hole ${game.currentHole}${group ? ` · ${active.name}` : ""}` });
    }, LANDING_MS);
    later(() => setCallout((current) => (current?.key === key ? null : current)), CALLOUT_MS);
    later(() => setUndo((current) => (current?.key === key ? null : current)), LANDING_MS + UNDO_MS);
  };

  const undoLast = () => {
    setUndo(null);
    setCallout(null);
    setGame(undoLastScore(game));
  };

  return <main className="shell play-shell">
    <header className="play-header">
      <button className="text-link" onClick={() => window.confirm("Exit this round? Your unfinished scores will be lost.") && onNew()}>Exit</button>
      <div className="play-header-actions">
        <SoundToggle />
        <button className="score-toggle" onClick={() => setShowCard(!showCard)} aria-expanded={showCard}>{showCard ? "Close" : "Scorecard"}</button>
      </div>
    </header>

    {group && <LiveLeaderboard game={game} colors={colors} />}

    {showCard && <section className="card overlay-card">
      <Scorecard holes={game.holes} currentHole={game.currentHole}
        players={game.competitors.map((competitor, i) => ({ key: competitor.id, name: competitor.name, scores: competitor.scores, color: colors[i] }))} />
    </section>}

    <TurnCard game={game} color={group ? colors[game.currentCompetitor] : null} />

    <p className="score-prompt">Tap where the <strong>last dart</strong> landed</p>

    <Dartboard hole={game.currentHole} onThrow={onThrow} dart={dart} locked={landing} />

    <div className="round-actions">
      <button className="secondary" disabled={!canUndo || landing} onClick={undoLast}>Undo last score</button>
    </div>

    <div className="callout-layer" aria-live="assertive">
      {callout && <div key={callout.key} className={`callout tone-${callout.tone}`}>
        <span className="callout-name">{callout.name}</span>
        <span className="callout-detail">{callout.detail}</span>
      </div>}
    </div>
    {callout?.tone === "ace" && <Confetti key={`confetti-${callout.key}`} />}

    {undo && <div className="undo-bar" key={`undo-${undo.key}`} role="status">
      <span>{undo.text}</span>
      <button onClick={undoLast}>Undo</button>
    </div>}
  </main>;
}
