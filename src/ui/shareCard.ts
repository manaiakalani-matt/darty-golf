/**
 * Draws a finished round as a 1080×1350 image (the 4:5 shape chat apps and
 * Instagram show best), for sharing to the group chat.
 */
import { PAR, formatToPar, roundAwards, standings, type GolfGame } from "../domain/golf";
import { initialOf, type PlayerColor } from "../domain/players";

const W = 1080;
const H = 1350;
const INK = "#fffced";
const MUTED = "#9fb3aa";
const GOLD = "#efc24f";
const GREEN = "#12372a";
const SERIF = "Fraunces, Georgia, serif";
const SANS = "'DM Sans', system-ui, sans-serif";

/** Rounded rectangle without ctx.roundRect, which older Safari lacks. */
const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Shortens text with an ellipsis until it fits the width. */
const fit = (ctx: CanvasRenderingContext2D, text: string, max: number): string => {
  if (ctx.measureText(text).width <= max) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > max) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
};

/** One small mark per hole, coloured like the scorecard: gold ace, red birdie, pale par, slate bogey, dark worse. */
const holeColor = (score: number | null): string => {
  if (score === null) return "rgba(255,255,255,.12)";
  if (score === 1) return GOLD;
  if (score === 2) return "#e0614f";
  if (score === PAR) return "#d9e4dc";
  if (score === 4) return "#7f948a";
  return "#3e5a4e";
};

const loadFonts = async () => {
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    await Promise.race([
      Promise.all([fonts.load(`900 120px ${SERIF}`), fonts.load(`700 40px ${SANS}`), fonts.load(`400 30px ${SANS}`)]),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
  } catch {
    // Fall back to Georgia and the system font.
  }
};

export const drawResultCard = async (game: GolfGame, colors: PlayerColor[]): Promise<HTMLCanvasElement> => {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");

  const table = standings(game);
  const winners = table.filter((row) => row.toPar === table[0].toPar);
  const champion = colors[table[0].index];

  // Background with a soft circle in the winner's colour.
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, H);
  // A badge in the winner's colour, bleeding off the corner, with their initial.
  ctx.fillStyle = champion.fill;
  ctx.beginPath();
  ctx.arc(W - 30, 70, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.16)";
  ctx.font = `900 300px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.fillText(initialOf(table[0].competitor.name), W - 110, 250);
  ctx.textAlign = "left";

  // Header.
  ctx.fillStyle = GOLD;
  ctx.font = `700 30px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("DARTY GOLF", 80, 120);
  ctx.fillStyle = MUTED;
  ctx.font = `400 30px ${SANS}`;
  const when = new Intl.DateTimeFormat("en-NZ", { day: "numeric", month: "short", year: "numeric" }).format(new Date(game.completedAt ?? Date.now()));
  ctx.fillText(`${game.holes === 9 ? "Front 9" : "Full 18"} · ${when}`, 80, 168);

  // Winner.
  ctx.fillStyle = INK;
  ctx.font = `900 120px ${SERIF}`;
  const winnerText = winners.map((row) => row.competitor.name).join(" & ");
  ctx.fillText(fit(ctx, winnerText, 720), 80, 330); // clear of the corner badge
  ctx.font = `700 40px ${SANS}`;
  ctx.fillStyle = GOLD;
  const verdict = game.competitors.length === 1 ? "Round complete" : winners.length > 1 ? "Tied for the win" : "Wins";
  ctx.fillText(`${verdict}  ${formatToPar(table[0].toPar)}`, 80, 395);

  // Standings, each with a strip of hole marks.
  const awards = roundAwards(game).slice(0, 3);
  const awardsTop = H - 250;
  // Rows share the space above the awards, so up to 8 players always fit; small groups get bigger rows, centred.
  const listTop = 450;
  const space = (awards.length ? awardsTop - 30 : H - 110) - listTop;
  const shown = Math.max(1, Math.min(8, table.length));
  const rowHeight = Math.min(150, Math.floor(space / shown));
  const rowTop = listTop + Math.floor((space - rowHeight * shown) / 2);
  const nameSize = rowHeight < 90 ? 34 : 40;
  table.slice(0, 8).forEach((row, i) => {
    const y = rowTop + i * rowHeight;
    const color = colors[row.index];
    ctx.fillStyle = i === 0 ? "rgba(239,194,79,.14)" : "rgba(255,255,255,.06)";
    rounded(ctx, 60, y, W - 120, rowHeight - 16, 26);
    ctx.fill();

    const mid = y + (rowHeight - 16) / 2;
    ctx.fillStyle = MUTED;
    ctx.font = `700 34px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText(row.position, 112, mid + 12);

    ctx.fillStyle = color.fill;
    ctx.beginPath();
    ctx.arc(180, mid, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color.ink;
    ctx.font = `800 30px ${SANS}`;
    ctx.fillText(initialOf(row.competitor.name), 180, mid + 11);

    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = `700 ${nameSize}px ${SANS}`;
    ctx.fillText(fit(ctx, row.competitor.name, 470), 230, mid - (rowHeight > 100 ? 6 : 2));

    // Hole strip under the name.
    const dot = game.holes === 18 ? 22 : 40;
    const gap = game.holes === 18 ? 4 : 8;
    row.competitor.scores.forEach((score, hole) => {
      ctx.fillStyle = holeColor(score);
      rounded(ctx, 230 + hole * (dot + gap), mid + (rowHeight > 100 ? 14 : 8), dot, rowHeight > 100 ? 18 : 10, 5);
      ctx.fill();
    });

    ctx.textAlign = "right";
    ctx.fillStyle = INK;
    ctx.font = `900 64px ${SERIF}`;
    ctx.fillText(String(row.competitor.scores.reduce<number>((sum, score) => sum + (score ?? 0), 0)), W - 100, mid + 22);
    ctx.fillStyle = MUTED;
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(formatToPar(row.toPar), W - 210, mid + 14);
    ctx.textAlign = "left";
  });

  // Awards along the bottom.
  if (awards.length) {
    const width = (W - 120 - (awards.length - 1) * 20) / awards.length;
    awards.forEach((award, i) => {
      const x = 60 + i * (width + 20);
      ctx.fillStyle = "rgba(255,255,255,.07)";
      rounded(ctx, x, awardsTop, width, 150, 24);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.font = `700 22px ${SANS}`;
      ctx.fillText(fit(ctx, award.title.toUpperCase(), width - 48), x + 24, awardsTop + 46);
      ctx.fillStyle = INK;
      ctx.font = `900 40px ${SERIF}`;
      ctx.fillText(fit(ctx, award.winners.length ? award.winners.join(" & ") : award.detail, width - 48), x + 24, awardsTop + 98);
      if (award.winners.length) {
        ctx.fillStyle = MUTED;
        ctx.font = `400 24px ${SANS}`;
        ctx.fillText(fit(ctx, award.detail, width - 48), x + 24, awardsTop + 132);
      }
    });
  }

  // Legend.
  ctx.font = `400 24px ${SANS}`;
  let legendX = 60;
  [["Hole in one", GOLD], ["Birdie", "#e0614f"], ["Par", "#d9e4dc"], ["Bogey", "#7f948a"], ["Worse", "#3e5a4e"]].forEach(([label, color]) => {
    ctx.fillStyle = color;
    rounded(ctx, legendX, H - 66, 22, 14, 4);
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.fillText(label, legendX + 32, H - 52);
    legendX += 32 + ctx.measureText(label).width + 30;
  });

  return canvas;
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> => new Promise((resolve, reject) => {
  if (canvas.toBlob) canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not make the image."))), "image/png");
  else fetch(canvas.toDataURL("image/png")).then((response) => response.blob()).then(resolve, reject);
});
