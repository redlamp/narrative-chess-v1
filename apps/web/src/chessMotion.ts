import type { GameSnapshot, PieceKind, PieceState, Square } from "@narrative-chess/content-schema";
import { boardFiles, boardRanks } from "./boardNavigation";

export type AnimatedPieceFrame = {
  pieceId: string;
  side: PieceState["side"];
  kind: PieceKind;
  fromSquare: Square | null;
  toSquare: Square | null;
  displaySquare: Square | null;
  progress: number;
  opacity: number;
  isMoving: boolean;
  zIndex: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePieceProgress(progress: number) {
  if (progress <= 0.01) {
    return 0;
  }

  if (progress >= 0.99) {
    return 1;
  }

  return progress;
}

function easeInOutSine(progress: number) {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

function getCapturedPieceOpacity(progress: number) {
  if (progress <= 0.82) {
    return 1;
  }

  return clamp(1 - (progress - 0.82) / 0.18, 0, 1);
}

function getDisplayKind(piece: PieceState | null) {
  return piece?.promotedTo ?? piece?.kind ?? "pawn";
}

function getPieceById(snapshot: GameSnapshot) {
  return new Map(snapshot.pieces.map((piece) => [piece.pieceId, piece] as const));
}

export function getAnimatedPieceFrames(input: {
  snapshots: GameSnapshot[];
  playhead: number;
}) {
  const { snapshots } = input;
  if (snapshots.length === 0) {
    return [] as AnimatedPieceFrame[];
  }

  const maxPly = Math.max(0, snapshots.length - 1);
  const clampedPlayhead = clamp(input.playhead, 0, maxPly);
  const fromPly = Math.floor(clampedPlayhead);
  const toPly = Math.min(maxPly, Math.ceil(clampedPlayhead));
  const rawProgress = toPly === fromPly ? 0 : normalizePieceProgress(clampedPlayhead - fromPly);
  const progress = rawProgress === 0 || rawProgress === 1 ? rawProgress : easeInOutSine(rawProgress);
  const fromSnapshot = snapshots[fromPly] ?? snapshots[0]!;
  const toSnapshot = snapshots[toPly] ?? fromSnapshot;
  const fromPieces = getPieceById(fromSnapshot);
  const toPieces = getPieceById(toSnapshot);
  const pieceIds = new Set([...fromPieces.keys(), ...toPieces.keys()]);

  return Array.from(pieceIds)
    .map((pieceId) => {
      const fromPiece = fromPieces.get(pieceId) ?? null;
      const toPiece = toPieces.get(pieceId) ?? null;
      const fromSquare = fromPiece?.square ?? null;
      const toSquare = toPiece?.square ?? null;

      if (fromSquare === null && toSquare === null) {
        return null;
      }

      const opacity = fromSquare !== null && toSquare === null ? getCapturedPieceOpacity(progress) : 1;
      const isMoving = fromSquare !== toSquare;
      const kind =
        progress >= 0.6
          ? getDisplayKind(toPiece)
          : getDisplayKind(fromPiece);
      const displaySquare =
        progress >= 0.5
          ? toSquare ?? fromSquare
          : fromSquare ?? toSquare;

      return {
        pieceId,
        side: toPiece?.side ?? fromPiece?.side ?? "white",
        kind,
        fromSquare,
        toSquare,
        displaySquare,
        progress,
        opacity,
        isMoving,
        zIndex: isMoving ? 2 : 1
      } satisfies AnimatedPieceFrame;
    })
    .filter((piece): piece is AnimatedPieceFrame => piece !== null)
    .sort((left, right) => left.zIndex - right.zIndex || left.pieceId.localeCompare(right.pieceId));
}

function interpolateUnit(valueFrom: number, valueTo: number, progress: number) {
  return valueFrom + (valueTo - valueFrom) * progress;
}

function getBoardSquarePosition(square: Square) {
  return {
    x: boardFiles.indexOf(square[0] as (typeof boardFiles)[number]),
    y: boardRanks.indexOf(square[1] as (typeof boardRanks)[number])
  };
}

export function getAnimatedBoardPosition(piece: AnimatedPieceFrame) {
  const fallbackSquare = piece.displaySquare ?? piece.fromSquare ?? piece.toSquare;
  if (!fallbackSquare) {
    return null;
  }

  const fromPosition = piece.fromSquare ? getBoardSquarePosition(piece.fromSquare) : null;
  const toPosition = piece.toSquare ? getBoardSquarePosition(piece.toSquare) : null;
  if (fromPosition && toPosition) {
    return {
      x: interpolateUnit(fromPosition.x, toPosition.x, piece.progress),
      y: interpolateUnit(fromPosition.y, toPosition.y, piece.progress)
    };
  }

  return getBoardSquarePosition(fallbackSquare);
}

