export type MultiplayerDiagnosticSession = {
  status: "invited" | "active" | "completed" | "abandoned" | "cancelled";
  yourSide: "white" | "black" | "spectator";
  currentTurn: "white" | "black" | null;
  syncedMoveCount: number;
};

export type MultiplayerDiagnosticInput = {
  session: MultiplayerDiagnosticSession | null;
  accountEmail: string | null;
  accountUsername: string | null;
  totalPlies: number;
  isSyncingMove: boolean;
  hasPendingMove: boolean;
};

export type MultiplayerDiagnostics = {
  accountLabel: string;
  sideLabel: string;
  turnLabel: string;
  statusLabel: string;
  syncedPlyLabel: string;
  lockLabel: string;
  boardNotice: string | null;
};

function sideLabel(side: MultiplayerDiagnosticSession["yourSide"]) {
  return side === "white" ? "White" : side === "black" ? "Black" : "Spectator";
}

function turnLabel(turn: MultiplayerDiagnosticSession["currentTurn"]) {
  return turn === "white" ? "White" : turn === "black" ? "Black" : "None";
}

function statusLabel(status: MultiplayerDiagnosticSession["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "invited":
      return "Invite pending";
    case "completed":
      return "Complete";
    case "abandoned":
      return "Abandoned";
    case "cancelled":
      return "Cancelled";
  }
}

export function getMultiplayerDiagnostics(input: MultiplayerDiagnosticInput): MultiplayerDiagnostics | null {
  if (!input.session) {
    return null;
  }

  const { session } = input;
  const accountLabel = input.accountUsername
    ? `@${input.accountUsername}`
    : input.accountEmail ?? "Signed in";
  const isOwnTurn =
    session.status === "active" &&
    session.currentTurn !== null &&
    session.currentTurn === session.yourSide;
  const canMove =
    isOwnTurn &&
    !input.isSyncingMove &&
    !input.hasPendingMove &&
    (session.yourSide === "white" || session.yourSide === "black");

  let lockLabel = "Locked";
  let boardNotice: string | null = null;

  if (session.status !== "active") {
    lockLabel = "Locked";
    boardNotice = null;
  } else if (input.isSyncingMove || input.hasPendingMove) {
    lockLabel = "Syncing move";
    boardNotice = "Syncing move";
  } else if (canMove) {
    lockLabel = "Unlocked";
    boardNotice = `You are ${sideLabel(session.yourSide)}`;
  } else if (session.currentTurn) {
    lockLabel = `Waiting for ${turnLabel(session.currentTurn)}`;
    boardNotice = `Waiting for ${turnLabel(session.currentTurn)}. You are ${sideLabel(session.yourSide)}.`;
  }

  return {
    accountLabel,
    sideLabel: sideLabel(session.yourSide),
    turnLabel: turnLabel(session.currentTurn),
    statusLabel: statusLabel(session.status),
    syncedPlyLabel: `${session.syncedMoveCount}/${input.totalPlies}`,
    lockLabel,
    boardNotice
  };
}
