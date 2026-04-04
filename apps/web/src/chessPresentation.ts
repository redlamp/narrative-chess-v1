import type {
  PieceKind,
  PieceSide
} from "@narrative-chess/content-schema";

export const pieceKindLabels: Record<PieceKind, string> = {
  pawn: "Pawn",
  rook: "Rook",
  knight: "Knight",
  bishop: "Bishop",
  queen: "Queen",
  king: "King"
};

const pieceGlyphs: Record<PieceSide, Record<PieceKind, string>> = {
  white: {
    pawn: "\u2659",
    rook: "\u2656",
    knight: "\u2658",
    bishop: "\u2657",
    queen: "\u2655",
    king: "\u2654"
  },
  black: {
    pawn: "\u265F",
    rook: "\u265C",
    knight: "\u265E",
    bishop: "\u265D",
    queen: "\u265B",
    king: "\u265A"
  }
};

export function getPieceGlyph(input: {
  side: PieceSide;
  kind: PieceKind;
}) {
  return pieceGlyphs[input.side][input.kind];
}

export function getPieceKindLabel(kind: PieceKind) {
  return pieceKindLabels[kind];
}

export function getPieceDisplayName(input: {
  side: PieceSide;
  kind: PieceKind;
}) {
  return `${input.side === "white" ? "White" : "Black"} ${pieceKindLabels[input.kind]}`;
}
