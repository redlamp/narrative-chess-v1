import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import type {
  DistrictCell,
  GameSnapshot,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { getPieceDisplayName } from "../chessPresentation";
import { PieceArt } from "./PieceArt";
import {
  boardFiles as files,
  boardRanks as ranks,
  getNextBoardFocusSquare,
  squareName
} from "../boardNavigation";

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
  inspectedSquare?: Square | null;
  legalMoves: Square[];
  viewMode: "board" | "map";
  districtsBySquare: Map<Square, DistrictCell>;
  showCoordinates: boolean;
  showDistrictLabels: boolean;
  showPieces?: boolean;
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square) => void;
  onSquareLeave: () => void;
};

function formatDistrictLabel(name: string, viewMode: "board" | "map") {
  if (viewMode === "map" || name.length <= 10) {
    return name;
  }

  return `${name.slice(0, 9)}...`;
}

function shouldShowDistrictLabel({
  showDistrictLabels,
  viewMode
}: {
  showDistrictLabels: boolean;
  viewMode: "board" | "map";
}) {
  return showDistrictLabels && viewMode === "map";
}

export function Board({
  snapshot,
  cells,
  selectedSquare,
  hoveredSquare,
  inspectedSquare = null,
  legalMoves,
  viewMode,
  districtsBySquare,
  showCoordinates,
  showDistrictLabels,
  showPieces = true,
  onSquareClick,
  onSquareHover,
  onSquareLeave
}: BoardProps) {
  const cellMap = new Map(cells.map((cell) => [cell.square, cell]));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef(new Map<Square, HTMLButtonElement>());
  const [activeSquare, setActiveSquare] = useState<Square>(
    selectedSquare ?? hoveredSquare ?? squareName(files[0], ranks[0])
  );
  const [boardSize, setBoardSize] = useState<number | null>(null);

  useEffect(() => {
    if (selectedSquare) {
      setActiveSquare(selectedSquare);
      return;
    }

    if (hoveredSquare) {
      setActiveSquare(hoveredSquare);
    }
  }, [hoveredSquare, selectedSquare]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateBoardSize = () => {
      const nextSize = Math.max(0, Math.floor(Math.min(shell.clientWidth, shell.clientHeight || shell.clientWidth)));
      setBoardSize(nextSize || null);
    };

    updateBoardSize();

    const observer = new ResizeObserver(() => {
      updateBoardSize();
    });

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, []);

  const boardStyle: CSSProperties | undefined = boardSize
    ? {
        width: `${boardSize}px`,
        height: `${boardSize}px`
      }
    : undefined;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const square = event.currentTarget.dataset.square as Square | undefined;
    if (square) {
      setActiveSquare(square);
      onSquareClick(square);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const square = event.currentTarget.dataset.square as Square | undefined;
    if (!square) {
      return;
    }

    if (
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    const nextSquare = getNextBoardFocusSquare(square, event.key);
    setActiveSquare(nextSquare);
    onSquareHover(nextSquare);
    buttonRefs.current.get(nextSquare)?.focus();
  };

  return (
    <div className="board-shell" ref={shellRef}>
      <div
        className={["board-grid", viewMode === "map" ? "board-grid--map" : ""].filter(Boolean).join(" ")}
        role="grid"
        aria-label="Chess board"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End"
        style={boardStyle}
      >
        {ranks.map((rank) =>
          files.map((file) => {
            const square = squareName(file, rank);
            const cell = cellMap.get(square);
            const piece = showPieces ? cell?.occupant ?? getPieceAtSquare(snapshot, square) : null;
            const district = districtsBySquare.get(square) ?? null;
            const isSelected = selectedSquare === square;
            const isHovered = hoveredSquare === square;
            const isInspected = inspectedSquare === square;
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
                  isInspected ? "board-square--inspected" : "",
                  isLegalTarget ? "board-square--target" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-square={square}
                aria-pressed={isSelected}
                aria-colindex={files.indexOf(file) + 1}
                aria-label={`${square}${piece ? `, ${getPieceDisplayName(piece)}` : ""}${district ? `, ${district.name}` : ""}`}
                aria-rowindex={ranks.indexOf(rank) + 1}
                tabIndex={activeSquare === square ? 0 : -1}
                onClick={handleClick}
                onMouseEnter={() => onSquareHover(square)}
                onMouseLeave={onSquareLeave}
                onFocus={() => {
                  setActiveSquare(square);
                  onSquareHover(square);
                }}
                onBlur={onSquareLeave}
                onKeyDown={handleKeyDown}
                ref={(node) => {
                  if (!node) {
                    buttonRefs.current.delete(square);
                    return;
                  }

                  buttonRefs.current.set(square, node);
                }}
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
                {district &&
                shouldShowDistrictLabel({
                  showDistrictLabels,
                  viewMode
                }) ? (
                  <span className={`board-square__district board-square__district--${viewMode}`}>
                    {formatDistrictLabel(district.name, viewMode)}
                  </span>
                ) : null}
                <span className={`board-square__piece ${piece ? `is-${piece.side}` : "is-empty"} ${viewMode === "map" ? "is-map" : ""}`}>
                  {piece ? (
                    <PieceArt
                      side={piece.side}
                      kind={piece.kind}
                      className="board-piece-art board-piece-art--board"
                    />
                  ) : null}
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
