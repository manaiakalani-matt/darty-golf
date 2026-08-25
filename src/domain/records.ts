export interface RecordCompetitor {
  name: string;
  total: number;
  scores: number[];
}

export interface GameRecord {
  id: string;
  completedAt: string;
  mode: "solo" | "group" | "teams";
  holes: 9 | 18;
  winner: string;
  competitors: RecordCompetitor[];
  lowestScore: number;
}

export const topRecords = (records: GameRecord[], holes: 9 | 18, limit = 5): GameRecord[] =>
  records
    .filter((record) => record.holes === holes)
    .sort((a, b) => a.lowestScore - b.lowestScore || Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .slice(0, limit);
