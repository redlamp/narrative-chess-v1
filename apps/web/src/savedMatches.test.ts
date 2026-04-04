import { beforeEach, describe, expect, it } from "vitest";
import { createInitialGameSnapshot } from "@narrative-chess/game-core";
import { createInitialCharacterRoster } from "@narrative-chess/narrative-engine";
import { edinburghBoard } from "./edinburghBoard";
import {
  deleteSavedMatch,
  getSavedMatch,
  listSavedMatches,
  saveMatch
} from "./savedMatches";

function createSnapshot() {
  return createInitialGameSnapshot(
    createInitialCharacterRoster({
      cityBoard: edinburghBoard
    })
  );
}

describe("savedMatches", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("saves and reloads validated match snapshots", () => {
    const snapshot = createSnapshot();
    const savedMatches = saveMatch(snapshot);

    expect(savedMatches).toHaveLength(1);
    expect(savedMatches[0]?.moveCount).toBe(0);
    expect(listSavedMatches()).toHaveLength(1);
    expect(getSavedMatch(savedMatches[0]!.id)?.snapshot.currentFen).toBe(snapshot.currentFen);
  });

  it("deletes saved matches cleanly", () => {
    const savedMatches = saveMatch(createSnapshot());
    const recordId = savedMatches[0]!.id;

    const remainingMatches = deleteSavedMatch(recordId);

    expect(remainingMatches).toHaveLength(0);
    expect(getSavedMatch(recordId)).toBeNull();
  });
});
