import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReplayFromPgn } from "@narrative-chess/game-core";
import {
  createReferenceGameTemplate,
  getDefaultReferenceGames,
  listReferenceGames,
  resetReferenceGames,
  saveReferenceGames
} from "./referenceGames";

function createLocalStorageMock() {
  const storage = new Map<string, string>();

  return {
    getItem(key: string) {
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
    clear() {
      storage.clear();
    }
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("window", {
    localStorage: createLocalStorageMock()
  });
});

describe("referenceGames", () => {
  it("loads every seeded classic game as a valid replay", () => {
    for (const game of getDefaultReferenceGames()) {
      const replay = createReplayFromPgn(game.pgn);

      expect(replay.snapshots.length).toBeGreaterThan(1);
    }
  });

  it("creates a valid editable template game", () => {
    const template = createReferenceGameTemplate(0);

    expect(template.id).toContain("reference-game-1");
    expect(template.title).toContain("New classic game");
    expect(template.detailLinks).toEqual([]);
  });

  it("round-trips browser-local edits", () => {
    const nextGames = saveReferenceGames([
      {
        ...getDefaultReferenceGames()[0],
        title: "Edited title"
      }
    ]);

    expect(nextGames[0]?.title).toBe("Edited title");
    expect(listReferenceGames()[0]?.title).toBe("Edited title");
    expect(resetReferenceGames()[0]?.title).toBe(getDefaultReferenceGames()[0]?.title);
  });

  it("falls back to the legacy classic-games storage key", () => {
    window.localStorage.setItem(
      "narrative-chess:classic-games",
      JSON.stringify([
        {
          ...getDefaultReferenceGames()[0],
          title: "Legacy classic game"
        }
      ])
    );

    expect(listReferenceGames()[0]?.title).toBe("Legacy classic game");
  });
});
