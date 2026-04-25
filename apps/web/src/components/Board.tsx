import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { gsap } from "gsap";
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
import { getAnimatedBoardPosition, type AnimatedPieceFrame } from "../chessMotion";
import { useCaptureImpact } from "../hooks/useCaptureImpact";
import { useCoarsePointer } from "../hooks/use-coarse-pointer";

const pieceMoveAnimationDuration = 420;
const pieceMoveAnimationEase = "power1.inOut";
const boardRankLabelGutterPx = 24;
const boardFileLabelGutterPx = 24;

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
  animationResetKey?: number;
  animatedPieces?: AnimatedPieceFrame[];
  showActiveSquareLabel?: boolean;
  showSquareLabels?: boolean;
  showPieces?: boolean;
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square) => void;
  onSquareLeave: () => void;
  onSquareDrop?: (fromSquare: Square, toSquare: Square) => void;
};

function formatDistrictLabel(name: string) {
  return name;
}

function shouldShowDistrictLabel({
  showDistrictLabels
}: {
  showDistrictLabels: boolean;
}) {
  return showDistrictLabels;
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
  animationResetKey = 0,
  animatedPieces,
  showActiveSquareLabel = false,
  showSquareLabels = false,
  showPieces = true,
  onSquareClick,
  onSquareHover,
  onSquareLeave,
  onSquareDrop
}: BoardProps) {
  const cellMap = new Map(cells.map((cell) => [cell.square, cell]));
  const shellRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef(new Map<Square, HTMLButtonElement>());
  const previousPieceRectsRef = useRef(new Map<string, DOMRect>());
  const activePieceTweenRefs = useRef(new Map<string, gsap.core.Tween>());
  const [activeSquare, setActiveSquare] = useState<Square>(
    selectedSquare ?? hoveredSquare ?? squareName(files[0], ranks[0])
  );
  const [boardSize, setBoardSize] = useState<number | null>(null);
  const [dragOverSquare, setDragOverSquare] = useState<Square | null>(null);
  const dragSourceSquareRef = useRef<Square | null>(null);
  const isCoarsePointer = useCoarsePointer();

  useEffect(() => {
    if (selectedSquare) {
      setActiveSquare(selectedSquare);
      return;
    }

    if (hoveredSquare) {
      setActiveSquare(hoveredSquare);
    }
  }, [hoveredSquare, selectedSquare]);

  // Measure synchronously before first paint so the board never renders at the wrong size.
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const availableWidth = shell.clientWidth - (showCoordinates ? boardRankLabelGutterPx * 2 : 0);
    const availableHeight = (shell.clientHeight || shell.clientWidth) - (showCoordinates ? boardFileLabelGutterPx : 0);
    const nextSize = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));
    setBoardSize(nextSize || null);
  }, [showCoordinates]);

  // ResizeObserver keeps the board sized correctly after layout changes.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateBoardSize = () => {
      const availableWidth = shell.clientWidth - (showCoordinates ? boardRankLabelGutterPx * 2 : 0);
      const availableHeight = (shell.clientHeight || shell.clientWidth) - (showCoordinates ? boardFileLabelGutterPx : 0);
      const nextSize = Math.max(0, Math.floor(Math.min(availableWidth, availableHeight)));
      setBoardSize(nextSize || null);
    };

    const observer = new ResizeObserver(() => {
      updateBoardSize();
    });

    observer.observe(shell);

    return () => {
      observer.disconnect();
    };
  }, [showCoordinates]);

  useEffect(() => {
    activePieceTweenRefs.current.forEach((tween) => tween.kill());
    activePieceTweenRefs.current.clear();
    previousPieceRectsRef.current = new Map();
  }, [animationResetKey]);

  useLayoutEffect(() => {
    if (animatedPieces && animatedPieces.length > 0) {
      activePieceTweenRefs.current.forEach((tween) => tween.kill());
      activePieceTweenRefs.current.clear();
      previousPieceRectsRef.current = new Map();
      return;
    }

    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const nextRects = new Map<string, DOMRect>();
    const pieceNodes = shell.querySelectorAll<HTMLElement>("[data-piece-id]");

    pieceNodes.forEach((node) => {
      const pieceId = node.dataset.pieceId;
      if (!pieceId) {
        return;
      }

      const nextRect = node.getBoundingClientRect();
      const previousRect = previousPieceRectsRef.current.get(pieceId);
      nextRects.set(pieceId, nextRect);

      if (!previousRect) {
        return;
      }

      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) {
        return;
      }

      const activeTween = activePieceTweenRefs.current.get(pieceId);
      if (activeTween && activeTween.isActive()) {
        activeTween.timeScale(8);
        activeTween.progress(1);
        activeTween.kill();
      }

      const tween = gsap.fromTo(
        node,
        { x: deltaX, y: deltaY },
        {
          x: 0,
          y: 0,
          duration: pieceMoveAnimationDuration / 1000,
          ease: pieceMoveAnimationEase,
          overwrite: "auto",
          onComplete: () => {
            activePieceTweenRefs.current.delete(pieceId);
          }
        }
      );
      activePieceTweenRefs.current.set(pieceId, tween);
    });

    previousPieceRectsRef.current = nextRects;
  }, [animatedPieces, snapshot.pieces]);

  const boardStyle: CSSProperties | undefined = boardSize
    ? {
        width: `${boardSize}px`,
        height: `${boardSize}px`
      }
    : undefined;
  const animatedCaptureMove = animatedPieces?.length ? snapshot.moveHistory.at(-1) ?? null : null;
  const activeCaptureImpact = useCaptureImpact({
    pieces: animatedPieces ?? [],
    lastMove: animatedCaptureMove
  });

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

  const handleDragStart = onSquareDrop
    ? (event: DragEvent<HTMLButtonElement>) => {
        const square = event.currentTarget.dataset.square as Square | undefined;
        if (!square) return;
        dragSourceSquareRef.current = square;
        event.dataTransfer.effectAllowed = "move";
      }
    : undefined;

  const handleDragOver = onSquareDrop
    ? (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const square = event.currentTarget.dataset.square as Square | undefined;
        if (square && square !== dragSourceSquareRef.current) {
          setDragOverSquare(square);
        }
      }
    : undefined;

  const handleDragLeave = onSquareDrop
    ? () => {
        setDragOverSquare(null);
      }
    : undefined;

  const handleDrop = onSquareDrop
    ? (event: DragEvent<HTMLButtonElement>) => {
        event.preventDefault();
        setDragOverSquare(null);
        const toSquare = event.currentTarget.dataset.square as Square | undefined;
        const fromSquare = dragSourceSquareRef.current;
        dragSourceSquareRef.current = null;
        if (fromSquare && toSquare && fromSquare !== toSquare) {
          onSquareDrop(fromSquare, toSquare);
        }
      }
    : undefined;

  const handleDragEnd = onSquareDrop
    ? () => {
        dragSourceSquareRef.current = null;
        setDragOverSquare(null);
      }
    : undefined;

  return (
    <div className="board-shell" ref={shellRef}>
      <div
        className={[
          "board-shell__frame",
          showCoordinates ? "board-shell__frame--coordinates" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {showCoordinates ? (
          <div className="board-shell__ranks" aria-hidden="true" style={{ height: boardStyle?.height }}>
            {ranks.map((rank) => (
              <span key={rank} className="board-shell__coordinate board-shell__coordinate--rank">
                {rank}
              </span>
            ))}
          </div>
        ) : null}
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
              const labelPiece = showPieces ? cell?.occupant ?? getPieceAtSquare(snapshot, square) : null;
              const piece = animatedPieces ? null : labelPiece;
              const district = districtsBySquare.get(square) ?? null;
              const isSelected = selectedSquare === square;
              const isHovered = hoveredSquare === square;
              const isInspected = inspectedSquare === square;
              const isLegalTarget = legalMoves.includes(square);
              const showSquareLabel = showSquareLabels || (showActiveSquareLabel && (isSelected || isHovered || isInspected));

              const isDragOver = dragOverSquare === square;
              const isDragSource = dragSourceSquareRef.current === square;

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
                    isLegalTarget ? "board-square--target" : "",
                    isDragOver ? "board-square--drag-over" : "",
                    isDragSource ? "board-square--drag-source" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-square={square}
                  draggable={!!onSquareDrop && !isCoarsePointer}
                  aria-pressed={isSelected}
                  aria-colindex={files.indexOf(file) + 1}
                  aria-label={`${square}${labelPiece ? `, ${getPieceDisplayName(labelPiece)}` : ""}${district ? `, ${district.name}` : ""}`}
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
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  ref={(node) => {
                    if (!node) {
                      buttonRefs.current.delete(square);
                      return;
                    }

                    buttonRefs.current.set(square, node);
                  }}
                >
                  {showSquareLabel ? (
                    <span
                      className={[
                        "board-square__square-label",
                        cell?.isLight ? "board-square__square-label--light" : "board-square__square-label--dark"
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {square}
                    </span>
                  ) : null}
                  {district &&
                  shouldShowDistrictLabel({
                    showDistrictLabels
                  }) ? (
                    <span className={`board-square__district board-square__district--${viewMode}`}>
                      {formatDistrictLabel(district.name)}
                    </span>
                  ) : null}
                  <span className={`board-square__piece ${piece ? `is-${piece.side}` : "is-empty"} ${viewMode === "map" ? "is-map" : ""}`}>
                    {piece ? (
                      <span className="board-square__piece-motion" data-piece-id={piece.pieceId}>
                        <PieceArt
                          side={piece.side}
                          kind={piece.kind}
                          className="board-piece-art board-piece-art--board"
                        />
                      </span>
                    ) : null}
                  </span>
                  {isLegalTarget ? <span className="board-square__target-dot" /> : null}
                </button>
              );
            })
          )}
          {showPieces && animatedPieces?.length ? (
            <div className="board-animated-pieces" aria-hidden="true">
              {animatedPieces.map((piece) => {
                const position = getAnimatedBoardPosition(piece);
                if (!position) {
                  return null;
                }
                const showCaptureImpact =
                  activeCaptureImpact?.moveId === animatedCaptureMove?.id &&
                  activeCaptureImpact?.pieceId === piece.pieceId;

                return (
                  <span
                    key={piece.pieceId}
                    className={[
                      "board-animated-piece",
                      `is-${piece.side}`,
                      viewMode === "map" ? "is-map" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      left: `${(position.x / 8) * 100}%`,
                      top: `${(position.y / 8) * 100}%`,
                      opacity: piece.opacity,
                      zIndex: 10 + piece.zIndex
                    }}
                  >
                    {showCaptureImpact ? (
                      <span className="board-animated-piece__capture-burst capture-impact-burst" />
                    ) : null}
                    <PieceArt
                      side={piece.side}
                      kind={piece.kind}
                      className="board-piece-art board-piece-art--board"
                    />
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
        {showCoordinates ? (
          <div className="board-shell__files" aria-hidden="true" style={{ width: boardStyle?.width }}>
            {files.map((file) => (
              <span key={file} className="board-shell__coordinate board-shell__coordinate--file">
                {file}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
