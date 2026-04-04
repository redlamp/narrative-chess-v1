import type { MouseEvent } from "react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import type {
  DistrictCell,
  GameSnapshot,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { getPieceGlyph } from "../chessPresentation";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

type BoardCell = {
  square: Square;
  occupant: PieceState | null;
  isLight: boolean;
};

type BoardProps = {
  snapshot: GameSnapshot;
  cells: BoardCell[];
  selectedSquare: Square | null;
  hoveredSquare: Square | null;
  legalMoves: Square[];
  viewMode: "board" | "map";
  districtsBySquare: Map<Square, DistrictCell>;
  showCoordinates: boolean;
  showDistrictLabels: boolean;
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square) => void;
  onSquareLeave: () => void;
};

function squareName(file: (typeof files)[number], rank: (typeof ranks)[number]) {
  return `${file}${rank}` as Square;
}

function getGlyph(piece: PieceState | null) {
  if (!piece) {
    return "";
  }

  return getPieceGlyph({
    side: piece.side,
    kind: piece.kind
  });
}

function formatDistrictLabel(name: string, viewMode: "board" | "map") {
  if (viewMode === "map" || name.length <= 10) {
    return name;
  }

  return `${name.slice(0, 9)}...`;
}

export function Board({
  snapshot,
  cells,
  selectedSquare,
  hoveredSquare,
  legalMoves,
  viewMode,
  districtsBySquare,
  showCoordinates,
  showDistrictLabels,
  onSquareClick,
  onSquareHover,
  onSquareLeave
}: BoardProps) {
  const cellMap = new Map(cells.map((cell) => [cell.square, cell]));

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const square = event.currentTarget.dataset.square as Square | undefined;
    if (square) {
      onSquareClick(square);
    }
  };

  return (
    <div className="board-shell">
      <div
        className={["board-grid", viewMode === "map" ? "board-grid--map" : ""].filter(Boolean).join(" ")}
        role="grid"
        aria-label="Chess board"
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = squareName(file, rank);
            const cell = cellMap.get(square);
            const piece = cell?.occupant ?? getPieceAtSquare(snapshot, square);
            const district = districtsBySquare.get(square) ?? null;
            const isSelected = selectedSquare === square;
            const isHovered = hoveredSquare === square;
            const isLegalTarget = legalMoves.includes(square);

            return (
              <button
                key={square}
                type="button"
                className={[
                  "board-square",
                  cell?.isLight ? "board-square--light" : "board-square--dark",
                  viewMode === "map" ? "board-square--map" : "",
                  isSelected ? "board-square--selected" : "",
                  isHovered ? "board-square--hovered" : "",
                  isLegalTarget ? "board-square--target" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-square={square}
                aria-pressed={isSelected}
                aria-label={`${square}${piece ? `, ${piece.side} ${piece.kind}` : ""}${district ? `, ${district.name}` : ""}`}
                onClick={handleClick}
                onMouseEnter={() => onSquareHover(square)}
                onMouseLeave={onSquareLeave}
                onFocus={() => onSquareHover(square)}
                onBlur={onSquareLeave}
              >
                {showCoordinates ? (
                  <>
                    <span className="board-square__coordinate board-square__coordinate--top">
                      {file === "a" ? rank : ""}
                    </span>
                    <span className="board-square__coordinate board-square__coordinate--bottom">
                      {rank === "1" ? file : ""}
                    </span>
                  </>
                ) : null}
                {district && showDistrictLabels ? (
                  <span className={`board-square__district board-square__district--${viewMode}`}>
                    {formatDistrictLabel(district.name, viewMode)}
                  </span>
                ) : null}
                <span className={`board-square__piece ${piece ? `is-${piece.side}` : "is-empty"} ${viewMode === "map" ? "is-map" : ""}`}>
                  {getGlyph(piece)}
                </span>
                {isLegalTarget ? <span className="board-square__target-dot" /> : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
