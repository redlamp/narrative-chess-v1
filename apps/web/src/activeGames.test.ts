import { describe, expect, it } from "vitest";
import type { GameSnapshot, MoveRecord } from "@narrative-chess/content-schema";
import {
  describeMultiplayerMoveError,
  formatTimeControlLabel,
  getSupabaseMovePromotion,
  getTimeControlPresetById,
  resolveTimeoutDeadlineMs,
  shouldReportMoveAsDraw,
  timeControlPresets
} from "./activeGames";

describe("activeGames append move helpers", () => {
  it("maps chess promotion pieces to Supabase move notation", () => {
    expect(getSupabaseMovePromotion("queen")).toBe("q");
    expect(getSupabaseMovePromotion("rook")).toBe("r");
    expect(getSupabaseMovePromotion("bishop")).toBe("b");
    expect(getSupabaseMovePromotion("knight")).toBe("n");
  });

  it("omits non-promotion pieces from Supabase move payloads", () => {
    expect(getSupabaseMovePromotion(null)).toBeNull();
    expect(getSupabaseMovePromotion("pawn")).toBeNull();
    expect(getSupabaseMovePromotion("king")).toBeNull();
  });
});

describe("resolveTimeoutDeadlineMs", () => {
  const baseGame = {
    status: "active" as const,
    currentTurn: "black" as const,
    yourSide: "white" as const,
    yourParticipantStatus: "active" as const,
    deadlineAt: "2026-04-20T12:00:00.000Z"
  };

  it("returns the deadline timestamp when the caller can claim", () => {
    expect(resolveTimeoutDeadlineMs(baseGame)).toBe(Date.parse(baseGame.deadlineAt));
  });

  it("ignores deadlines on the caller's own turn", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, currentTurn: "white" })
    ).toBeNull();
  });

  it("ignores deadlines when not active", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, status: "completed" })
    ).toBeNull();
  });

  it("ignores deadlines when viewer is a spectator", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, yourSide: "spectator" })
    ).toBeNull();
  });

  it("ignores invalid deadline strings", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, deadlineAt: "not a date" })
    ).toBeNull();
  });

  it("ignores missing deadlines", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, deadlineAt: null })
    ).toBeNull();
  });

  it("ignores deadlines when viewer's participant row is not active", () => {
    expect(
      resolveTimeoutDeadlineMs({ ...baseGame, yourParticipantStatus: "left" })
    ).toBeNull();
  });
});

describe("getTimeControlPresetById", () => {
  it("returns the preset for a known id", () => {
    expect(getTimeControlPresetById("live-10-0")?.label).toBe("10 min");
    expect(getTimeControlPresetById("deadline-daily")?.label).toBe("1 move / day");
  });

  it("returns null for unknown ids", () => {
    expect(getTimeControlPresetById("not-a-preset")).toBeNull();
    expect(getTimeControlPresetById("")).toBeNull();
  });

  it("exposes the canonical preset list", () => {
    expect(timeControlPresets.length).toBeGreaterThan(0);
    const ids = timeControlPresets.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("formatTimeControlLabel", () => {
  it("prefers the canonical preset label when the input matches a preset", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 900,
        incrementSeconds: 10,
        moveDeadlineSeconds: null
      })
    ).toBe("15 + 10");
  });

  it("matches the correspondence daily preset", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 86400
      })
    ).toBe("1 move / day");
  });

  it("formats custom live clock without increment", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 300,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("5 min");
  });

  it("formats custom live clock with increment", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: 180,
        incrementSeconds: 2,
        moveDeadlineSeconds: null
      })
    ).toBe("3 + 2");
  });

  it("formats correspondence windows in the largest natural unit", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 604800 * 2
      })
    ).toBe("2 move / week");

    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: 3600 * 4
      })
    ).toBe("4 move / hour");
  });

  it("falls back to a generic label when nothing matches", () => {
    expect(
      formatTimeControlLabel({
        timeControlKind: "live_clock",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("Live clock");

    expect(
      formatTimeControlLabel({
        timeControlKind: "move_deadline",
        baseSeconds: null,
        incrementSeconds: 0,
        moveDeadlineSeconds: null
      })
    ).toBe("Move deadline");
  });
});

describe("describeMultiplayerMoveError", () => {
  it("classifies turn and snapshot mismatch errors as resync", () => {
    expect(
      describeMultiplayerMoveError(new Error("It is not your turn in this multiplayer game.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Move snapshot is out of sync with the server game.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Submitted move squares do not match the snapshot.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Submitted move notation does not match the snapshot.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Submitted move position does not match the snapshot.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Submitted move side does not match your multiplayer side.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Move snapshot payload is required.")).kind
    ).toBe("resync");
    expect(
      describeMultiplayerMoveError(new Error("Move snapshot payload must include move history.")).kind
    ).toBe("resync");
  });

  it("classifies clock expiration errors as clock", () => {
    expect(
      describeMultiplayerMoveError(
        new Error("White clock expired before this move could be recorded.")
      ).kind
    ).toBe("clock");
    expect(
      describeMultiplayerMoveError(
        new Error("Black clock expired before this move could be recorded.")
      ).kind
    ).toBe("clock");
  });

  it("classifies unavailable games as unavailable", () => {
    expect(
      describeMultiplayerMoveError(
        new Error("That multiplayer game is not available for this account.")
      ).kind
    ).toBe("unavailable");
    expect(
      describeMultiplayerMoveError(new Error("Only active multiplayer games can accept moves.")).kind
    ).toBe("unavailable");
  });

  it("classifies illegal-move rejections as illegal", () => {
    expect(
      describeMultiplayerMoveError(new Error("There is no piece to move on e4.")).kind
    ).toBe("illegal");
    expect(
      describeMultiplayerMoveError(new Error("You can only move your own pieces.")).kind
    ).toBe("illegal");
    expect(
      describeMultiplayerMoveError(new Error("Move squares must be valid algebraic coordinates.")).kind
    ).toBe("illegal");
    expect(
      describeMultiplayerMoveError(new Error("Promotion must be q, r, b, or n.")).kind
    ).toBe("illegal");
  });

  it("handles PostgrestError-shaped objects with a message field", () => {
    expect(
      describeMultiplayerMoveError({ message: "It is not your turn in this multiplayer game." }).kind
    ).toBe("resync");
  });

  it("falls back to unknown for unrecognized or empty errors", () => {
    expect(describeMultiplayerMoveError(new Error("Something weird happened.")).kind).toBe("unknown");
    expect(describeMultiplayerMoveError(null).kind).toBe("unknown");
    expect(describeMultiplayerMoveError(undefined).kind).toBe("unknown");
    expect(describeMultiplayerMoveError({}).kind).toBe("unknown");
  });

  it("returns a user-facing message for every kind", () => {
    const cases = [
      new Error("It is not your turn in this multiplayer game."),
      new Error("White clock expired before this move could be recorded."),
      new Error("That multiplayer game is not available for this account."),
      new Error("You can only move your own pieces."),
      new Error("Totally unrecognized error.")
    ];
    for (const error of cases) {
      const description = describeMultiplayerMoveError(error);
      expect(description.message.length).toBeGreaterThan(0);
    }
  });
});

describe("shouldReportMoveAsDraw", () => {
  const baseMove: MoveRecord = {
    id: "move-0001",
    moveNumber: 1,
    side: "white",
    from: "e2",
    to: "e4",
    san: "e4",
    pieceId: "white-pawn-e",
    pieceKind: "pawn",
    capturedPieceId: null,
    promotion: null,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    fenAfter: ""
  };

  function makeSnapshot(outcome: GameSnapshot["status"]["outcome"]): GameSnapshot {
    return {
      currentFen: "",
      pieces: [],
      characters: {},
      moveHistory: [],
      eventHistory: [],
      status: {
        turn: "white",
        isCheck: false,
        isCheckmate: false,
        isStalemate: false,
        outcome
      }
    };
  }

  it("reports true stalemate as draw", () => {
    expect(
      shouldReportMoveAsDraw({ ...baseMove, isStalemate: true }, makeSnapshot("draw"))
    ).toBe(true);
  });

  it("reports a non-stalemate draw (threefold / 50-move / insufficient material)", () => {
    expect(shouldReportMoveAsDraw(baseMove, makeSnapshot("draw"))).toBe(true);
  });

  it("does not report active games as draws", () => {
    expect(shouldReportMoveAsDraw(baseMove, makeSnapshot("active"))).toBe(false);
  });

  it("does not report decisive outcomes as draws", () => {
    expect(shouldReportMoveAsDraw(baseMove, makeSnapshot("white-win"))).toBe(false);
    expect(shouldReportMoveAsDraw(baseMove, makeSnapshot("black-win"))).toBe(false);
  });
});
