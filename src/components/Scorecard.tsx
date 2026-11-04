import { Fragment } from "react";
import { PAR, formatToPar, splitTotals } from "../domain/golf";
import { initialOf, type PlayerColor } from "../domain/players";

export interface ScorecardPlayer {
  key: string;
  name: string;
  scores: Array<number | null>;
  color: PlayerColor;
}

/** Golf-card markings: circles under par, squares over, gold for a hole in one. */
const markClass = (score: number): string => {
  if (score === 1) return "mark ace";
  if (score === PAR - 1) return "mark birdie";
  if (score === PAR + 1) return "mark bogey";
  if (score >= PAR + 2) return "mark double-bogey";
  return "mark";
};

const markLabel = (score: number): string =>
  score === 1 ? "hole in one" : score === 2 ? "birdie" : score === 3 ? "par" : score === 4 ? "bogey" : "double bogey or worse";

const sum = (scores: Array<number | null>) => scores.reduce<number>((total, score) => total + (score ?? 0), 0);
const played = (scores: Array<number | null>) => scores.filter((score) => score !== null).length;

export function Scorecard({ players, holes, currentHole }: { players: ScorecardPlayer[]; holes: 9 | 18; currentHole?: number }) {
  const subtotalRow = (label: string, from: number, to: number) => <tr className="subtotal">
    <th scope="row">{label}</th>
    <td className="par-col">{(to - from) * PAR}</td>
    {players.map((player) => <td key={player.key}>{sum(player.scores.slice(from, to)) || "–"}</td>)}
  </tr>;

  return <div className="scorecard-wrap">
    <table className="scorecard golf-card">
      <thead>
        <tr>
          <th scope="col">Hole</th>
          <th scope="col" className="par-col">Par</th>
          {players.map((player) => <th scope="col" key={player.key}>
            <span className="card-avatar" style={{ background: player.color.fill, color: player.color.ink }} aria-hidden="true">{initialOf(player.name)}</span>
            <span className="card-name">{player.name}</span>
          </th>)}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: holes }, (_, index) => <Fragment key={index}>
          <tr className={currentHole === index + 1 ? "current" : ""}>
            <th scope="row">{index + 1}</th>
            <td className="par-col">{PAR}</td>
            {players.map((player) => {
              const score = player.scores[index];
              return <td key={player.key}>
                {score === null || score === undefined
                  ? <span className="mark empty">–</span>
                  : <span className={markClass(score)} aria-label={`${score}, ${markLabel(score)}`}>{score}</span>}
              </td>;
            })}
          </tr>
          {holes === 18 && index === 8 && subtotalRow("Out", 0, 9)}
          {holes === 18 && index === 17 && subtotalRow("In", 9, 18)}
        </Fragment>)}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">Total</th>
          <td className="par-col">{holes * PAR}</td>
          {players.map((player) => <td key={player.key}>{splitTotals(player.scores).out + (splitTotals(player.scores).in ?? 0)}</td>)}
        </tr>
        <tr className="to-par-row">
          <th scope="row">To par</th>
          <td className="par-col" />
          {players.map((player) => <td key={player.key}>{played(player.scores) ? formatToPar(sum(player.scores) - played(player.scores) * PAR) : "–"}</td>)}
        </tr>
      </tfoot>
    </table>
    <p className="card-legend" aria-hidden="true">
      <span><span className="mark ace">1</span>Hole in one</span>
      <span><span className="mark birdie">2</span>Birdie</span>
      <span><span className="mark bogey">4</span>Bogey</span>
      <span><span className="mark double-bogey">5</span>Double+</span>
    </p>
  </div>;
}
