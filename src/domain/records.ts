export interface RecordCompetitor {
  name: string;
  total: number;
}

export interface GameRecord {
  id: string;
  completedAt: string;
  mode: "solo" | "teams";
  holes: 9 | 18;
  winner: string;
  competitors: RecordCompetitor[];
  lowestScore: number;
}

export const bestRecord = (records: GameRecord[], holes: 9 | 18): GameRecord | null =>
  records
    .filter((record) => record.holes === holes)
    .sort((a, b) => a.lowestScore - b.lowestScore || Date.parse(b.completedAt) - Date.parse(a.completedAt))[0] ?? null;

export const recordToPar = (record: GameRecord): number => record.lowestScore - record.holes * 3;

export const recordedHoles = (records: GameRecord[]): number =>
  records.reduce((sum, record) => sum + record.holes * record.competitors.length, 0);
