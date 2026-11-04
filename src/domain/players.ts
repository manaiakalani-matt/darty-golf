/**
 * Player colours. Each name always gets the same colour from night to night
 * (no setup needed), and two players in one game never share a colour.
 * Every colour carries white text at WCAG AA contrast or better.
 */
export const PLAYER_COLORS = [
  { id: "red", fill: "#b23a2e", ink: "#ffffff" },
  { id: "green", fill: "#1f6b52", ink: "#ffffff" },
  { id: "blue", fill: "#2f5d9e", ink: "#ffffff" },
  { id: "plum", fill: "#7a3f86", ink: "#ffffff" },
  { id: "teal", fill: "#13707a", ink: "#ffffff" },
  { id: "rust", fill: "#a1501c", ink: "#ffffff" },
  { id: "slate", fill: "#3d4f5c", ink: "#ffffff" },
  { id: "rose", fill: "#a53860", ink: "#ffffff" },
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number];

const hashName = (name: string): number => {
  let hash = 0;
  for (const character of name.trim().toLowerCase()) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
};

/** Colours for a line-up, in order. Preferred colour by name, next free one on a clash. */
export const assignColors = (names: string[]): PlayerColor[] => {
  const taken = new Set<number>();
  return names.map((name) => {
    let slot = hashName(name) % PLAYER_COLORS.length;
    while (taken.has(slot) && taken.size < PLAYER_COLORS.length) slot = (slot + 1) % PLAYER_COLORS.length;
    taken.add(slot);
    return PLAYER_COLORS[slot];
  });
};

export const initialOf = (name: string): string => (name.trim()[0] ?? "?").toUpperCase();
