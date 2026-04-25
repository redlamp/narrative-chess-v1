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
import type { SavedMatchCityMetadata } from "./playCityContext";

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

  const londonMetadata: SavedMatchCityMetadata = {
    boardId: "london",
    displayLabel: "London",
    source: "fallback",
    publishedEditionId: null,
    previewMode: "published"
  };

  it("saves and reloads validated match snapshots", () => {
    const snapshot = createSnapshot();
    const savedMatches = saveMatch(snapshot);

    expect(savedMatches).toHaveLength(1);
    expect(savedMatches[0]?.moveCount).toBe(0);
    expect(savedMatches[0]?.cityMetadata).toBeNull();
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

  describe("Round-trip Persistence Tests", () => {
    it("preserves empty game state through save/load cycle", () => {
      const originalSnapshot = createSnapshot();
      const savedRecords = saveMatch(originalSnapshot, "Empty Match");

      const reloadedRecord = getSavedMatch(savedRecords[0]!.id);
      expect(reloadedRecord).toBeDefined();
      expect(reloadedRecord?.snapshot.currentFen).toBe(originalSnapshot.currentFen);
      expect(reloadedRecord?.snapshot.moveHistory).toHaveLength(0);
      expect(reloadedRecord?.snapshot.eventHistory).toHaveLength(0);
      expect(reloadedRecord?.name).toBe("Empty Match");
      expect(reloadedRecord?.moveCount).toBe(0);
    });

    it("preserves game snapshot structure through JSON serialization", () => {
      const originalSnapshot = createSnapshot();

      // Verify initial snapshot has required fields
      expect(originalSnapshot.currentFen).toBeTruthy();
      expect(Array.isArray(originalSnapshot.pieces)).toBe(true);
      expect(Array.isArray(originalSnapshot.moveHistory)).toBe(true);
      expect(Array.isArray(originalSnapshot.eventHistory)).toBe(true);
      expect(originalSnapshot.status).toBeTruthy();

      // Save and reload
      const savedRecords = saveMatch(originalSnapshot);
      const reloadedRecord = getSavedMatch(savedRecords[0]!.id);

      // Verify all snapshot properties are preserved
      expect(reloadedRecord?.snapshot.currentFen).toBe(originalSnapshot.currentFen);
      expect(reloadedRecord?.snapshot.pieces).toHaveLength(originalSnapshot.pieces.length);
      expect(reloadedRecord?.snapshot.status.turn).toBe(originalSnapshot.status.turn);
      expect(reloadedRecord?.snapshot.status.isCheck).toBe(originalSnapshot.status.isCheck);

      // Verify piece integrity
      for (const originalPiece of originalSnapshot.pieces) {
        const reloadedPiece = reloadedRecord?.snapshot.pieces.find(
          (p) => p.pieceId === originalPiece.pieceId
        );
        expect(reloadedPiece?.side).toBe(originalPiece.side);
        expect(reloadedPiece?.kind).toBe(originalPiece.kind);
        expect(reloadedPiece?.square).toBe(originalPiece.square);
      }
    });

    it("handles multiple saved matches with proper ordering", () => {
      const snapshot1 = createSnapshot();
      const snapshot2 = createSnapshot();
      const snapshot3 = createSnapshot();

      saveMatch(snapshot1, "First Save");
      saveMatch(snapshot2, "Second Save");
      saveMatch(snapshot3, "Third Save");

      const allMatches = listSavedMatches();
      expect(allMatches).toHaveLength(3);
      // Most recent save should be first
      expect(allMatches[0]?.name).toBe("Third Save");
      expect(allMatches[1]?.name).toBe("Second Save");
      expect(allMatches[2]?.name).toBe("First Save");
    });

    it("enforces maximum saved matches limit", () => {
      const snapshot = createSnapshot();

      // Save more than maxSavedMatches (12)
      for (let i = 0; i < 15; i += 1) {
        saveMatch(snapshot, `Match ${i}`);
      }

      const allMatches = listSavedMatches();
      expect(allMatches.length).toBeLessThanOrEqual(12);
      expect(allMatches.length).toBeGreaterThan(0);
    });

    it("validates and rejects corrupted snapshot data on load", () => {
      // Manually write corrupted data to localStorage
      window.localStorage.setItem(
        "narrative-chess:saved-matches",
        JSON.stringify([
          {
            id: "corrupted-1",
            name: "Corrupted Match",
            savedAt: "2026-04-06T00:00:00Z",
            moveCount: 0,
            snapshot: { currentFen: "invalid" } // Missing required fields
          }
        ])
      );

      // Listing should skip corrupted records
      const matches = listSavedMatches();
      expect(matches).toHaveLength(0);

      // Adding a valid match should work
      const validSnapshot = createSnapshot();
      saveMatch(validSnapshot);
      const allMatches = listSavedMatches();
      expect(allMatches).toHaveLength(1);
    });

    it("preserves snapshot state independently across multiple saves", () => {
      const snapshot1 = createSnapshot();
      const snapshot2 = createSnapshot();

      // Both snapshots should have identical initial state
      expect(snapshot1.currentFen).toBe(snapshot2.currentFen);
      expect(snapshot1.pieces.length).toBe(snapshot2.pieces.length);

      // Save both with different names
      saveMatch(snapshot1, "Snapshot 1");
      saveMatch(snapshot2, "Snapshot 2");

      // Since both saves happen at the same millisecond with the same state,
      // they will have the same ID. The most recent save (Snapshot 2) will be first.
      // Verify both names appear in the saved list
      const allMatches = listSavedMatches();
      const names = allMatches.map((m) => m.name);

      expect(names).toContain("Snapshot 1");
      expect(names).toContain("Snapshot 2");

      // Verify at least one record exists with the correct FEN
      const snapshotRecords = allMatches.filter((m) => m.snapshot.currentFen === snapshot1.currentFen);
      expect(snapshotRecords.length).toBeGreaterThan(0);
    });

    it("preserves custom match names through save/load cycle", () => {
      const snapshot = createSnapshot();
      const customName = "Edinburgh Championship 2026";
      const saved = saveMatch(snapshot, customName);

      const reloaded = getSavedMatch(saved[0]!.id);
      expect(reloaded?.name).toBe(customName);
    });

    it("generates default names with timestamps and move counts", () => {
      const snapshot = createSnapshot();
      // Don't provide a custom name, so default is used
      const saved = saveMatch(snapshot);

      const reloaded = getSavedMatch(saved[0]!.id);
      expect(reloaded?.name).toContain("Edinburgh match");
      expect(reloaded?.name).toContain("0 moves");
    });

    it("uses saved city metadata in default names", () => {
      const saved = saveMatch(createSnapshot(), undefined, londonMetadata);

      expect(saved[0]?.name).toContain("London match");
      expect(getSavedMatch(saved[0]!.id)?.cityMetadata).toEqual(londonMetadata);
    });

    it("keeps legacy saved matches without city metadata readable", () => {
      const snapshot = createSnapshot();
      window.localStorage.setItem(
        "narrative-chess:saved-matches",
        JSON.stringify([
          {
            id: "legacy-1",
            name: "Legacy Match",
            savedAt: "2026-04-06T00:00:00Z",
            moveCount: 0,
            snapshot
          }
        ])
      );

      const matches = listSavedMatches();
      expect(matches).toHaveLength(1);
      expect(matches[0]?.cityMetadata).toBeNull();
      expect(matches[0]?.snapshot.currentFen).toBe(snapshot.currentFen);
    });

    it("handles whitespace-trimmed custom names", () => {
      const snapshot = createSnapshot();
      const saved = saveMatch(snapshot, "  Match with spaces  ");

      const reloaded = getSavedMatch(saved[0]!.id);
      expect(reloaded?.name).toBe("Match with spaces");
      expect(reloaded?.name).not.toContain("  ");
    });

    it("maintains referential integrity of piece IDs in saved state", () => {
      const originalSnapshot = createSnapshot();
      const savedRecords = saveMatch(originalSnapshot, "Piece Integrity Test");

      const reloadedRecord = getSavedMatch(savedRecords[0]!.id);

      // All pieces in reloaded snapshot should have consistent IDs
      const pieceIds = new Set(reloadedRecord?.snapshot.pieces.map((p) => p.pieceId));
      expect(pieceIds.size).toBe(32);

      // No duplicate IDs
      for (const piece of reloadedRecord?.snapshot.pieces ?? []) {
        const count = (reloadedRecord?.snapshot.pieces ?? []).filter((p) => p.pieceId === piece.pieceId).length;
        expect(count).toBe(1);
      }
    });
  });
});
