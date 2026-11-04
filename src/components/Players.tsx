import { useEffect } from "react";
import { PAR, formatToPar } from "../domain/golf";
import { assignColors, initialOf } from "../domain/players";
import { clubhouseRankings, headToHeadLine, type PlayerProfile, type RoundLine } from "../domain/profiles";

const colorOf = (name: string) => assignColors([name])[0];

const shortDate = (value: string) => new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short" }).format(new Date(value));

const perHole = (value: number) => value.toFixed(2);

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const color = colorOf(name);
  return <span className="profile-avatar" style={{ background: color.fill, color: color.ink, width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">{initialOf(name)}</span>;
}

/** Clubhouse table: everyone with 2+ rounds, ranked by average strokes per hole. */
export function ClubhouseRankings({ profiles, onSelect }: { profiles: PlayerProfile[]; onSelect: (key: string) => void }) {
  const { ranked, unranked } = clubhouseRankings(profiles);
  if (!profiles.length) return null;
  return <section className="card rankings">
    <div className="rankings-head">
      <div><p className="eyebrow">Clubhouse rankings</p><h2>Players</h2></div>
      <span className="rankings-note">Avg per hole · par 3</span>
    </div>
    <ol className="ranking-list">
      {ranked.map((profile, index) => <li key={profile.key}>
        <button onClick={() => onSelect(profile.key)}>
          <span className="ranking-pos">{index + 1}</span>
          <Avatar name={profile.name} />
          <span className="ranking-who"><strong>{profile.name}</strong><small>{profile.roundsPlayed} rounds · {profile.wins} {profile.wins === 1 ? "win" : "wins"}</small></span>
          <span className="ranking-score"><b>{perHole(profile.averagePerHole)}</b><small>{formatToPar(Math.round(profile.average18ToPar))} per 18</small></span>
          <span className="ranking-chevron" aria-hidden="true">›</span>
        </button>
      </li>)}
    </ol>
    {unranked.length > 0 && <div className="unranked">
      <p>Play 2 rounds to get ranked</p>
      <div className="unranked-chips">
        {unranked.map((profile) => <button key={profile.key} className="player-chip" onClick={() => onSelect(profile.key)}>
          <span className="chip-avatar" style={{ background: colorOf(profile.name).fill, color: colorOf(profile.name).ink }} aria-hidden="true">{initialOf(profile.name)}</span>{profile.name}
        </button>)}
      </div>
    </div>}
  </section>;
}

/** Average strokes per hole for recent rounds. Up is better, so the line is drawn with low scores high. */
function FormLine({ form }: { form: number[] }) {
  if (form.length < 2) return <p className="form-empty">Play another round to see a form line.</p>;
  const width = 300, height = 96, pad = 12;
  const lo = Math.min(2, ...form), hi = Math.max(4, ...form);
  const x = (i: number) => pad + (i * (width - pad * 2)) / (form.length - 1);
  const y = (v: number) => pad + ((v - lo) / (hi - lo)) * (height - pad * 2);
  const points = form.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const last = form[form.length - 1];
  return <svg className="form-line" viewBox={`0 0 ${width} ${height}`} role="img"
    aria-label={`Form over the last ${form.length} rounds: from ${form[0].toFixed(2)} to ${last.toFixed(2)} strokes a hole. Par is 3.`}>
    <line x1={pad} x2={width - pad} y1={y(PAR)} y2={y(PAR)} className="form-par" />
    <text x={width - pad} y={y(PAR) - 5} className="form-par-label" textAnchor="end">par</text>
    <polyline points={points} className="form-path" />
    {form.map((value, i) => <circle key={i} cx={x(i)} cy={y(value)} r={i === form.length - 1 ? 5 : 3} className={i === form.length - 1 ? "form-dot last" : "form-dot"} />)}
  </svg>;
}

function BestRound({ label, round }: { label: string; round: RoundLine | null }) {
  return <div className="stat-tile">
    <span className="stat-label">{label}</span>
    {round ? <><b>{round.total}</b><small>{formatToPar(round.toPar)} · {shortDate(round.completedAt)}</small></> : <><b>–</b><small>Not played yet</small></>}
  </div>;
}

export function PlayerProfileView({ profile, onBack, onOpenRound }: { profile: PlayerProfile; onBack: () => void; onOpenRound: (recordId: string) => void }) {
  useEffect(() => { window.scrollTo(0, 0); }, [profile.key]);
  const color = colorOf(profile.name);
  const placeLabel = (round: RoundLine) => (round.opponents === 0 ? "Solo" : round.place === 1 ? (round.tiedFirst ? "Tied 1st" : "Won") : `${round.place}${round.place === 2 ? "nd" : round.place === 3 ? "rd" : "th"} of ${round.opponents + 1}`);

  return <main className="shell profile-shell">
    <button className="text-link back-link" onClick={onBack}>‹ Records</button>

    <header className="profile-hero" style={{ background: color.fill, color: color.ink }}>
      <span className="profile-initial" aria-hidden="true">{initialOf(profile.name)}</span>
      <div>
        <p className="profile-kicker">Player profile</p>
        <h1>{profile.name}</h1>
        <p className="profile-sub">{profile.roundsPlayed} {profile.roundsPlayed === 1 ? "round" : "rounds"} · {profile.holesPlayed} holes · last played {shortDate(profile.lastPlayed)}</p>
      </div>
    </header>

    <section className="stat-grid" aria-label="Key stats">
      <div className="stat-tile feature">
        <span className="stat-label">Average</span>
        <b>{perHole(profile.averagePerHole)}</b>
        <small>a hole · {formatToPar(Math.round(profile.average18ToPar))} per 18</small>
      </div>
      <div className="stat-tile">
        <span className="stat-label">Wins</span>
        <b>{profile.wins}</b>
        <small>{profile.groupRounds ? `from ${profile.groupRounds} group ${profile.groupRounds === 1 ? "round" : "rounds"}` : "No group rounds yet"}</small>
      </div>
      <BestRound label="Best 18" round={profile.best18} />
      {/* Most rounds here are 18 holes, so an empty "Best 9" would waste the tile. */}
      {profile.best9 ? <BestRound label="Best 9" round={profile.best9} /> : <BestRound label="Last round" round={profile.rounds[0]} />}
    </section>

    <section className="tally-row" aria-label="Career totals">
      <div className="tally ace"><b>{profile.holesInOne}</b><span>{profile.holesInOne === 1 ? "Hole in one" : "Holes in one"}</span></div>
      <div className="tally"><b>{profile.birdies}</b><span>Birdies</span></div>
      <div className="tally"><b>{profile.pars}</b><span>Pars</span></div>
      <div className="tally"><b>{profile.bounceOuts}</b><span>Bounce-outs</span></div>
    </section>

    {(profile.bestHole || profile.nemesisHole) && <section className="hole-pair">
      {profile.bestHole && <div className="hole-card good">
        <span className="stat-label">Best hole</span>
        <b>{profile.bestHole.hole}</b>
        <small>averages {profile.bestHole.average.toFixed(1)}</small>
      </div>}
      {profile.nemesisHole && <div className="hole-card bad">
        <span className="stat-label">Nemesis hole</span>
        <b>{profile.nemesisHole.hole}</b>
        <small>averages {profile.nemesisHole.average.toFixed(1)}</small>
      </div>}
    </section>}

    <section className="card">
      <div className="section-title"><div><p className="eyebrow">Last {profile.form.length} rounds</p><h2>Form</h2></div><span className="rankings-note">Higher is better</span></div>
      <FormLine form={profile.form} />
    </section>

    {profile.headToHead.length > 0 && <section className="card">
      <p className="eyebrow">Rivalries</p>
      <h2>Head to head</h2>
      <ul className="h2h-list">
        {profile.headToHead.map((record) => {
          const games = record.wins + record.losses + record.ties;
          return <li key={record.opponentKey}>
            <div className="h2h-top"><Avatar name={record.opponent} size={26} /><span>{headToHeadLine(profile.name, record)}</span></div>
            <div className="h2h-bar" aria-hidden="true">
              <span className="win" style={{ width: `${(record.wins / games) * 100}%`, background: color.fill }} />
              <span className="tie" style={{ width: `${(record.ties / games) * 100}%` }} />
              <span className="loss" style={{ width: `${(record.losses / games) * 100}%`, background: colorOf(record.opponent).fill }} />
            </div>
          </li>;
        })}
      </ul>
    </section>}

    <section className="recent-records">
      <div className="section-title"><div><p className="eyebrow">History</p><h2>Rounds</h2></div></div>
      {profile.rounds.map((round) => <button className="game-record card" key={round.recordId} onClick={() => onOpenRound(round.recordId)}>
        <span><strong>{placeLabel(round)}</strong><small>{round.holes} holes · {shortDate(round.completedAt)}</small></span>
        <span className="round-score"><b>{round.total}</b><small>{formatToPar(round.toPar)}</small></span>
      </button>)}
    </section>
  </main>;
}
