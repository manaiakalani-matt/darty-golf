import { describe, expect, it } from "vitest";
import { createGame, scoreHole, type GolfGame } from "../domain/golf";
import { addToOutbox, flushOutbox, forgetPlayer, loadActiveRound, loadOutbox, loadRecentPlayers, rememberPlayers, saveActiveRound } from "./localStore";

const memoryStore = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
};

const brokenStore = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};

const finishedGame = (name: string): GolfGame => {
  let game = createGame("solo", [name], 9);
  for (let hole = 0; hole < 9; hole += 1) game = scoreHole(game, 3);
  return game;
};

describe("Saving the round in progress", () => {
  it("restores a round exactly where it was left", () => {
    const store = memoryStore();
    let game = createGame("group", ["Red", "Blue"], 18);
    game = scoreHole(game, 2);
    game = scoreHole(game, 4);
    game = scoreHole(game, 1);
    saveActiveRound(game, store);

    const restored = loadActiveRound(store);
    expect(restored).toEqual(game);
    expect(restored?.currentHole).toBe(2);
    expect(restored?.currentCompetitor).toBe(1);
  });

  it("forgets the round once it is cleared", () => {
    const store = memoryStore();
    saveActiveRound(createGame("solo", ["Peter"]), store);
    saveActiveRound(null, store);
    expect(loadActiveRound(store)).toBeNull();
  });

  it("ignores corrupt or tampered saves instead of crashing", () => {
    const store = memoryStore();
    store.setItem("darty-golf:active-round", "{not json");
    expect(loadActiveRound(store)).toBeNull();

    const game = createGame("solo", ["Peter"], 9);
    store.setItem("darty-golf:active-round", JSON.stringify({ ...game, competitors: [{ ...game.competitors[0], scores: [99] }] }));
    expect(loadActiveRound(store)).toBeNull();
  });

  it("keeps working when the browser blocks storage", () => {
    expect(saveActiveRound(createGame("solo", ["Peter"]), brokenStore)).toBe(false);
    expect(loadActiveRound(brokenStore)).toBeNull();
    expect(addToOutbox(finishedGame("Peter"), brokenStore)).toBe(false);
    expect(loadOutbox(brokenStore)).toEqual([]);
  });
});

describe("Remembered players", () => {
  it("keeps the most recent line-up first without duplicates", () => {
    const store = memoryStore();
    rememberPlayers(["Daz", "Darren"], store);
    rememberPlayers(["Zac", "daz"], store);
    expect(loadRecentPlayers(store)).toEqual(["Zac", "daz", "Darren"]);
  });

  it("caps the list and can forget someone", () => {
    const store = memoryStore();
    rememberPlayers(Array.from({ length: 20 }, (_, i) => `P${i}`), store);
    expect(loadRecentPlayers(store)).toHaveLength(12);
    forgetPlayer("p0", store);
    expect(loadRecentPlayers(store)[0]).toBe("P1");
  });
});

describe("Finished rounds waiting to upload", () => {
  it("does not queue the same round twice", () => {
    const store = memoryStore();
    const game = finishedGame("Peter");
    addToOutbox(game, store);
    addToOutbox(game, store);
    expect(loadOutbox(store)).toHaveLength(1);
  });

  it("removes rounds that upload and keeps the ones that fail", async () => {
    const store = memoryStore();
    const good = finishedGame("Good");
    const bad = finishedGame("Bad");
    addToOutbox(good, store);
    addToOutbox(bad, store);

    const uploaded: string[] = [];
    const remaining = await flushOutbox(async (game) => {
      if (game.id === bad.id) throw new Error("offline");
      uploaded.push(game.id);
    }, store);

    expect(uploaded).toEqual([good.id]);
    expect(remaining).toBe(1);
    expect(loadOutbox(store).map((game) => game.id)).toEqual([bad.id]);
  });

  it("empties the outbox when everything uploads", async () => {
    const store = memoryStore();
    addToOutbox(finishedGame("Peter"), store);
    expect(await flushOutbox(async () => {}, store)).toBe(0);
    expect(store.data.size).toBe(0);
  });
});
