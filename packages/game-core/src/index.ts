import { Chess, type Square as ChessSquare } from "chess.js";
import type {
  CharacterSummary,
  GameSnapshot,
  MatchOutcome,
  MatchStatus,
  MoveApplication,
  MoveInput,
  MoveRecord,
  PieceKind,
  PieceState,
  PieceSide,
  Square
} from "@narrative-chess/content-schema";
import {
  boardFiles,
  boardRanks,
  promotionChoices,
  startingPieceBlueprints
} from "@narrative-chess/content-schema";

type ChessMove = NonNullable<ReturnType<Chess["move"]>>;
type ChessBoardCell = {
  square: string;
  type: string;
  color: string;
};

export interface BoardCell {
  square: Square;
  occupant: PieceState | null;
  isLight: boolean;
}

export interface PgnReplay {
  headers: Record<string, string>;
  snapshots: GameSnapshot[];
  pgn: string;
}

const defaultInitialFen = new Chess().fen();

const pieceKindByChessCode: Record<string, PieceKind> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king"
};

const canonicalInitialPieces: PieceState[] = startingPieceBlueprints.map((blueprint) => ({
  pieceId: blueprint.pieceId,
  side: blueprint.side,
  kind: blueprint.kind,
  square: blueprint.square,
  promotedTo: null
}));

const fallbackTraitsByKind: Record<PieceKind, string[]> = {
  pawn: ["steady", "resourceful", "practical", "patient"],
  rook: ["direct", "unyielding", "protective", "plainspoken"],
  knight: ["adaptive", "restless", "canny", "unpredictable"],
  bishop: ["observant", "reflective", "subtle", "careful"],
  queen: ["commanding", "versatile", "sharp", "resilient"],
  king: ["guarded", "deliberate", "dignified", "vulnerable"]
};

const fallbackVerbsByKind: Record<PieceKind, string[]> = {
  pawn: ["advance", "shield", "pivot", "endure"],
  rook: ["hold", "press", "anchor", "fortify"],
  knight: ["fork", "weave", "leap", "probe"],
  bishop: ["angle", "watch", "thread", "swing"],
  queen: ["command", "adapt", "contest", "oversee"],
  king: ["direct", "survive", "withdraw", "endure"]
};

const defaultPromotionChoice = promotionChoices[0];

function createFallbackCharacter(piece: PieceState): CharacterSummary {
  const title = `${piece.side === "white" ? "White" : "Black"} ${piece.kind}`;

  return {
    id: piece.pieceId,
    pieceId: piece.pieceId,
    side: piece.side,
    pieceKind: piece.kind,
    fullName: `${title} ${piece.square ?? "unknown"}`,
    role: piece.kind,
    districtOfOrigin: "unassigned district",
    faction: `${piece.side} cohort`,
    traits: fallbackTraitsByKind[piece.kind],
    verbs: fallbackVerbsByKind[piece.kind],
    oneLineDescription: `${title} kept deliberately lightweight for the first playable slice.`,
    generationSource: "game-core fallback",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "needs review",
    reviewNotes: null,
    lastReviewedAt: null
  };
}

function normalizeCharacters(
  characters: Record<string, CharacterSummary>,
  pieces: PieceState[]
): Record<string, CharacterSummary> {
  const roster: Record<string, CharacterSummary> = { ...characters };

  for (const piece of pieces) {
    if (!roster[piece.pieceId]) {
      roster[piece.pieceId] = createFallbackCharacter(piece);
    }
  }

  return roster;
}

function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

function chessCodeToPieceKind(code: string): PieceKind {
  return pieceKindByChessCode[code];
}

function sideFromChessColor(color: "w" | "b"): PieceSide {
  return color === "w" ? "white" : "black";
}

function pieceTone(square: Square): boolean {
  const fileIndex = boardFiles.indexOf(square[0] as (typeof boardFiles)[number]);
  const rankIndex = Number(square[1]);
  return (fileIndex + rankIndex) % 2 === 0;
}

function getEffectivePieceKind(piece: PieceState): PieceKind {
  return piece.promotedTo ?? piece.kind;
}

function buildInitialPieces(): PieceState[] {
  return canonicalInitialPieces.map((piece) => ({ ...piece }));
}

function buildPiecesFromBoard(
  board: ChessBoardCell[][],
  idFactory: (input: { square: Square; side: PieceSide; kind: PieceKind }) => string
): PieceState[] {
  const pieces: PieceState[] = [];

  for (const row of board) {
    for (const cell of row) {
      if (!cell) {
        continue;
      }

      const square = cell.square as Square;
      pieces.push({
        pieceId: idFactory({
          square,
          side: sideFromChessColor(cell.color as "w" | "b"),
          kind: chessCodeToPieceKind(cell.type)
        }),
        side: sideFromChessColor(cell.color as "w" | "b"),
        kind: chessCodeToPieceKind(cell.type),
        square,
        promotedTo: null
      });
    }
  }

  return pieces;
}

function buildStatus(chess: Chess): MatchStatus {
  const turn = sideFromChessColor(chess.turn());
  const isCheck = chess.isCheck();
  const isCheckmate = chess.isCheckmate();
  const isStalemate = chess.isStalemate();
  const isDraw = chess.isDraw();

  let outcome: MatchOutcome = "active";
  if (isCheckmate) {
    outcome = turn === "white" ? "black-win" : "white-win";
  } else if (isStalemate || isDraw) {
    outcome = "draw";
  }

  return {
    turn,
    isCheck,
    isCheckmate,
    isStalemate,
    outcome
  };
}

function createSnapshot(
  chess: Chess,
  pieces: PieceState[],
  characters: Record<string, CharacterSummary>,
  moveHistory: MoveRecord[],
  eventHistory: GameSnapshot["eventHistory"]
): GameSnapshot {
  return {
    currentFen: chess.fen(),
    pieces: pieces.map((piece) => ({ ...piece })),
    characters: { ...characters },
    moveHistory: moveHistory.map((move) => ({ ...move })),
    eventHistory: eventHistory.map((event) => ({ ...event })),
    status: buildStatus(chess)
  };
}

function createMoveRecord(
  moveNumber: number,
  mover: PieceState,
  appliedMove: ChessMove,
  capturedPieceId: string | null
): MoveRecord {
  const promotion = appliedMove.promotion
    ? chessCodeToPieceKind(appliedMove.promotion)
    : null;

  return {
    id: `move-${moveNumber.toString().padStart(4, "0")}`,
    moveNumber,
    side: mover.side,
    from: appliedMove.from as Square,
    to: appliedMove.to as Square,
    san: appliedMove.san,
    pieceId: mover.pieceId,
    pieceKind: getEffectivePieceKind(mover),
    capturedPieceId,
    promotion,
    isCheck: appliedMove.san.includes("+") || appliedMove.san.includes("#"),
    isCheckmate: appliedMove.san.includes("#"),
    isStalemate: false,
    fenAfter: appliedMove.after
  };
}

function getCaptureSquare(move: ChessMove, mover: PieceState, beforePieces: PieceState[]): Square | null {
  if (!move.captured) {
    return null;
  }

  const destinationOccupant = beforePieces.find((piece) => piece.square === move.to);
  if (destinationOccupant) {
    return move.to as Square;
  }

  if (getEffectivePieceKind(mover) === "pawn" && move.from[0] !== move.to[0]) {
    return `${move.to[0]}${move.from[1]}` as Square;
  }

  return move.to as Square;
}

function applyMoveToPieces(
  pieces: PieceState[],
  mover: PieceState,
  move: ChessMove,
  capturedPieceId: string | null
): PieceState[] {
  const isKingsideCastle = move.san.startsWith("O-O") && !move.san.startsWith("O-O-O");
  const isQueensideCastle = move.san.startsWith("O-O-O");
  const rookFrom = isKingsideCastle
    ? mover.side === "white"
      ? ("h1" as Square)
      : ("h8" as Square)
    : isQueensideCastle
      ? mover.side === "white"
        ? ("a1" as Square)
        : ("a8" as Square)
      : null;
  const rookTo = isKingsideCastle
    ? mover.side === "white"
      ? ("f1" as Square)
      : ("f8" as Square)
    : isQueensideCastle
      ? mover.side === "white"
        ? ("d1" as Square)
        : ("d8" as Square)
      : null;

  const promotion = move.promotion ? chessCodeToPieceKind(move.promotion) : null;

  return pieces.map((piece) => {
    if (piece.pieceId === mover.pieceId) {
      return {
        ...piece,
        square: move.to as Square,
        promotedTo: promotion ?? piece.promotedTo
      };
    }

    if (capturedPieceId && piece.pieceId === capturedPieceId) {
      return {
        ...piece,
        square: null
      };
    }

    if (rookFrom && rookTo && piece.square === rookFrom) {
      return {
        ...piece,
        square: rookTo
      };
    }

    return piece;
  });
}

function createSnapshotFromHistory(
  characters: Record<string, CharacterSummary>,
  moveHistory: MoveRecord[],
  eventHistory: GameSnapshot["eventHistory"]
): GameSnapshot {
  let snapshot = createInitialGameSnapshot(characters);

  for (const move of moveHistory) {
    const applied = applyMove(snapshot, {
      from: move.from,
      to: move.to,
      promotion: move.promotion ? pieceKindToChessPromotion(move.promotion) : undefined
    });

    if (!applied) {
      throw new Error(`Unable to replay move ${move.san} while rebuilding a snapshot.`);
    }

    snapshot = applied.nextState;
  }

  return {
    ...snapshot,
    eventHistory: eventHistory.map((event) => ({ ...event }))
  };
}

function pieceKindToChessPromotion(kind: PieceKind): "q" | "r" | "b" | "n" {
  switch (kind) {
    case "queen":
      return "q";
    case "rook":
      return "r";
    case "bishop":
      return "b";
    case "knight":
      return "n";
    default:
      return "q";
  }
}

function getInitialFenFromHeaders(headers: Record<string, string>) {
  return headers.SetUp === "1" && headers.FEN ? headers.FEN : defaultInitialFen;
}

export function createInitialGameSnapshot(
  characters: Record<string, CharacterSummary>
): GameSnapshot {
  const chess = new Chess(defaultInitialFen);
  const pieces = buildInitialPieces();
  const roster = normalizeCharacters(characters, pieces);

  return createSnapshot(chess, pieces, roster, [], []);
}

export function createSnapshotFromFen(
  fen: string,
  characters: Record<string, CharacterSummary> = {},
  moveHistory: MoveRecord[] = [],
  eventHistory: GameSnapshot["eventHistory"] = []
): GameSnapshot {
  const chess = new Chess(fen);
  const blueprintBySquare = new Map(
    startingPieceBlueprints.map((blueprint) => [blueprint.square, blueprint] as const)
  );
  const pieces = buildPiecesFromBoard(chess.board() as ChessBoardCell[][], ({ square, side, kind }) => {
    const blueprint = blueprintBySquare.get(square);
    if (blueprint && blueprint.side === side && blueprint.kind === kind) {
      return blueprint.pieceId;
    }

    return `${side}-${kind}-${square}`;
  });
  const roster = normalizeCharacters(characters, pieces);

  return createSnapshot(chess, pieces, roster, moveHistory, eventHistory);
}

export function createReplayFromPgn(
  pgn: string,
  characters: Record<string, CharacterSummary> = {}
): PgnReplay {
  const parser = new Chess();

  try {
    parser.loadPgn(pgn, { strict: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PGN import error.";
    throw new Error(`Unable to load PGN: ${message}`);
  }

  const headers = parser.getHeaders();
  const initialFen = getInitialFenFromHeaders(headers);
  const verboseHistory = parser.history({ verbose: true }) as ChessMove[];
  let snapshot =
    initialFen === defaultInitialFen
      ? createInitialGameSnapshot(characters)
      : createSnapshotFromFen(initialFen, characters);
  const snapshots: GameSnapshot[] = [snapshot];

  for (const move of verboseHistory) {
    let promotion: MoveInput["promotion"];
    switch (move.promotion) {
      case "q":
      case "r":
      case "b":
      case "n":
        promotion = move.promotion;
        break;
      default:
        promotion = undefined;
    }
    const applied = applyMove(snapshot, {
      from: move.from as Square,
      to: move.to as Square,
      ...(promotion ? { promotion } : {})
    });

    if (!applied) {
      throw new Error(`Unable to replay PGN move ${move.san}.`);
    }

    snapshot = applied.nextState;
    snapshots.push(snapshot);
  }

  return {
    headers,
    snapshots,
    pgn
  };
}

export function listLegalMoves(snapshot: GameSnapshot, square: Square): Square[] {
  if (!isSquare(square)) {
    return [];
  }

  const chess = new Chess(snapshot.currentFen);
  return chess
    .moves({ square: square as ChessSquare, verbose: true })
    .map((move) => move.to as Square);
}

export function getPieceAtSquare(snapshot: GameSnapshot, square: Square): PieceState | null {
  return snapshot.pieces.find((piece) => piece.square === square) ?? null;
}

export function getBoardSquares(snapshot: GameSnapshot): BoardCell[] {
  const cells: BoardCell[] = [];

  for (const rank of [...boardRanks].reverse()) {
    for (const file of boardFiles) {
      const square = `${file}${rank}` as Square;
      cells.push({
        square,
        occupant: getPieceAtSquare(snapshot, square),
        isLight: pieceTone(square)
      });
    }
  }

  return cells;
}

export function applyMove(
  snapshot: GameSnapshot,
  move: MoveInput
): MoveApplication | null {
  if (!isSquare(move.from) || !isSquare(move.to)) {
    return null;
  }

  const mover = getPieceAtSquare(snapshot, move.from);
  if (!mover) {
    return null;
  }

  if (mover.side !== snapshot.status.turn) {
    return null;
  }

  const chess = new Chess(snapshot.currentFen);
  const promotionNeeded =
    mover.kind === "pawn" &&
    ((mover.side === "white" && move.to.endsWith("8")) ||
      (mover.side === "black" && move.to.endsWith("1")));
  const promotion = move.promotion ?? (promotionNeeded ? pieceKindToChessPromotion(defaultPromotionChoice) : undefined);

  let appliedMove: ChessMove | null = null;
  try {
    appliedMove = chess.move({
      from: move.from,
      to: move.to,
      ...(promotion ? { promotion } : {})
    }) as ChessMove | null;
  } catch {
    return null;
  }

  if (!appliedMove) {
    return null;
  }

  const beforePieces = snapshot.pieces;
  const capturedSquare = getCaptureSquare(appliedMove, mover, beforePieces);
  const capturedPieceId = capturedSquare
    ? beforePieces.find((piece) => piece.square === capturedSquare)?.pieceId ?? null
    : null;

  const nextPieces = applyMoveToPieces(beforePieces, mover, appliedMove, capturedPieceId);
  const moveNumber = snapshot.moveHistory.length + 1;
  const record = createMoveRecord(moveNumber, mover, appliedMove, capturedPieceId);
  const nextMoveHistory = [...snapshot.moveHistory, record];
  const nextSnapshot = createSnapshot(
    chess,
    nextPieces,
    snapshot.characters,
    nextMoveHistory,
    snapshot.eventHistory
  );
  const finalizedRecord: MoveRecord = {
    ...record,
    isCheck: nextSnapshot.status.isCheck,
    isCheckmate: nextSnapshot.status.isCheckmate,
    isStalemate: nextSnapshot.status.isStalemate
  };
  const finalizedMoveHistory = [...snapshot.moveHistory, finalizedRecord];

  return {
    nextState: {
      ...nextSnapshot,
      moveHistory: finalizedMoveHistory,
      pieces: nextPieces
    },
    move: finalizedRecord
  };
}

export function undoLastMove(snapshot: GameSnapshot): GameSnapshot | null {
  if (snapshot.moveHistory.length === 0) {
    return null;
  }

  const priorMoves = snapshot.moveHistory.slice(0, -1);
  const priorEvents = snapshot.eventHistory.slice(0, priorMoves.length);
  return createSnapshotFromHistory(snapshot.characters, priorMoves, priorEvents);
}
