import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import {
  archiveGameInSupabase,
  cancelGameInviteInSupabase,
  claimGameTimeoutInSupabase,
  createGameInviteInSupabase,
  formatTimeControlLabel,
  timeControlPresets,
  joinOpenGameInSupabase,
  listActiveGamesFromSupabase,
  respondToGameInviteInSupabase,
  subscribeToActiveGamesListChanges,
  unarchiveGameInSupabase,
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
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
import {
  Archive,
  ArchiveRestore,
  Check,
  Clock3,
  ExternalLink,
  FileUp,
  Flag,
  Plus,
  RefreshCcw,
  Send,
  Trash2,
  X
} from "lucide-react";

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
  onActiveGameStateChanged?: (gameId: string) => void;
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    (error as { message: string }).message.length > 0
  ) {
    return (error as { message: string }).message;
  }

  if (typeof error === "string" && error.length > 0) {
    return error;
  }

  return fallback;
}

function formatRelativeTimestamp(timestamp: number | null, now: number) {
  if (timestamp === null) {
    return "Not synced";
  }

  const deltaSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (deltaSeconds < 5) {
    return "Updated just now";
  }

  if (deltaSeconds < 60) {
    return `Updated ${deltaSeconds}s ago`;
  }

  if (deltaSeconds < 3600) {
    return `Updated ${Math.floor(deltaSeconds / 60)}m ago`;
  }

  return `Updated ${Math.floor(deltaSeconds / 3600)}h ago`;
}

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
  if (game.isOpenGame && !game.opponentDisplayName && !game.opponentUsername) {
    return game.canJoinOpenGame ? "Open game" : "Waiting for player";
  }

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

  if (game.canJoinOpenGame) {
    return "Open game";
  }

  if (game.isOpenGame && game.isOutgoingInvite) {
    return "Open game";
  }

  if (game.isIncomingInvite) {
    return "Incoming invite";
  }

  if (game.isOutgoingInvite) {
    return "Invite sent";
  }

  if (game.status === "active") {
    if (game.canClaimTimeout) {
      return "Opponent timed out";
    }
    if (game.isTimedOut && game.isYourTurn) {
      return "Your clock expired";
    }
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

function activeGameTimeNote(game: ActiveGameRecord) {
  if (game.status !== "active" || !game.deadlineAt) {
    return `Updated ${formatGameTimestamp(game.lastMoveAt ?? game.updatedAt)}`;
  }

  if (game.isTimedOut) {
    return game.timeControlKind === "live_clock"
      ? `Clock expired ${formatGameTimestamp(game.deadlineAt)}`
      : `Move overdue since ${formatGameTimestamp(game.deadlineAt)}`;
  }

  return game.timeControlKind === "live_clock"
    ? `Clock expires ${formatGameTimestamp(game.deadlineAt)}`
    : `Move due ${formatGameTimestamp(game.deadlineAt)}`;
}

function activeGameTimeoutSummary(game: ActiveGameRecord) {
  if (!game.isTimedOut) {
    return null;
  }

  if (game.canClaimTimeout) {
    return game.timeControlKind === "live_clock"
      ? "Opponent's clock has expired. Claim the timeout to score the game."
      : "Opponent missed the move deadline. Claim the timeout to score the game.";
  }

  if (game.isYourTurn) {
    return game.timeControlKind === "live_clock"
      ? "Your clock has expired. Wait for your opponent to claim the result."
      : "Your move deadline has passed. Wait for your opponent to claim the result.";
  }

  return game.timeControlKind === "live_clock" ? "Clock expired." : "Move deadline missed.";
}

function formatSideLabel(side: ActiveGameRecord["yourSide"] | ActiveGameRecord["currentTurn"]) {
  if (!side) {
    return "None";
  }

  return side === "spectator" ? "Spectator" : side === "white" ? "White" : "Black";
}

function formatActiveGameTimeControl(game: ActiveGameRecord) {
  return formatTimeControlLabel({
    timeControlKind: game.timeControlKind,
    baseSeconds: game.baseSeconds,
    incrementSeconds: game.incrementSeconds,
    moveDeadlineSeconds: game.moveDeadlineSeconds
  });
}

function activeGameOpponentLabel(game: ActiveGameRecord) {
  if (game.opponentDisplayName) {
    return game.opponentUsername ? `${game.opponentDisplayName} (@${game.opponentUsername})` : game.opponentDisplayName;
  }

  if (game.opponentUsername) {
    return `@${game.opponentUsername}`;
  }

  return game.isOpenGame ? "Waiting for player" : "Unnamed opponent";
}

function formatMatchOutcome(outcome: SavedMatchRecord["snapshot"]["status"]["outcome"]) {
  if (outcome === "white-win") {
    return "White won";
  }

  if (outcome === "black-win") {
    return "Black won";
  }

  if (outcome === "draw") {
    return "Draw";
  }

  return "In play";
}

type ActiveGameDetailsProps = {
  game: ActiveGameRecord | null;
  activeMultiplayerGameId: string | null;
  emptyMessage: string;
  claimingGameId: string | null;
  cancellingGameId: string | null;
  archivingGameId: string | null;
  onJoinOpenGame: (gameId: string) => void;
  onLoadActiveGame: (gameId: string) => void;
  onRespondToInvite: (gameId: string, response: "accept" | "decline") => void;
  onClaimTimeout: (gameId: string) => void;
  onClaimAndArchiveTimeout: (gameId: string) => void;
  onCancelInvite: (gameId: string) => void;
  onArchiveGame: (gameId: string, archive: boolean) => void;
};

function ActiveGameDetails({
  game,
  activeMultiplayerGameId,
  emptyMessage,
  claimingGameId,
  cancellingGameId,
  archivingGameId,
  onJoinOpenGame,
  onLoadActiveGame,
  onRespondToInvite,
  onClaimTimeout,
  onClaimAndArchiveTimeout,
  onCancelInvite,
  onArchiveGame
}: ActiveGameDetailsProps) {
  if (!game) {
    return <p className="recent-games-details recent-games-details--empty muted">{emptyMessage}</p>;
  }

  const ratingDelta = activeGameRatingDelta(game);
  const timeoutSummary = activeGameTimeoutSummary(game);

  return (
    <div className="recent-games-details">
      <div className="recent-games-details__header">
        <h4>{activeGameHeading(game)}</h4>
        <Badge variant={game.status === "completed" ? "outline" : game.isYourTurn ? "secondary" : "outline"}>
          {game.status === "completed" ? activeGameResultLabel(game) : activeGameStatusLabel(game)}
        </Badge>
      </div>
      <p className="recent-games-details__location-row muted">
        <span>{game.cityLabel ?? "Default board"}</span>
        <span className="recent-games-details__year">{formatActiveGameTimeControl(game)}</span>
      </p>
      <dl className="recent-games-details__meta-list">
        <div>
          <dt>Opponent</dt>
          <dd>{activeGameOpponentLabel(game)}</dd>
        </div>
        <div>
          <dt>Your side</dt>
          <dd>{formatSideLabel(game.yourSide)}</dd>
        </div>
        <div>
          <dt>Turn</dt>
          <dd>{game.status === "completed" ? "Complete" : formatSideLabel(game.currentTurn)}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{game.rated ? "Rated" : "Casual"}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatGameTimestamp(game.lastMoveAt ?? game.updatedAt)}</dd>
        </div>
        <div>
          <dt>Opponent Elo</dt>
          <dd>{game.opponentEloRating}</dd>
        </div>
        {ratingDelta !== null ? (
          <div>
            <dt>Elo change</dt>
            <dd>
              {ratingDelta >= 0 ? "+" : ""}
              {ratingDelta}
            </dd>
          </div>
        ) : null}
      </dl>
      {timeoutSummary ? (
        <p className="recent-games-timeout-alert">
          <Clock3 data-icon="inline-start" />
          <span>{timeoutSummary}</span>
        </p>
      ) : null}
      <p className="recent-games-summary">{activeGameTimeNote(game)}</p>
      <div className="recent-games-details__actions">
        {game.canJoinOpenGame ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onJoinOpenGame(game.gameId)}>
            <Check data-icon="inline-start" />
            Join
          </Button>
        ) : game.isIncomingInvite ? (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => onLoadActiveGame(game.gameId)}>
              Open
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onRespondToInvite(game.gameId, "accept")}
            >
              <Check data-icon="inline-start" />
              Accept
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRespondToInvite(game.gameId, "decline")}
            >
              <X data-icon="inline-start" />
              Decline
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => onLoadActiveGame(game.gameId)}>
            {game.status === "completed" ? "Review" : game.status === "active" ? "Resume" : "Open"}
          </Button>
        )}
        {game.canClaimTimeout ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={claimingGameId === game.gameId}
            onClick={() => onClaimTimeout(game.gameId)}
          >
            <Flag data-icon="inline-start" />
            {claimingGameId === game.gameId ? "Claiming..." : "Claim on time"}
          </Button>
        ) : null}
        {game.canClaimTimeout ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={claimingGameId === game.gameId || archivingGameId === game.gameId}
            onClick={() => onClaimAndArchiveTimeout(game.gameId)}
          >
            <Archive data-icon="inline-start" />
            {claimingGameId === game.gameId || archivingGameId === game.gameId ? "Removing..." : "Claim & remove"}
          </Button>
        ) : null}
        {game.isOutgoingInvite && game.status === "invited" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancellingGameId === game.gameId}
            onClick={() => onCancelInvite(game.gameId)}
          >
            <X data-icon="inline-start" />
            {cancellingGameId === game.gameId ? "Cancelling..." : "Cancel invite"}
          </Button>
        ) : null}
        {(game.status === "completed" || game.status === "cancelled" || game.status === "abandoned") ? (
          game.archivedAt ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={archivingGameId === game.gameId}
              onClick={() => onArchiveGame(game.gameId, false)}
            >
              <ArchiveRestore data-icon="inline-start" />
              {archivingGameId === game.gameId ? "Restoring..." : "Restore"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={archivingGameId === game.gameId}
              onClick={() => onArchiveGame(game.gameId, true)}
            >
              <Archive data-icon="inline-start" />
              {archivingGameId === game.gameId ? "Archiving..." : "Archive"}
            </Button>
          )
        ) : null}
        {activeMultiplayerGameId === game.gameId ? <Badge variant="outline">Open</Badge> : null}
        {game.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
      </div>
    </div>
  );
}

type SavedMatchDetailsProps = {
  match: SavedMatchRecord | null;
  onDeleteSelectedSavedMatch: () => void;
  onLoadSavedMatch: () => void;
};

function SavedMatchDetails({ match, onDeleteSelectedSavedMatch, onLoadSavedMatch }: SavedMatchDetailsProps) {
  if (!match) {
    return <p className="recent-games-details recent-games-details--empty muted">Select a saved game.</p>;
  }

  return (
    <div className="recent-games-details">
      <div className="recent-games-details__header">
        <h4>{match.name}</h4>
        <Badge variant="outline">Local save</Badge>
      </div>
      <p className="recent-games-details__location-row muted">
        <span>Saved {formatGameTimestamp(match.savedAt)}</span>
        <span className="recent-games-details__year">{match.moveCount} moves</span>
      </p>
      <dl className="recent-games-details__meta-list">
        <div>
          <dt>Status</dt>
          <dd>{formatMatchOutcome(match.snapshot.status.outcome)}</dd>
        </div>
        <div>
          <dt>Turn</dt>
          <dd>{formatSideLabel(match.snapshot.status.turn)}</dd>
        </div>
        <div>
          <dt>Check</dt>
          <dd>{match.snapshot.status.isCheck ? "Yes" : "No"}</dd>
        </div>
      </dl>
      <p className="recent-games-summary">Local browser save. Load it to return the Play board to this position.</p>
      <div className="recent-games-details__actions">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" size="icon-sm" aria-label={`Delete ${match.name}`}>
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete saved game?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove {match.name} from local saved games.
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
            <Button type="button" variant="outline" size="icon-sm" onClick={onLoadSavedMatch} aria-label={`Load ${match.name}`}>
              <FileUp />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Load game</TooltipContent>
        </Tooltip>
      </div>
    </div>
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
  onLoadReferenceGame,
  accountEmail,
  accountUsername,
  multiplayerCityOptions,
  activeMultiplayerGameId,
  onLoadActiveGame,
  onActiveGameStateChanged
}: RecentGamesPanelProps) {
  const minimumListWidthPercent = 28;
  const maximumListWidthPercent = 72;
  const [hoveredReferenceGameId, setHoveredReferenceGameId] = useState<string | null>(null);
  const [hoveredActiveGameId, setHoveredActiveGameId] = useState<string | null>(null);
  const [selectedActiveGameId, setSelectedActiveGameId] = useState<string | null>(null);
  const [selectedYoursGameId, setSelectedYoursGameId] = useState<string | null>(null);
  const [activeListWidthPercent, setActiveListWidthPercent] = useState<number>(46);
  const [yoursListWidthPercent, setYoursListWidthPercent] = useState<number>(46);
  const [historicListWidthPercent, setHistoricListWidthPercent] = useState<number>(46);
  const [draggingSplit, setDraggingSplit] = useState<"active" | "yours" | "historic" | null>(null);
  const [activeGames, setActiveGames] = useState<ActiveGameRecord[]>([]);
  const [isLoadingActiveGames, setIsLoadingActiveGames] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [isMakeGameDialogOpen, setIsMakeGameDialogOpen] = useState(false);
  const [activeGamesNotice, setActiveGamesNotice] = useState<ActiveGamesNotice | null>(null);
  const [claimingGameId, setClaimingGameId] = useState<string | null>(null);
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);
  const [archivingGameId, setArchivingGameId] = useState<string | null>(null);
  const [showArchivedYours, setShowArchivedYours] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [lastActiveGamesRefreshAt, setLastActiveGamesRefreshAt] = useState<number | null>(null);
  const [inviteOpponentUsername, setInviteOpponentUsername] = useState("");
  const [inviteCityEditionId, setInviteCityEditionId] = useState(multiplayerCityOptions[0]?.id ?? "");
  const [inviteTimeControlPresetId, setInviteTimeControlPresetId] = useState("deadline-daily");
  const [inviteCreatorSide, setInviteCreatorSide] = useState<InviteCreatorSide>("random");
  const [inviteCasual, setInviteCasual] = useState(true);
  const [inviteIsOpenGame, setInviteIsOpenGame] = useState(false);
  const activeSplitContentRef = useRef<HTMLDivElement | null>(null);
  const yoursSplitContentRef = useRef<HTMLDivElement | null>(null);
  const historicSplitContentRef = useRef<HTMLDivElement | null>(null);
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
  const derivedActiveGames = useMemo(() => {
    return activeGames.map((game) => {
      if (game.status !== "active" || !game.deadlineAt) {
        return game;
      }

      const deadlineMs = Date.parse(game.deadlineAt);
      if (!Number.isFinite(deadlineMs)) {
        return game;
      }

      const expired = deadlineMs <= clockNow;
      if (!expired) {
        return game;
      }

      const canClaim =
        game.yourParticipantStatus === "active" &&
        (game.yourSide === "white" || game.yourSide === "black") &&
        game.currentTurn !== null &&
        game.currentTurn !== game.yourSide;

      return {
        ...game,
        isTimedOut: true,
        canClaimTimeout: canClaim || game.canClaimTimeout
      };
    });
  }, [activeGames, clockNow]);
  const currentActiveGames = useMemo(
    () => derivedActiveGames.filter((game) => game.status !== "completed"),
    [derivedActiveGames]
  );
  const completedActiveGames = useMemo(
    () => derivedActiveGames.filter((game) => game.status === "completed"),
    [derivedActiveGames]
  );
  const previewActiveGame = useMemo(
    () =>
      currentActiveGames.find((game) => game.gameId === (hoveredActiveGameId ?? selectedActiveGameId)) ??
      currentActiveGames.find((game) => game.gameId === activeMultiplayerGameId) ??
      currentActiveGames[0] ??
      null,
    [activeMultiplayerGameId, currentActiveGames, hoveredActiveGameId, selectedActiveGameId]
  );
  const yoursGameCount = savedMatches.length + completedActiveGames.length;
  const selectedYoursGame = useMemo(() => {
    const fallbackId = selectedSavedMatchId ? `saved:${selectedSavedMatchId}` : null;
    const candidateId = selectedYoursGameId ?? fallbackId;

    if (candidateId?.startsWith("completed:")) {
      const gameId = candidateId.slice("completed:".length);
      const game = completedActiveGames.find((completedGame) => completedGame.gameId === gameId);
      if (game) {
        return { kind: "completed" as const, game };
      }
    }

    if (candidateId?.startsWith("saved:")) {
      const savedMatchId = candidateId.slice("saved:".length);
      const match = savedMatches.find((savedMatch) => savedMatch.id === savedMatchId);
      if (match) {
        return { kind: "saved" as const, match };
      }
    }

    if (completedActiveGames[0]) {
      return { kind: "completed" as const, game: completedActiveGames[0] };
    }

    return null;
  }, [completedActiveGames, savedMatches, selectedSavedMatchId, selectedYoursGameId]);
  const showInlineInviteFallback = false;

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
        "--recent-games-list-width": `${historicListWidthPercent}%`
      }) as CSSProperties,
    [historicListWidthPercent]
  );
  const activeSplitStyle = useMemo(
    () =>
      ({
        "--recent-games-list-width": `${activeListWidthPercent}%`
      }) as CSSProperties,
    [activeListWidthPercent]
  );
  const yoursSplitStyle = useMemo(
    () =>
      ({
        "--recent-games-list-width": `${yoursListWidthPercent}%`
      }) as CSSProperties,
    [yoursListWidthPercent]
  );
  const refreshActiveGames = useCallback(async (options?: { silent?: boolean }) => {
    if (!accountEmail) {
      setActiveGames([]);
      setLastActiveGamesRefreshAt(null);
      return;
    }

    if (!options?.silent) {
      setIsLoadingActiveGames(true);
    }
    try {
      const games = await listActiveGamesFromSupabase({ includeArchived: showArchivedYours });
      setActiveGames(games ?? []);
      setLastActiveGamesRefreshAt(Date.now());
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not load multiplayer games.")
      });
    } finally {
      if (!options?.silent) {
        setIsLoadingActiveGames(false);
      }
    }
  }, [accountEmail, showArchivedYours]);

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

  useEffect(() => {
    if (!accountEmail) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshActiveGames({ silent: true });
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [accountEmail, refreshActiveGames]);

  useEffect(() => {
    if (!accountEmail) {
      return;
    }

    const unsubscribe = subscribeToActiveGamesListChanges(() => {
      void refreshActiveGames({ silent: true });
    });

    return unsubscribe;
  }, [accountEmail, refreshActiveGames]);

  useEffect(() => {
    const hasDeadline = activeGames.some(
      (game) => game.status === "active" && Boolean(game.deadlineAt)
    );
    if (!hasDeadline && lastActiveGamesRefreshAt === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeGames, lastActiveGamesRefreshAt]);

  const handleClaimTimeout = useCallback(async (gameId: string) => {
    setClaimingGameId(gameId);
    try {
      await claimGameTimeoutInSupabase(gameId);
      setActiveGamesNotice({
        tone: "success",
        text: "Opponent timed out. Game scored."
      });
      await refreshActiveGames();
      onActiveGameStateChanged?.(gameId);
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not claim the timeout.")
      });
    } finally {
      setClaimingGameId(null);
    }
  }, [onActiveGameStateChanged, refreshActiveGames]);

  const handleClaimAndArchiveTimeout = useCallback(async (gameId: string) => {
    setClaimingGameId(gameId);
    setArchivingGameId(gameId);
    try {
      await claimGameTimeoutInSupabase(gameId);
      await archiveGameInSupabase(gameId);
      setActiveGamesNotice({
        tone: "success",
        text: "Timed-out game scored and removed."
      });
      await refreshActiveGames();
      onActiveGameStateChanged?.(gameId);
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not remove the timed-out game.")
      });
    } finally {
      setClaimingGameId(null);
      setArchivingGameId(null);
    }
  }, [onActiveGameStateChanged, refreshActiveGames]);

  const handleCancelInvite = useCallback(async (gameId: string) => {
    setCancellingGameId(gameId);
    try {
      await cancelGameInviteInSupabase(gameId);
      setActiveGamesNotice({
        tone: "success",
        text: "Invite cancelled."
      });
      await refreshActiveGames();
      onActiveGameStateChanged?.(gameId);
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not cancel the invite.")
      });
    } finally {
      setCancellingGameId(null);
    }
  }, [onActiveGameStateChanged, refreshActiveGames]);

  const handleArchiveGame = useCallback(async (gameId: string, archive: boolean) => {
    setArchivingGameId(gameId);
    try {
      if (archive) {
        await archiveGameInSupabase(gameId);
      } else {
        await unarchiveGameInSupabase(gameId);
      }
      setActiveGamesNotice({
        tone: "success",
        text: archive ? "Game archived." : "Game restored."
      });
      await refreshActiveGames();
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(
          error,
          archive ? "Could not archive the game." : "Could not restore the game."
        )
      });
    } finally {
      setArchivingGameId(null);
    }
  }, [refreshActiveGames]);

  const handleCreateInvite = useCallback(async () => {
    if (!accountUsername) {
      setActiveGamesNotice({
        tone: "error",
        text: "Claim a username in the menu before creating multiplayer games."
      });
      return;
    }

    if (!inviteIsOpenGame && !inviteOpponentUsername.trim()) {
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
        rated: !inviteCasual,
        isOpenGame: inviteIsOpenGame
      });
      setInviteOpponentUsername("");
      setInviteIsOpenGame(false);
      setIsMakeGameDialogOpen(false);
      setActiveGamesNotice({
        tone: "success",
        text: inviteIsOpenGame ? "Open game created." : "Multiplayer invite sent."
      });
      await refreshActiveGames();
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not create the multiplayer invite.")
      });
    } finally {
      setIsSubmittingInvite(false);
    }
  }, [
    accountUsername,
    inviteCasual,
    inviteCityEditionId,
    inviteCreatorSide,
    inviteIsOpenGame,
    inviteOpponentUsername,
    inviteTimeControlPresetId,
    refreshActiveGames
  ]);

  const handleJoinOpenGame = useCallback(async (gameId: string) => {
    try {
      await joinOpenGameInSupabase(gameId);
      setActiveGamesNotice({
        tone: "success",
        text: "Open game joined."
      });
      await refreshActiveGames();
      onLoadActiveGame(gameId);
    } catch (error) {
      setActiveGamesNotice({
        tone: "error",
        text: getErrorMessage(error, "Could not join the open game.")
      });
    }
  }, [onLoadActiveGame, refreshActiveGames]);

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
        text: getErrorMessage(error, "Could not update the multiplayer invite.")
      });
    }
  }, [refreshActiveGames]);

  const setSplitWidthPercent = useCallback((split: "active" | "yours" | "historic", value: number) => {
    const clampedValue = Math.min(Math.max(value, minimumListWidthPercent), maximumListWidthPercent);

    if (split === "active") {
      setActiveListWidthPercent(clampedValue);
    } else if (split === "yours") {
      setYoursListWidthPercent(clampedValue);
    } else {
      setHistoricListWidthPercent(clampedValue);
    }
  }, []);

  const getSplitContentRef = useCallback((split: "active" | "yours" | "historic") => {
    if (split === "active") {
      return activeSplitContentRef;
    }

    if (split === "yours") {
      return yoursSplitContentRef;
    }

    return historicSplitContentRef;
  }, []);

  const adjustSplitWidth = useCallback((split: "active" | "yours" | "historic", delta: number) => {
    const currentValue =
      split === "active"
        ? activeListWidthPercent
        : split === "yours"
          ? yoursListWidthPercent
          : historicListWidthPercent;

    setSplitWidthPercent(split, currentValue + delta);
  }, [activeListWidthPercent, historicListWidthPercent, setSplitWidthPercent, yoursListWidthPercent]);

  useEffect(() => {
    if (!draggingSplit) {
      return;
    }

    const updateSplitFromPointer = (clientX: number) => {
      const container = getSplitContentRef(draggingSplit).current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const offsetX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const nextPercent = (offsetX / rect.width) * 100;

      setSplitWidthPercent(draggingSplit, nextPercent);
    };

    const handlePointerMove = (event: PointerEvent) => {
      updateSplitFromPointer(event.clientX);
    };

    const handlePointerUp = () => {
      setDraggingSplit(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingSplit, getSplitContentRef, setSplitWidthPercent]);

  return (
    <TooltipProvider delayDuration={150}>
      <Tabs defaultValue="active" className="recent-games-panel w-full">
      <TabsList className="recent-games-tabs">
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="saved">Yours ({yoursGameCount})</TabsTrigger>
        <TabsTrigger value="historic">Historic</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="recent-games-content">
        <div className="recent-games-active">
          <Dialog open={isMakeGameDialogOpen} onOpenChange={setIsMakeGameDialogOpen}>
            <DialogContent className="make-game-dialog">
              <DialogHeader>
                <DialogTitle>Make Game</DialogTitle>
                <DialogDescription>
                  Send a direct invite by username or create an open game that any signed-in player can join.
                </DialogDescription>
              </DialogHeader>

              {!accountEmail ? (
                <p className="muted">Sign in to create and track multiplayer games.</p>
              ) : !accountUsername ? (
                <p className="muted">Claim a username in the menu before creating multiplayer invites.</p>
              ) : (
                <div className="make-game-dialog__body">
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">Opponent name</span>
                    <Input
                      placeholder={inviteIsOpenGame ? "Open to anyone" : "username"}
                      value={inviteOpponentUsername}
                      onChange={(event) => setInviteOpponentUsername(event.target.value)}
                      disabled={isSubmittingInvite || inviteIsOpenGame}
                    />
                  </label>
                  <label className="recent-games-active__rated">
                    <Checkbox
                      checked={inviteIsOpenGame}
                      onCheckedChange={(checked) => setInviteIsOpenGame(checked === true)}
                      disabled={isSubmittingInvite}
                    />
                    <span>Open game</span>
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium">City</span>
                    <Select
                      value={inviteCityEditionId}
                      disabled={isSubmittingInvite || multiplayerCityOptions.length === 0}
                      onValueChange={setInviteCityEditionId}
                    >
                      <SelectTrigger aria-label="City">
                        <SelectValue placeholder="Choose city..." />
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
                        <SelectValue placeholder="Choose time..." />
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
                    <span className="text-sm font-medium">Creator side</span>
                    <Select
                      value={inviteCreatorSide}
                      disabled={isSubmittingInvite}
                      onValueChange={(value) => setInviteCreatorSide(value as InviteCreatorSide)}
                    >
                      <SelectTrigger aria-label="Creator side">
                        <SelectValue placeholder="Choose side..." />
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <label className="recent-games-active__rated">
                        <Checkbox
                          checked={inviteCasual}
                          onCheckedChange={(checked) => setInviteCasual(checked === true)}
                          disabled={isSubmittingInvite}
                        />
                        <span>Casual game</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent>
                      Casual games do not change either player's Elo rating.
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmittingInvite}>
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleCreateInvite()}
                  disabled={
                    isSubmittingInvite ||
                    !accountEmail ||
                    !accountUsername ||
                    multiplayerCityOptions.length === 0
                  }
                >
                  <Send data-icon="inline-start" />
                  {isSubmittingInvite ? "Sending..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="recent-games-active__composer">
            <div className="recent-games-active__composer-header">
              <div>
                <h4>Open Games</h4>
              </div>
              <div className="recent-games-active__header-actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsMakeGameDialogOpen(true)}
                  disabled={!accountEmail || !accountUsername}
                >
                  <Plus data-icon="inline-start" />
                  Make Game
                </Button>
                <span className="recent-games-active__refresh-timestamp muted" aria-live="polite">
                  {formatRelativeTimestamp(lastActiveGamesRefreshAt, clockNow)}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => void refreshActiveGames()}
                  disabled={isLoadingActiveGames}
                  aria-label="Refresh active games"
                  title="Refresh active games"
                >
                  <RefreshCcw />
                </Button>
              </div>
            </div>

            {!accountEmail ? (
              <p className="muted">Sign in to create and track multiplayer games.</p>
            ) : !accountUsername ? (
              <p className="muted">Claim a username in the menu before creating multiplayer invites.</p>
            ) : showInlineInviteFallback ? (
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
                    checked={inviteCasual}
                    onCheckedChange={(checked) => setInviteCasual(checked === true)}
                    disabled={isSubmittingInvite}
                  />
                  <span>Casual game</span>
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
            ) : null}

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

          <div className="recent-games-split">
            <div ref={activeSplitContentRef} className="recent-games-split__content" style={activeSplitStyle}>
              <div
                className="recent-games-active__list-shell recent-games-split__list"
                onMouseLeave={() => setHoveredActiveGameId(null)}
              >
            {isLoadingActiveGames && !activeGames.length ? (
              <p className="muted">Loading multiplayer games…</p>
            ) : activeGames.length || accountEmail ? (
              <div className="recent-games-active__sections">
                <section className="recent-games-active__section">
                  {currentActiveGames.length ? (
                    <ul className="recent-games-active__list">
                      {currentActiveGames.map((game) => (
                  <li
                    key={game.gameId}
                    className="recent-games-active__entry"
                    data-selected={previewActiveGame?.gameId === game.gameId ? "true" : "false"}
                    data-timeout={game.isTimedOut ? "true" : "false"}
                    onClick={() => setSelectedActiveGameId(game.gameId)}
                    onFocusCapture={() => setSelectedActiveGameId(game.gameId)}
                    onMouseEnter={() => setHoveredActiveGameId(game.gameId)}
                  >
                    <div className="recent-games-active__entry-header">
                      <div className="recent-games-active__entry-main">
                        <div className="recent-games-active__entry-title-row">
                          <h4>{activeGameHeading(game)}</h4>
                          <Badge variant={game.isIncomingInvite || game.isYourTurn ? "secondary" : "outline"}>
                            {activeGameStatusLabel(game)}
                          </Badge>
                          {game.isTimedOut ? (
                            <Badge variant={game.canClaimTimeout ? "secondary" : "outline"}>
                              <Clock3 data-icon="inline-start" />
                              Timed out
                            </Badge>
                          ) : null}
                          {activeMultiplayerGameId === game.gameId ? (
                            <Badge variant="outline">Open</Badge>
                          ) : null}
                        </div>
                        <p className="recent-games-active__entry-meta">
                          {game.opponentUsername
                            ? `@${game.opponentUsername}`
                            : game.isOpenGame
                              ? "Waiting for player"
                              : "Unnamed opponent"} ·{" "}
                          {game.cityLabel ?? "Default board"} ·{" "}
                          {formatTimeControlLabel({
                            timeControlKind: game.timeControlKind,
                            baseSeconds: game.baseSeconds,
                            incrementSeconds: game.incrementSeconds,
                            moveDeadlineSeconds: game.moveDeadlineSeconds
                          })} · {game.rated ? "Rated" : "Casual"} · Elo {game.opponentEloRating}
                        </p>
                        {game.isTimedOut ? (
                          <p className="recent-games-active__entry-timeout">
                            <Clock3 data-icon="inline-start" />
                            <span>{activeGameTimeoutSummary(game)}</span>
                          </p>
                        ) : null}
                        <p className="recent-games-active__entry-meta">{activeGameTimeNote(game)}</p>
                      </div>
                      {game.canJoinOpenGame ? (
                        <div className="recent-games-active__entry-actions">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleJoinOpenGame(game.gameId)}
                          >
                            <Check data-icon="inline-start" />
                            Join
                          </Button>
                        </div>
                      ) : game.isIncomingInvite ? (
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
                          {game.canClaimTimeout ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={claimingGameId === game.gameId}
                              onClick={() => void handleClaimTimeout(game.gameId)}
                            >
                              <Flag data-icon="inline-start" />
                              {claimingGameId === game.gameId ? "Claiming..." : "Claim on time"}
                            </Button>
                          ) : null}
                          {game.canClaimTimeout ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={claimingGameId === game.gameId || archivingGameId === game.gameId}
                              onClick={() => void handleClaimAndArchiveTimeout(game.gameId)}
                            >
                              <Archive data-icon="inline-start" />
                              {claimingGameId === game.gameId || archivingGameId === game.gameId
                                ? "Removing..."
                                : "Claim & remove"}
                            </Button>
                          ) : null}
                          {game.isOutgoingInvite && game.status === "invited" ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={cancellingGameId === game.gameId}
                              onClick={() => void handleCancelInvite(game.gameId)}
                            >
                              <X data-icon="inline-start" />
                              {cancellingGameId === game.gameId ? "Cancelling..." : "Cancel"}
                            </Button>
                          ) : null}
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
              </div>
            ) : (
              <p className="muted">
                No multiplayer games yet. Save current local runs to <strong>Yours</strong> when you
                want a personal snapshot.
              </p>
            )}
              </div>
              <button
                type="button"
                className="recent-games-split__splitter"
                role="separator"
                aria-label="Resize active games list and details panels"
                aria-orientation="vertical"
                aria-valuemin={minimumListWidthPercent}
                aria-valuemax={maximumListWidthPercent}
                aria-valuenow={Math.round(activeListWidthPercent)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDraggingSplit("active");
                }}
                onKeyDown={(event) => {
                  const nextStep = event.shiftKey ? 4 : 2;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    adjustSplitWidth("active", -nextStep);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    adjustSplitWidth("active", nextStep);
                  }
                }}
              >
                <span aria-hidden="true" />
              </button>
              <ActiveGameDetails
                game={previewActiveGame}
                activeMultiplayerGameId={activeMultiplayerGameId}
                emptyMessage="Select an active game to see match details."
                claimingGameId={claimingGameId}
                cancellingGameId={cancellingGameId}
                archivingGameId={archivingGameId}
                onJoinOpenGame={(gameId) => void handleJoinOpenGame(gameId)}
                onLoadActiveGame={onLoadActiveGame}
                onRespondToInvite={(gameId, response) => void handleRespondToInvite(gameId, response)}
                onClaimTimeout={(gameId) => void handleClaimTimeout(gameId)}
                onClaimAndArchiveTimeout={(gameId) => void handleClaimAndArchiveTimeout(gameId)}
                onCancelInvite={(gameId) => void handleCancelInvite(gameId)}
                onArchiveGame={(gameId, archive) => void handleArchiveGame(gameId, archive)}
              />
            </div>
          </div>
        </div>
      </TabsContent>

      <TabsContent value="historic" className="recent-games-content">
        <div className="recent-games-split">
          <div ref={historicSplitContentRef} className="recent-games-split__content" style={historicSplitStyle}>
            <ul
              className="recent-games-split__list"
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
              className="recent-games-split__splitter"
              role="separator"
              aria-label="Resize historic games list and details panels"
              aria-orientation="vertical"
              aria-valuemin={minimumListWidthPercent}
              aria-valuemax={maximumListWidthPercent}
              aria-valuenow={Math.round(historicListWidthPercent)}
              onPointerDown={(event) => {
                event.preventDefault();
                  setDraggingSplit("historic");
              }}
              onKeyDown={(event) => {
                const nextStep = event.shiftKey ? 4 : 2;
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  adjustSplitWidth("historic", -nextStep);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  adjustSplitWidth("historic", nextStep);
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
        {accountEmail ? (
          <div className="recent-games-active__toolbar">
            <label className="recent-games-active__rated">
              <Checkbox
                checked={showArchivedYours}
                onCheckedChange={(checked) => setShowArchivedYours(checked === true)}
              />
              <span>Show archived multiplayer games</span>
            </label>
          </div>
        ) : null}
        {yoursGameCount || showArchivedYours ? (
          <div className="recent-games-split">
            <div ref={yoursSplitContentRef} className="recent-games-split__content" style={yoursSplitStyle}>
              <div className="recent-games-split__list">
                {savedMatches.length ? (
                  <section className="recent-games-active__section">
                    <h4>Saved</h4>
                    <ul className="recent-games-list" role="listbox" aria-label="Saved games">
                      {savedMatches.map((savedMatch) => {
                        const itemId = `saved:${savedMatch.id}`;

                        return (
                          <RecentGameRow
                            key={savedMatch.id}
                            selected={selectedYoursGame?.kind === "saved" && selectedYoursGame.match.id === savedMatch.id}
                            onClick={() => {
                              setSelectedYoursGameId(itemId);
                              onSelectSavedMatch(savedMatch.id);
                            }}
                            title={savedMatch.name}
                            description={formatSavedAt(savedMatch.savedAt)}
                            meta={`${savedMatch.moveCount} moves`}
                          />
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                {completedActiveGames.length ? (
                  <section className="recent-games-active__section">
                    <h4>Completed Multiplayer</h4>
                    <ul className="recent-games-list" role="listbox" aria-label="Completed multiplayer games">
                      {completedActiveGames.map((game) => (
                        <RecentGameRow
                          key={game.gameId}
                          selected={selectedYoursGame?.kind === "completed" && selectedYoursGame.game.gameId === game.gameId}
                          onClick={() => setSelectedYoursGameId(`completed:${game.gameId}`)}
                          title={activeGameHeading(game)}
                          description={`${activeGameOpponentLabel(game)} - ${game.cityLabel ?? "Default board"}`}
                          meta={`${activeGameResultLabel(game)}${game.archivedAt ? " · Archived" : ""}`}
                        />
                      ))}
                    </ul>
                  </section>
                ) : showArchivedYours ? (
                  <p className="muted">No archived multiplayer games yet.</p>
                ) : null}
              </div>
              <button
                type="button"
                className="recent-games-split__splitter"
                role="separator"
                aria-label="Resize your games list and details panels"
                aria-orientation="vertical"
                aria-valuemin={minimumListWidthPercent}
                aria-valuemax={maximumListWidthPercent}
                aria-valuenow={Math.round(yoursListWidthPercent)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDraggingSplit("yours");
                }}
                onKeyDown={(event) => {
                  const nextStep = event.shiftKey ? 4 : 2;
                  if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    adjustSplitWidth("yours", -nextStep);
                  } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    adjustSplitWidth("yours", nextStep);
                  }
                }}
              >
                <span aria-hidden="true" />
              </button>
              {selectedYoursGame?.kind === "completed" ? (
                <ActiveGameDetails
                  game={selectedYoursGame.game}
                  activeMultiplayerGameId={activeMultiplayerGameId}
                  emptyMessage="Select a completed multiplayer game."
                  claimingGameId={claimingGameId}
                  cancellingGameId={cancellingGameId}
                  archivingGameId={archivingGameId}
                  onJoinOpenGame={(gameId) => void handleJoinOpenGame(gameId)}
                  onLoadActiveGame={onLoadActiveGame}
                  onRespondToInvite={(gameId, response) => void handleRespondToInvite(gameId, response)}
                  onClaimTimeout={(gameId) => void handleClaimTimeout(gameId)}
                  onClaimAndArchiveTimeout={(gameId) => void handleClaimAndArchiveTimeout(gameId)}
                  onCancelInvite={(gameId) => void handleCancelInvite(gameId)}
                  onArchiveGame={(gameId, archive) => void handleArchiveGame(gameId, archive)}
                />
              ) : (
                <SavedMatchDetails
                  match={selectedYoursGame?.kind === "saved" ? selectedYoursGame.match : null}
                  onDeleteSelectedSavedMatch={onDeleteSelectedSavedMatch}
                  onLoadSavedMatch={onLoadSavedMatch}
                />
              )}
            </div>
          </div>
        ) : (
          <p className="muted">No saved or completed games yet.</p>
        )}
      </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
