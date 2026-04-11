import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import type { CharacterSummary, MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Panel } from "./Panel";
import { PieceArt } from "./PieceArt";

type MatchHistoryPanelProps = {
  moves: MoveRecord[];
  characters: Record<string, CharacterSummary>;
  selectedPly: number;
  totalPlies: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onJumpToStart: () => void;
  onStepBackward: () => void;
  isPlaying: boolean;
  onTogglePlayback: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onSelectPly: (ply: number) => void;
  headerAction?: ReactNode;
};

type MovePair = {
  moveNumber: number;
  white: MoveRecord;
  black: MoveRecord | null;
};

function getMoveButtonClassName(move: MoveRecord, isActive: boolean) {
  return [
    "match-history__move-button",
    `match-history__move-button--${move.side}`,
    move.capturedPieceId ? "match-history__move-button--capture" : "",
    move.isCheckmate ? "match-history__move-button--checkmate" : "",
    !move.isCheckmate && move.isCheck ? "match-history__move-button--check" : "",
    isActive ? "match-history__move-button--active" : ""
  ]
    .filter(Boolean)
    .join(" ");
}

function buildMovePairs(moves: MoveRecord[]): MovePair[] {
  const pairs: MovePair[] = [];

  for (let index = 0; index < moves.length; index += 2) {
    const white = moves[index];
    if (!white) {
      continue;
    }

    pairs.push({
      moveNumber: Math.floor(index / 2) + 1,
      white,
      black: moves[index + 1] ?? null
    });
  }

  return pairs;
}

function renderCapturedPiece(
  move: MoveRecord,
  characters: Record<string, CharacterSummary>
) {
  if (!move.capturedPieceId) {
    return null;
  }

  const capturedPiece = characters[move.capturedPieceId];
  const capturedPieceKind = capturedPiece?.pieceKind ?? "pawn";
  const capturedPieceSide = capturedPiece?.side ?? (move.side === "white" ? "black" : "white");

  return (
    <span
      className="match-history__capture-kind"
      aria-label={`Captured ${capturedPieceKind}`}
      title={`Captured ${capturedPieceKind}`}
    >
      <PieceArt
        side={capturedPieceSide}
        kind={capturedPieceKind}
        className="board-piece-art board-piece-art--history"
      />
    </span>
  );
}

export function MatchHistoryPanel({
  moves,
  characters,
  selectedPly,
  totalPlies,
  collapsed,
  onToggleCollapse,
  onJumpToStart,
  onStepBackward,
  isPlaying,
  onTogglePlayback,
  onStepForward,
  onJumpToEnd,
  onSelectPly,
  headerAction
}: MatchHistoryPanelProps) {
  const movePairs = buildMovePairs(moves);
  const scrubStartRef = useRef<{ clientX: number; clientY: number; selectedPly: number } | null>(null);
  const clampedSelectedPly = Math.min(Math.max(selectedPly, 0), totalPlies);
  const scrubLabel = `${clampedSelectedPly} / ${totalPlies}`;

  const handleScrubPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (totalPlies <= 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubStartRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      selectedPly: clampedSelectedPly
    };
  };

  const handleScrubPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const scrubStart = scrubStartRef.current;
    if (!scrubStart) {
      return;
    }

    event.preventDefault();
    const pixelsPerMove = 14;
    const dragDistance = (event.clientX - scrubStart.clientX) + (event.clientY - scrubStart.clientY);
    const nextPly = Math.min(
      Math.max(scrubStart.selectedPly + Math.round(dragDistance / pixelsPerMove), 0),
      totalPlies
    );

    if (nextPly !== selectedPly) {
      onSelectPly(nextPly);
    }
  };

  const handleScrubPointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    scrubStartRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Panel
        title="History"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        action={headerAction}
      >
        <div className="match-history">
          <div className="match-history__playhead">
            <div className="match-history__nav">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="match-history__nav-button match-history__nav-button--start"
                onClick={onJumpToStart}
                disabled={selectedPly === 0}
                aria-label="Jump to the start position"
              >
                <ChevronFirst />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="match-history__nav-button match-history__nav-button--back"
                onClick={onStepBackward}
                disabled={selectedPly === 0}
                aria-label="Step backward one move"
              >
                <ChevronLeft />
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="match-history__scrubber"
                    disabled={totalPlies <= 0}
                    onPointerDown={handleScrubPointerDown}
                    onPointerMove={handleScrubPointerMove}
                    onPointerUp={handleScrubPointerEnd}
                    onPointerCancel={handleScrubPointerEnd}
                    aria-label={`Move ${scrubLabel}`}
                  >
                    <span className="match-history__scrubber-current">{clampedSelectedPly}</span>
                    <span className="match-history__scrubber-total"> / {totalPlies}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Drag to scrub</TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="match-history__nav-button match-history__nav-button--play match-history__play-toggle"
                onClick={onTogglePlayback}
                disabled={totalPlies <= 0}
                aria-label={isPlaying ? "Pause move playback" : "Play move playback"}
                aria-pressed={isPlaying}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="match-history__nav-button match-history__nav-button--forward"
                onClick={onStepForward}
                disabled={selectedPly >= totalPlies}
                aria-label="Step forward one move"
              >
                <ChevronRight />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="match-history__nav-button match-history__nav-button--end"
                onClick={onJumpToEnd}
                disabled={selectedPly >= totalPlies}
                aria-label="Jump to the latest position"
              >
                <ChevronLast />
              </Button>
            </div>
          </div>

          {movePairs.length ? (
            <>
              <div className="match-history__header-row" aria-hidden="true">
                <span className="match-history__header-cell match-history__header-cell--number" />
                <span className="match-history__header-cell">White</span>
                <span className="match-history__header-cell">Black</span>
              </div>

              <div className="match-history__score">
                {movePairs.map((movePair) => (
                  <article key={movePair.moveNumber} className="match-history__row">
                    <span className="match-history__move-number">{movePair.moveNumber}.</span>
                    <button
                      type="button"
                      className={getMoveButtonClassName(movePair.white, selectedPly === movePair.white.moveNumber)}
                      aria-current={selectedPly === movePair.white.moveNumber ? "step" : undefined}
                      onClick={() => onSelectPly(movePair.white.moveNumber)}
                    >
                      <span
                        className={`match-history__piece-icon match-history__piece-icon--${movePair.white.side}`}
                        aria-hidden="true"
                      >
                        <PieceArt
                          side={movePair.white.side}
                          kind={movePair.white.pieceKind}
                          className="board-piece-art board-piece-art--history"
                        />
                      </span>
                      <span className="match-history__move-san">{movePair.white.san}</span>
                      {renderCapturedPiece(movePair.white, characters)}
                    </button>
                    {movePair.black ? (
                      <button
                        type="button"
                        className={getMoveButtonClassName(
                          movePair.black,
                          selectedPly === movePair.black?.moveNumber
                        )}
                        aria-current={selectedPly === movePair.black?.moveNumber ? "step" : undefined}
                        onClick={() => {
                          if (movePair.black) {
                            onSelectPly(movePair.black.moveNumber);
                          }
                        }}
                      >
                        <span
                          className={`match-history__piece-icon match-history__piece-icon--${movePair.black.side}`}
                          aria-hidden="true"
                        >
                          <PieceArt
                            side={movePair.black.side}
                            kind={movePair.black.pieceKind}
                            className="board-piece-art board-piece-art--history"
                          />
                        </span>
                        <span className="match-history__move-san">{movePair.black.san}</span>
                        {renderCapturedPiece(movePair.black, characters)}
                      </button>
                    ) : (
                      <span className="match-history__move-empty">...</span>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Move log appears after first move lands.</p>
          )}
        </div>
      </Panel>
    </TooltipProvider>
  );
}
