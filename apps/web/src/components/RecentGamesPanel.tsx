import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import type { SavedMatchRecord } from "@/savedMatches";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, FileUp, Trash2 } from "lucide-react";

type RecentGamesPanelProps = {
  savedMatches: SavedMatchRecord[];
  selectedSavedMatchId: string | null;
  onSelectSavedMatch: (id: string) => void;
  onLoadSavedMatch: () => void;
  onDeleteSelectedSavedMatch: () => void;
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: () => void;
};

type RecentGameRowProps = {
  title: string;
  description?: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onFocus?: () => void;
};

function RecentGameRow({
  title,
  description,
  meta,
  selected,
  onClick,
  onMouseEnter,
  onFocus
}: RecentGameRowProps) {
  return (
    <li className="recent-games-list__entry">
      <button
        type="button"
        role="option"
        className="recent-games-list-row"
        data-selected={selected ? "true" : "false"}
        aria-selected={selected}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
      >
        <span className="recent-games-list-row__main">
          <span className="recent-games-list-row__title">{title}</span>
          {description ? <span className="recent-games-list-row__description">{description}</span> : null}
        </span>
        <span className="recent-games-list-row__meta">{meta}</span>
      </button>
    </li>
  );
}

// Note: RecentGamesPanel does not wrap itself in <Panel> because App.tsx already
// renders it inside <Panel title="Games">. Adding another Panel here would
// double-nest the card chrome.
export function RecentGamesPanel({
  savedMatches,
  selectedSavedMatchId,
  onSelectSavedMatch,
  onLoadSavedMatch,
  onDeleteSelectedSavedMatch,
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame
}: RecentGamesPanelProps) {
  const minimumListWidthPercent = 28;
  const maximumListWidthPercent = 72;
  const [hoveredReferenceGameId, setHoveredReferenceGameId] = useState<string | null>(null);
  const [historicListWidthPercent, setHistoricListWidthPercent] = useState<number>(46);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const splitContentRef = useRef<HTMLDivElement | null>(null);
  const selectedSavedMatch = savedMatches.find((savedMatch) => savedMatch.id === selectedSavedMatchId);
  const selectedReferenceGame = useMemo(
    () => referenceGames.find((game) => game.id === selectedReferenceGameId) ?? null,
    [referenceGames, selectedReferenceGameId]
  );
  const previewReferenceGame = useMemo(
    () =>
      referenceGames.find((game) => game.id === (hoveredReferenceGameId ?? selectedReferenceGameId)) ??
      selectedReferenceGame,
    [hoveredReferenceGameId, referenceGames, selectedReferenceGame, selectedReferenceGameId]
  );

  const formatSavedAt = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };
  const historicSplitStyle = useMemo(
    () =>
      ({
        "--historic-list-width": `${historicListWidthPercent}%`
      }) as CSSProperties,
    [historicListWidthPercent]
  );

  useEffect(() => {
    if (!isDraggingSplit) {
      return;
    }

    const updateSplitFromPointer = (clientX: number) => {
      const container = splitContentRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const nextPercent = (offsetX / rect.width) * 100;
      const clampedPercent = Math.min(
        Math.max(nextPercent, minimumListWidthPercent),
        maximumListWidthPercent
      );

      setHistoricListWidthPercent(clampedPercent);
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateSplitFromPointer(event.clientX);
    };

    const handlePointerUp = () => {
      setIsDraggingSplit(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingSplit]);

  return (
    <TooltipProvider delayDuration={150}>
      <Tabs defaultValue="open" className="recent-games-panel w-full">
      <TabsList className="recent-games-tabs">
        <TabsTrigger value="open">Open Games</TabsTrigger>
        <TabsTrigger value="saved">Your Games ({savedMatches.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="recent-games-content">
        <div className="recent-games-historic">
          <div ref={splitContentRef} className="recent-games-historic__content" style={historicSplitStyle}>
            <ul
              className="recent-games-historic__list"
              role="listbox"
              aria-label="Open games"
              onMouseLeave={() => setHoveredReferenceGameId(null)}
            >
              {referenceGames.map((game) => (
                <RecentGameRow
                  key={game.id}
                  selected={game.id === selectedReferenceGameId}
                  onClick={() => onSelectReferenceGame(game.id)}
                  onMouseEnter={() => setHoveredReferenceGameId(game.id)}
                  onFocus={() => setHoveredReferenceGameId(game.id)}
                  title={game.title}
                  description={`${game.white} vs ${game.black}`}
                  meta={String(game.year)}
                />
              ))}
            </ul>
            <button
              type="button"
              className="recent-games-historic__splitter"
              role="separator"
              aria-label="Resize historic games list and details panels"
              aria-orientation="vertical"
              aria-valuemin={minimumListWidthPercent}
              aria-valuemax={maximumListWidthPercent}
              aria-valuenow={Math.round(historicListWidthPercent)}
              onPointerDown={(event) => {
                event.preventDefault();
                setIsDraggingSplit(true);
              }}
              onKeyDown={(event) => {
                const nextStep = event.shiftKey ? 4 : 2;
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setHistoricListWidthPercent((current) =>
                    Math.max(minimumListWidthPercent, current - nextStep)
                  );
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setHistoricListWidthPercent((current) =>
                    Math.min(maximumListWidthPercent, current + nextStep)
                  );
                }
              }}
            >
              <span aria-hidden="true" />
            </button>

            {previewReferenceGame ? (
              <div className="recent-games-details">
                <div className="recent-games-details__header">
                  <h4>{previewReferenceGame.title}</h4>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        onClick={onLoadReferenceGame}
                        aria-label={`Load ${previewReferenceGame.title}`}
                      >
                        <FileUp />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Load game</TooltipContent>
                  </Tooltip>
                </div>
                <p className="recent-games-details__location-row muted">
                  <span>{previewReferenceGame.site || "Unknown location"}</span>
                  <span className="recent-games-details__year">{previewReferenceGame.year}</span>
                </p>
                <p className="muted">
                  {previewReferenceGame.white} vs {previewReferenceGame.black}, {previewReferenceGame.event}
                </p>
                <p className="recent-games-summary">{previewReferenceGame.summary}</p>
                <div className="recent-games-details__actions">
                  {previewReferenceGame.sourceUrl ? (
                    <Button asChild type="button" variant="outline" size="sm">
                      <a href={previewReferenceGame.sourceUrl} target="_blank" rel="noreferrer">
                        Source <ExternalLink />
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="saved" className="recent-games-content">
        {savedMatches.length ? (
          <div className="recent-games-shell">
            <ul className="recent-games-list" role="listbox" aria-label="Saved games">
              {savedMatches.map((savedMatch) => (
                <RecentGameRow
                  key={savedMatch.id}
                  selected={savedMatch.id === selectedSavedMatchId}
                  onClick={() => onSelectSavedMatch(savedMatch.id)}
                  title={savedMatch.name}
                  description={formatSavedAt(savedMatch.savedAt)}
                  meta={`${savedMatch.moveCount} moves`}
                />
              ))}
            </ul>
            <div className="recent-games-actions">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-sm"
                    disabled={!selectedSavedMatch}
                    aria-label={
                      selectedSavedMatch
                        ? `Delete saved game ${selectedSavedMatch.name}`
                        : "Delete selected saved game"
                    }
                  >
                    <Trash2 />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete saved game?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {selectedSavedMatch
                        ? `This will permanently remove ${selectedSavedMatch.name} from local saved games.`
                        : "This will permanently remove the selected saved game."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={onDeleteSelectedSavedMatch}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={!selectedSavedMatch}
                    onClick={onLoadSavedMatch}
                    aria-label={
                      selectedSavedMatch
                        ? `Load saved game ${selectedSavedMatch.name}`
                        : "Load selected saved game"
                    }
                  >
                    <FileUp />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Load game</TooltipContent>
              </Tooltip>
            </div>
          </div>
        ) : (
          <p className="muted">No saved games yet. Save the current local game to keep your place.</p>
        )}
      </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
