import { describe, expect, it } from "vitest";
import {
  applyMove,
  createInitialGameSnapshot,
  createReplayFromPgn,
  createSnapshotFromFen,
  getBoardSquares,
  getPieceAtSquare,
  listLegalMoves,
  undoLastMove
} from "./index";

describe("game-core", () => {
  it("lists legal opening moves and applies a basic move", () => {
    const snapshot = createInitialGameSnapshot({});

    expect(listLegalMoves(snapshot, "e2")).toEqual(["e3", "e4"]);

    const result = applyMove(snapshot, { from: "e2", to: "e4" });
    expect(result).not.toBeNull();

    const next = result!.nextState;
    expect(next.status.turn).toBe("black");
    expect(next.moveHistory).toHaveLength(1);
    expect(getPieceAtSquare(next, "e4")?.pieceId).toBe("white-pawn-e");
    expect(getPieceAtSquare(next, "e2")).toBeNull();
  });

  it("tracks captures and removes the captured piece", () => {
    let snapshot = createInitialGameSnapshot({});

    const first = applyMove(snapshot, { from: "e2", to: "e4" });
    expect(first).not.toBeNull();
    snapshot = first!.nextState;

    const second = applyMove(snapshot, { from: "d7", to: "d5" });
    expect(second).not.toBeNull();
    snapshot = second!.nextState;

    const third = applyMove(snapshot, { from: "e4", to: "d5" });
    expect(third).not.toBeNull();

    expect(third!.move.capturedPieceId).toBe("black-pawn-d");
    expect(getPieceAtSquare(third!.nextState, "d5")?.pieceId).toBe("white-pawn-e");
    expect(getPieceAtSquare(third!.nextState, "d7")).toBeNull();
  });

  it("detects Fool's Mate checkmate", () => {
    let snapshot = createInitialGameSnapshot({});
    const moves = [
      { from: "f2", to: "f3" },
      { from: "e7", to: "e5" },
      { from: "g2", to: "g4" },
      { from: "d8", to: "h4" }
    ] as const;

    for (const move of moves) {
      const applied = applyMove(snapshot, move);
      expect(applied).not.toBeNull();
      snapshot = applied!.nextState;
    }

    expect(snapshot.status.isCheckmate).toBe(true);
    expect(snapshot.status.outcome).toBe("black-win");
    expect(snapshot.status.turn).toBe("white");
    expect(snapshot.moveHistory.at(-1)?.san).toBe("Qh4#");
  });

  it("loads and reports a stalemate position", () => {
    const snapshot = createSnapshotFromFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1");

    expect(snapshot.status.isStalemate).toBe(true);
    expect(snapshot.status.outcome).toBe("draw");
    expect(listLegalMoves(snapshot, "h8")).toEqual([]);
    expect(getBoardSquares(snapshot).filter((cell) => cell.occupant).length).toBe(3);
  });

  it("loads PGN text into a replay timeline", () => {
    const replay = createReplayFromPgn(`
[Event "Example"]
[Site "Local"]
[Date "2026.04.04"]
[Round "1"]
[White "White"]
[Black "Black"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0
`);

    expect(replay.headers.Event).toBe("Example");
    expect(replay.snapshots).toHaveLength(7);
    expect(replay.snapshots.at(-1)?.moveHistory.at(-1)?.san).toBe("a6");
    expect(replay.snapshots.at(-1)?.status.turn).toBe("white");
  });

  it("undoes the last move and restores the exact prior snapshot", () => {
    const snapshot = createInitialGameSnapshot({});

    const first = applyMove(snapshot, { from: "e2", to: "e4" });
    expect(first).not.toBeNull();
    const afterWhite = {
      ...first!.nextState,
      eventHistory: [
        {
          id: "event-move-0001",
          moveId: "move-0001",
          moveNumber: 1,
          actorPieceId: "white-pawn-e",
          targetPieceId: null,
          location: "e4",
          eventType: "move" as const,
          headline: "White pawn advances",
          detail: "A quiet opening move."
        }
      ]
    };

    const second = applyMove(afterWhite, { from: "e7", to: "e5" });
    expect(second).not.toBeNull();
    const afterBlack = {
      ...second!.nextState,
      eventHistory: [
        ...afterWhite.eventHistory,
        {
          id: "event-move-0002",
          moveId: "move-0002",
          moveNumber: 2,
          actorPieceId: "black-pawn-e",
          targetPieceId: null,
          location: "e5",
          eventType: "move" as const,
          headline: "Black answers in kind",
          detail: "The center remains contested."
        }
      ]
    };

    const undone = undoLastMove(afterBlack);
    expect(undone).not.toBeNull();
    expect(undone).toEqual(afterWhite);
  });
});
