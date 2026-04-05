import type { ReactNode } from "react";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import type { MoveRecord } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { getPieceGlyph } from "../chessPresentation";
import { Panel } from "./Panel";

type MatchHistoryPanelProps = {
  moves: MoveRecord[];
  selectedPly: number;
  totalPlies: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onJumpToStart: () => void;
  onStepBackward: () => void;
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

export function MatchHistoryPanel({
  moves,
  selectedPly,
  totalPlies,
  collapsed,
  onToggleCollapse,
  onJumpToStart,
  onStepBackward,
  onStepForward,
  onJumpToEnd,
  onSelectPly,
  headerAction
}: MatchHistoryPanelProps) {
  const movePairs = buildMovePairs(moves);

  return (
    <Panel
      title="History (PGN)"
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
              onClick={onStepBackward}
              disabled={selectedPly === 0}
              aria-label="Step backward one move"
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
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
                    className={[
                      "match-history__move-button",
                      selectedPly === movePair.white.moveNumber ? "match-history__move-button--active" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={selectedPly === movePair.white.moveNumber ? "step" : undefined}
                    onClick={() => onSelectPly(movePair.white.moveNumber)}
                  >
                    <span
                      className={`match-history__piece-icon match-history__piece-icon--${movePair.white.side}`}
                      aria-hidden="true"
                    >
                      {getPieceGlyph({ side: movePair.white.side, kind: movePair.white.pieceKind })}
                    </span>
                    <span>{movePair.white.san}</span>
                  </button>
                  {movePair.black ? (
                    <button
                      type="button"
                      className={[
                        "match-history__move-button",
                        selectedPly === movePair.black?.moveNumber ? "match-history__move-button--active" : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}
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
                        {getPieceGlyph({ side: movePair.black.side, kind: movePair.black.pieceKind })}
                      </span>
                      <span>{movePair.black.san}</span>
                    </button>
                  ) : (
                    <span className="match-history__move-empty">...</span>
                  )}
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">The PGN log will appear here as soon as the first move lands.</p>
        )}
      </div>
    </Panel>
  );
}
