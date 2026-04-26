import { describe, expect, it } from "vitest";
import { getMultiplayerDiagnostics } from "./multiplayerDiagnostics";

const activeWhiteSession = {
  status: "active" as const,
  yourSide: "white" as const,
  currentTurn: "white" as const,
  syncedMoveCount: 2
};

describe("getMultiplayerDiagnostics", () => {
  it("returns null without a loaded multiplayer session", () => {
    expect(
      getMultiplayerDiagnostics({
        session: null,
        accountEmail: "player@example.com",
        accountUsername: "player_a",
        totalPlies: 2,
        isSyncingMove: false,
        hasPendingMove: false
      })
    ).toBeNull();
  });

  it("shows an unlocked own-turn state", () => {
    expect(
      getMultiplayerDiagnostics({
        session: activeWhiteSession,
        accountEmail: "player@example.com",
        accountUsername: "player_a",
        totalPlies: 2,
        isSyncingMove: false,
        hasPendingMove: false
      })
    ).toMatchObject({
      accountLabel: "@player_a",
      sideLabel: "White",
      turnLabel: "White",
      syncedPlyLabel: "2/2",
      lockLabel: "Unlocked",
      boardNotice: "You are White"
    });
  });

  it("shows waiting state when the opponent is to move", () => {
    expect(
      getMultiplayerDiagnostics({
        session: { ...activeWhiteSession, currentTurn: "black" },
        accountEmail: "player@example.com",
        accountUsername: "player_a",
        totalPlies: 3,
        isSyncingMove: false,
        hasPendingMove: false
      })
    ).toMatchObject({
      lockLabel: "Waiting for Black",
      boardNotice: "Waiting for Black. You are White."
    });
  });

  it("shows syncing state while a local move is pending", () => {
    expect(
      getMultiplayerDiagnostics({
        session: activeWhiteSession,
        accountEmail: "player@example.com",
        accountUsername: null,
        totalPlies: 3,
        isSyncingMove: true,
        hasPendingMove: true
      })
    ).toMatchObject({
      accountLabel: "player@example.com",
      lockLabel: "Syncing move",
      boardNotice: "Syncing move"
    });
  });

  it("keeps spectators locked", () => {
    expect(
      getMultiplayerDiagnostics({
        session: { ...activeWhiteSession, yourSide: "spectator" },
        accountEmail: null,
        accountUsername: null,
        totalPlies: 2,
        isSyncingMove: false,
        hasPendingMove: false
      })
    ).toMatchObject({
      sideLabel: "Spectator",
      lockLabel: "Waiting for White",
      boardNotice: "Waiting for White. You are Spectator."
    });
  });
});
