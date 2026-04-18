import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import {
  createGameInviteInSupabase,
  formatTimeControlLabel,
  timeControlPresets,
  listActiveGamesFromSupabase,
  respondToGameInviteInSupabase,
  type ActiveGameRecord
} from "@/activeGames";
import type { SavedMatchRecord } from "@/savedMatches";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
import { Check, ExternalLink, FileUp, RefreshCcw, Send, Trash2, X } from "lucide-react";

type InviteCreatorSide = "white" | "black" | "random";

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
  accountEmail: string | null;
  accountUsername: string | null;
  multiplayerCityOptions: Array<{
    id: string;
    label: string;
  }>;
  activeMultiplayerGameId: string | null;
  onLoadActiveGame: (gameId: string) => void;
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

type ActiveGamesNotice = {
  tone: "success" | "error";
  text: string;
};

function formatGameTimestamp(value: string | null) {
  if (!value) {
    return "Just now";
  }

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function activeGameHeading(game: ActiveGameRecord) {
  if (game.opponentDisplayName) {
    return game.opponentDisplayName;
  }

  if (game.opponentUsername) {
    return `@${game.opponentUsername}`;
  }

  return "Unknown player";
}

function activeGameStatusLabel(game: ActiveGameRecord) {
  if (game.status === "completed") {
    return "Complete";
  }

  if (game.isIncomingInvite) {
    return "Incoming invite";
  }

  if (game.isOutgoingInvite) {
    return "Invite sent";
  }

  if (game.status === "active") {
    return game.isYourTurn ? "Your turn" : "Waiting";
  }

  return game.status;
}

function activeGameResultLabel(game: ActiveGameRecord) {
  if (game.result === "draw") {
    return "Draw";
  }

  if (game.result === "white" || game.result === "black") {
    return `${game.result === game.yourSide ? "Won" : "Lost"} as ${game.yourSide}`;
  }

  if (game.result === "abandoned") {
    return "Abandoned";
  }

  if (game.result === "cancelled") {
    return "Cancelled";
  }

  return "Completed";
}

function activeGameRatingDelta(game: ActiveGameRecord) {
  if (!game.rated || game.status !== "completed") {
    return null;
  }

  return game.yourSide === "white" ? game.whiteRatingDelta : game.yourSide === "black" ? game.blackRatingDelta : null;
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
  onLoadReferenceGame,
  accountEmail,
  accountUsername,
  multiplayerCityOptions,
  activeMultiplayerGameId,
  onLoadActiveGame
}: RecentGamesPanelProps) {
  const minimumListWidthPercent = 28;
  const maximumListWidthPercent = 72;
  const [hoveredReferenceGameId, setHoveredReferenceGameId] = useState<string | null>(null);
  const [historicListWidthPercent, setHistoricListWidthPercent] = useState<number>(46);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);
  const [activeGames, setActiveGames] = useState<ActiveGameRecord[]>([]);
  const [isLoadingActiveGames, setIsLoadingActiveGames] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [activeGamesNotice, setActiveGamesNotice] = useState<ActiveGamesNotice | null>(null);
  const [inviteOpponentUsername, setInviteOpponentUsername] = useState("");
  const [inviteCityEditionId, setInviteCityEditionId] = useState(multiplayerCityOptions[0]?.id ?? "");
  const [inviteTimeControlPresetId, setInviteTimeControlPresetId] = useState("deadline-daily");
  const [inviteCreatorSide, setInviteCreatorSide] = useState<InviteCreatorSide>("random");
  const [inviteRated, setInviteRated] = useState(false);
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
  const currentActiveGames = useMemo(
    () => activeGames.filter((game) => game.status !== "completed"),
    [activeGames]
  );
  const completedActiveGames = useMemo(
    () => activeGames.filter((game) => game.status === "completed"),
    [activeGames]
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
  const refreshActiveGames = useCallback(async () => {
    if (!accountEmail) {
      setActiveGames([]);
      return;
    }

    setIsLoadingActiveGames(true);
    try {
      const games = await listActiveGamesFromSupabase();
      setActiveGames(games ?? []);
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load multiplayer games."
      });
    } finally {
      setIsLoadingActiveGames(false);
    }
  }, [accountEmail]);

  useEffect(() => {
    if (!multiplayerCityOptions.length) {
      setInviteCityEditionId("");
      return;
    }

    if (multiplayerCityOptions.some((option) => option.id === inviteCityEditionId)) {
      return;
    }

    setInviteCityEditionId(multiplayerCityOptions[0]?.id ?? "");
  }, [inviteCityEditionId, multiplayerCityOptions]);

  useEffect(() => {
    void refreshActiveGames();
  }, [refreshActiveGames]);

  const handleCreateInvite = useCallback(async () => {
    if (!accountUsername) {
      setActiveGamesNotice({
        tone: "error",
        text: "Claim a username in the menu before creating multiplayer games."
      });
      return;
    }

    if (!inviteOpponentUsername.trim()) {
      setActiveGamesNotice({
        tone: "error",
        text: "Enter the opponent username."
      });
      return;
    }

    if (!inviteCityEditionId) {
      setActiveGamesNotice({
        tone: "error",
        text: "Choose a published city edition first."
      });
      return;
    }

    setIsSubmittingInvite(true);
    try {
      await createGameInviteInSupabase({
        opponentUsername: inviteOpponentUsername,
        cityEditionId: inviteCityEditionId,
        timeControlPresetId: inviteTimeControlPresetId,
        creatorSide: inviteCreatorSide,
        rated: inviteRated
      });
      setInviteOpponentUsername("");
      setActiveGamesNotice({
        tone: "success",
        text: "Multiplayer invite created."
      });
      await refreshActiveGames();
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create the multiplayer invite."
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  }, [
    accountUsername,
    inviteCityEditionId,
    inviteCreatorSide,
    inviteOpponentUsername,
    inviteRated,
    inviteTimeControlPresetId,
    refreshActiveGames
  ]);

  const handleRespondToInvite = useCallback(async (gameId: string, response: "accept" | "decline") => {
    try {
      await respondToGameInviteInSupabase({ gameId, response });
      setActiveGamesNotice({
        tone: "success",
        text: response === "accept" ? "Invite accepted." : "Invite declined."
      });
      await refreshActiveGames();
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not update the multiplayer invite."
      });
    }
  }, [refreshActiveGames]);

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
      <Tabs defaultValue="active" className="recent-games-panel w-full">
      <TabsList className="recent-games-tabs">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="saved">Yours ({savedMatches.length})</TabsTrigger>
        <TabsTrigger value="historic">Historic</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="recent-games-content">
        <div className="recent-games-active">
          <div className="recent-games-active__composer">
            <div className="recent-games-active__composer-header">
              <div>
                <h4>Invite by username</h4>
                <p className="muted">
                  Direct invites first. Time controls decide how quickly each player must move.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => void refreshActiveGames()}
                aria-label="Refresh active games"
              >
                <RefreshCcw />
              </Button>
            </div>

            {!accountEmail ? (
              <p className="muted">Sign in to create and track multiplayer games.</p>
            ) : !accountUsername ? (
              <p className="muted">Claim a username in the menu before creating multiplayer invites.</p>
            ) : (
              <div className="recent-games-active__filters">
                <label className="grid gap-1">
                  <span className="text-sm font-medium">Opponent</span>
                  <Input
                    placeholder="username"
                    value={inviteOpponentUsername}
                    onChange={(event) => setInviteOpponentUsername(event.target.value)}
                    disabled={isSubmittingInvite}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium">City</span>
                  <Select
                    value={inviteCityEditionId}
                    disabled={isSubmittingInvite || multiplayerCityOptions.length === 0}
                    onValueChange={setInviteCityEditionId}
                  >
                    <SelectTrigger aria-label="City">
                      <SelectValue placeholder="Choose city…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {multiplayerCityOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium">Time control</span>
                  <Select
                    value={inviteTimeControlPresetId}
                    disabled={isSubmittingInvite}
                    onValueChange={setInviteTimeControlPresetId}
                  >
                    <SelectTrigger aria-label="Time control">
                      <SelectValue placeholder="Choose time…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {timeControlPresets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium">Your side</span>
                  <Select
                    value={inviteCreatorSide}
                    disabled={isSubmittingInvite}
                    onValueChange={(value) => setInviteCreatorSide(value as InviteCreatorSide)}
                  >
                    <SelectTrigger aria-label="Your side">
                      <SelectValue placeholder="Choose side…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="random">Random</SelectItem>
                        <SelectItem value="white">White</SelectItem>
                        <SelectItem value="black">Black</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </label>
                <label className="recent-games-active__rated">
                  <Checkbox
                    checked={inviteRated}
                    onCheckedChange={(checked) => setInviteRated(checked === true)}
                    disabled={isSubmittingInvite}
                  />
                  <span>{inviteRated ? "Rated game" : "Casual game"}</span>
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleCreateInvite()}
                  disabled={isSubmittingInvite || multiplayerCityOptions.length === 0}
                >
                  <Send data-icon="inline-start" />
                  {isSubmittingInvite ? "Sending…" : "Create invite"}
                </Button>
              </div>
            )}

            {activeGamesNotice ? (
              <p
                className={`recent-games-active__notice ${
                  activeGamesNotice.tone === "error"
                    ? "recent-games-active__notice--error"
                    : "recent-games-active__notice--success"
                }`}
              >
                {activeGamesNotice.text}
              </p>
            ) : null}
          </div>

          <div className="recent-games-active__list-shell">
            {isLoadingActiveGames && !activeGames.length ? (
              <p className="muted">Loading multiplayer games…</p>
            ) : activeGames.length ? (
              <div className="recent-games-active__sections">
                <section className="recent-games-active__section">
                  <h4>Current</h4>
                  {currentActiveGames.length ? (
                    <ul className="recent-games-active__list">
                      {currentActiveGames.map((game) => (
                  <li key={game.gameId} className="recent-games-active__entry">
                    <div className="recent-games-active__entry-header">
                      <div className="recent-games-active__entry-main">
                        <div className="recent-games-active__entry-title-row">
                          <h4>{activeGameHeading(game)}</h4>
                          <Badge variant={game.isIncomingInvite || game.isYourTurn ? "secondary" : "outline"}>
                            {activeGameStatusLabel(game)}
                          </Badge>
                          {activeMultiplayerGameId === game.gameId ? (
                            <Badge variant="outline">Open</Badge>
                          ) : null}
                        </div>
                        <p className="recent-games-active__entry-meta">
                          {game.opponentUsername ? `@${game.opponentUsername}` : "Unnamed opponent"} ·{" "}
                          {game.cityLabel ?? "Default board"} ·{" "}
                          {formatTimeControlLabel({
                            timeControlKind: game.timeControlKind,
                            baseSeconds: game.baseSeconds,
                            incrementSeconds: game.incrementSeconds,
                            moveDeadlineSeconds: game.moveDeadlineSeconds
                          })} · {game.rated ? "Rated" : "Casual"} · Elo {game.opponentEloRating}
                        </p>
                        <p className="recent-games-active__entry-meta">
                          {game.deadlineAt && game.status === "active"
                            ? `Deadline ${formatGameTimestamp(game.deadlineAt)}`
                            : `Updated ${formatGameTimestamp(game.lastMoveAt ?? game.updatedAt)}`}
                        </p>
                      </div>
                      {game.isIncomingInvite ? (
                        <div className="recent-games-active__entry-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onLoadActiveGame(game.gameId)}
                          >
                            Open
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleRespondToInvite(game.gameId, "accept")}
                          >
                            <Check data-icon="inline-start" />
                            Accept
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRespondToInvite(game.gameId, "decline")}
                          >
                            <X data-icon="inline-start" />
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <div className="recent-games-active__entry-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onLoadActiveGame(game.gameId)}
                          >
                            {game.status === "active" ? "Resume" : "Open"}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No pending or active multiplayer games.</p>
                  )}
                </section>
                <section className="recent-games-active__section">
                  <h4>Completed</h4>
                  {completedActiveGames.length ? (
                    <ul className="recent-games-active__list">
                      {completedActiveGames.map((game) => {
                        const ratingDelta = activeGameRatingDelta(game);

                        return (
                          <li key={game.gameId} className="recent-games-active__entry">
                            <div className="recent-games-active__entry-header">
                              <div className="recent-games-active__entry-main">
                                <div className="recent-games-active__entry-title-row">
                                  <h4>{activeGameHeading(game)}</h4>
                                  <Badge variant="outline">{activeGameResultLabel(game)}</Badge>
                                  {ratingDelta !== null ? (
                                    <Badge variant={ratingDelta >= 0 ? "secondary" : "outline"}>
                                      Elo {ratingDelta >= 0 ? "+" : ""}
                                      {ratingDelta}
                                    </Badge>
                                  ) : null}
                                  {activeMultiplayerGameId === game.gameId ? (
                                    <Badge variant="outline">Open</Badge>
                                  ) : null}
                                </div>
                                <p className="recent-games-active__entry-meta">
                                  {game.opponentUsername ? `@${game.opponentUsername}` : "Unnamed opponent"} -{" "}
                                  {game.cityLabel ?? "Default board"} -{" "}
                                  {formatTimeControlLabel({
                                    timeControlKind: game.timeControlKind,
                                    baseSeconds: game.baseSeconds,
                                    incrementSeconds: game.incrementSeconds,
                                    moveDeadlineSeconds: game.moveDeadlineSeconds
                                  })} - {game.rated ? "Rated" : "Casual"}
                                </p>
                                <p className="recent-games-active__entry-meta">
                                  Completed {formatGameTimestamp(game.lastMoveAt ?? game.updatedAt)}
                                </p>
                              </div>
                              <div className="recent-games-active__entry-actions">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onLoadActiveGame(game.gameId)}
                                >
                                  Review
                                </Button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted">Completed multiplayer games will appear here.</p>
                  )}
                </section>
              </div>
            ) : (
              <p className="muted">
                No multiplayer games yet. Save current local runs to <strong>Yours</strong> when you
                want a personal snapshot.
              </p>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="historic" className="recent-games-content">
        <div className="recent-games-historic">
          <div ref={splitContentRef} className="recent-games-historic__content" style={historicSplitStyle}>
            <ul
              className="recent-games-historic__list"
              role="listbox"
              aria-label="Historic games"
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
