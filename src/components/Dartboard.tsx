import { useRef, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Stroke } from "../domain/golf";

export interface BoardPoint { x: number; y: number }

const CENTER_X = 180;
const CENTER_Y = 292;

const polarPoint = (radius: number, angle: number): [number, number] => {
  const radians = angle * Math.PI / 180;
  return [CENTER_X + radius * Math.cos(radians), CENTER_Y + radius * Math.sin(radians)];
};

const wedgePath = (inner: number, outer: number, start: number, end: number): string => {
  const [outerStartX, outerStartY] = polarPoint(outer, start);
  const [outerEndX, outerEndY] = polarPoint(outer, end);
  const [innerEndX, innerEndY] = polarPoint(inner, end);
  const [innerStartX, innerStartY] = polarPoint(inner, start);
  return `M ${outerStartX} ${outerStartY} A ${outer} ${outer} 0 0 1 ${outerEndX} ${outerEndY} L ${innerEndX} ${innerEndY} A ${inner} ${inner} 0 0 0 ${innerStartX} ${innerStartY} Z`;
};

/** Where the dart lands when a zone is chosen with the keyboard instead of a tap. */
const ZONE_CENTERS: Record<Stroke, BoardPoint> = {
  1: { x: 180, y: 61 }, 2: { x: 180, y: 151 }, 3: { x: 180, y: 205 }, 4: { x: 180, y: 108 },
  5: { x: 92, y: 160 }, 6: { x: 180, y: 38 }, 7: { x: 180, y: 300 },
};

const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** A dart seen from the thrower's side, tip at (0, 0). */
function Dart({ point }: { point: BoardPoint }) {
  return <g transform={`translate(${point.x} ${point.y})`} className="dart" aria-hidden="true">
    <circle className="dart-ripple" r="6" />
    <g className="dart-body">
      <line x1="0" y1="0" x2="15" y2="-26" className="dart-shaft" />
      <path d="M13 -22 L27 -30 L19 -38 Z" className="dart-flight" />
      <path d="M13 -22 L8 -38 L19 -38 Z" className="dart-flight alt" />
      <circle r="2.4" className="dart-tip" />
    </g>
  </g>;
}

export function Dartboard({ hole, onThrow, dart, locked }: {
  hole: number;
  onThrow: (score: Stroke, point: BoardPoint | null) => void;
  dart: BoardPoint | null;
  locked: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const redRing = BOARD_ORDER.indexOf(hole) % 2 === 0;
  const ring = redRing ? "red" : "green";
  const single = redRing ? "dark" : "light";
  const adjacentRing = redRing ? "green" : "red";
  const adjacentSingle = redRing ? "light" : "dark";

  /** Converts the tap position on screen into board coordinates, so the dart lands exactly there. */
  const tapPoint = (event: MouseEvent): BoardPoint | null => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix || (event.clientX === 0 && event.clientY === 0)) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  };

  const zone = (score: Stroke, label: string, children: ReactNode) => <g className="svg-zone"
    role="button" tabIndex={locked ? -1 : 0} aria-label={`${label}, ${score} ${score === 1 ? "stroke" : "strokes"}`}
    onClick={(event) => onThrow(score, tapPoint(event) ?? ZONE_CENTERS[score])}
    onKeyDown={(event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onThrow(score, ZONE_CENTERS[score]); }
    }}>{children}</g>;

  return <section className={`dartboard-picker${locked ? " locked" : ""}`} aria-label="Where did the dart land?">
    <svg ref={svgRef} className="dartboard-segment" viewBox="0 0 360 310" role="group" aria-label={`Dartboard segment for target ${hole}`}>
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
        <circle className="board-bull-outer" cx={CENTER_X} cy={CENTER_Y} r="24" /><circle className="board-bull" cx={CENTER_X} cy={CENTER_Y} r="10" />
      </g>
      {dart && <Dart point={dart} />}
    </svg>
    <button className="bounce-zone" disabled={locked} onClick={() => onThrow(7, null)} aria-label="Bounce Out / Off The Board, 7 strokes">
      <span className="bounce-arrow">↩</span><span className="zone-score">7</span><span><b>Bounce out</b><small>or off the board</small></span>
    </button>
  </section>;
}
