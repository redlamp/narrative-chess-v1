import { describe, expect, it } from "vitest";
import { createReplayFromPgn } from "@narrative-chess/game-core";
import { referenceGames } from "./referenceGames";

describe("referenceGames", () => {
  it("loads every seeded classic game as a valid replay", () => {
    for (const game of referenceGames) {
      const replay = createReplayFromPgn(game.pgn);

      expect(replay.snapshots.length).toBeGreaterThan(1);
    }
  });
});
