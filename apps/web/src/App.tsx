import {
  useCallback,
  useEffect,
  lazy,
  useMemo,
  useRef,
  Suspense,
  useState
} from "react";
import {
  Building2,
  ChessPawn,
  Cloud,
  ChevronDown,
  FileJson,
  Flag,
  Handshake,
  Pencil,
  RefreshCcw,
  Scroll,
  Telescope,
  UsersRound
} from "lucide-react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { CityBoard, GameSnapshot, PieceKind, Square } from "@narrative-chess/content-schema";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import {
  applyAppTheme,
  applyHighlightColor,
  listAppSettings,
  saveAppSettings,
  type AppSettings,
  type HighlightColor
} from "./appSettings";
import { edinburghBoard } from "./edinburghBoard";
import {
  listWorkspaceLayoutState,
  saveWorkspaceLayoutState,
  setWorkspacePanelCollapsed,
  type CollapsibleWorkspacePanelId
} from "./layoutState";
import { listKnownWorkspaceLayoutFiles } from "./layoutFiles";
import { applyPieceStyleSheet, listPieceStyleSheet, resetPieceStyleSheet, savePieceStyleSheet } from "./pieceStyles";
import { listReferenceGames, saveReferenceGames, type ReferenceGameLibrary } from "./referenceGames";
import {
  connectRoleCatalogDirectory,
  getConnectedRoleCatalogDirectoryName,
  loadClassicGamesFromDirectory,
  loadCityDraftFromDirectory,
  loadRoleCatalogFromDirectory,
  saveRoleCatalogDraftToDirectory,
  supportsDirectoryWrite as supportsRoleCatalogDirectory,
  saveClassicGamesDraftToDirectory,
  saveCityDraftToDirectory,
  getConnectedWorkspaceLayoutDirectoryName,
  loadWorkspaceLayoutFileFromDirectory,
  saveWorkspaceLayoutFileToDirectory,
  savePageLayoutFileToDirectory,
  connectPieceStylesDirectory,
  getConnectedPieceStylesDirectoryName,
  loadPieceStylesFromDirectory,
  savePieceStylesDraftToDirectory,
  supportsWorkspaceLayoutDirectory
} from "./fileSystemAccess";
import {
  appendActiveGameMoveInSupabase,
  claimGameTimeoutInSupabase,
  formatTimeControlLabel,
  loadActiveGameSessionFromSupabase,
  resignGameInSupabase,
  subscribeToActiveGameMoveInserts,
  type TimeControlKind
} from "./activeGames";
import {
  bootstrapFirstAdmin,
  getCurrentSession,
  loadCurrentUserRole,
  signInWithPassword,
  signUpWithPassword,
  sendPasswordResetEmail,
  signOut,
  subscribeToAuthChanges,
  updatePassword,
  type AppRole
} from "./auth";
import {
  loadCurrentUserProfile,
  saveCurrentUserProfile,
  type UserProfile
} from "./profiles";
import {
  cityBoardDefinitions,
  getCityBoardDefinition,
  isSupabasePublishedCitiesEnabled,
  listFallbackPlayableCityOptions,
  listPlayableCityOptions,
  loadLatestDraftCityBoard,
  loadPublishedCityBoard,
  type PlayableCityOption
} from "./cityBoards";
import { listCityBoardDraft, saveCityBoardDraft } from "./cityReviewState";
import { getAnimatedPieceFrames } from "./chessMotion";
import { allPageLayoutTargets, listPageLayoutState, savePageLayoutState } from "./pageLayoutState";
import { getBundledPageLayout, getBundledWorkspaceLayout } from "./bundledLayouts";
import { AppMenu, UserMenu } from "./components/AppMenu";
import type { LayoutNavigation } from "./components/IndexedWorkspace";
import { DistrictBadge } from "./components/DistrictBadge";
import { useChessMatch } from "./hooks/useChessMatch";
import { useMovePlayhead } from "./hooks/useMovePlayhead";
import {
  addRoleCatalogEntry,
  duplicateRoleCatalogEntry,
  listRoleCatalog,
  removeRoleCatalogEntry,
  resetRoleCatalog,
  saveRoleCatalog,
  updateRoleCatalogEntry
} from "./roleCatalog";

const CityReviewPage = lazy(() =>
  import("./components/CityReviewPage").then((module) => ({ default: module.CityReviewPage }))
);
const MatchWorkspacePage = lazy(() =>
  import("./components/MatchWorkspacePage").then((module) => ({ default: module.MatchWorkspacePage }))
);
const ClassicGamesLibraryPage = lazy(() =>
  import("./components/ClassicGamesLibraryPage").then((module) => ({ default: module.ClassicGamesLibraryPage }))
);
const RoleCatalogPage = lazy(() =>
  import("./components/RoleCatalogPage").then((module) => ({ default: module.RoleCatalogPage }))
);
const DesignPage = lazy(() =>
  import("./components/DesignPage").then((module) => ({ default: module.DesignPage }))
);
const ResearchPage = lazy(() =>
  import("./components/ResearchPage").then((module) => ({ default: module.ResearchPage }))
);

type AppPage = "match" | "classics" | "cities" | "roles" | "design" | "research";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type SaveEverythingNotice = LayoutFileNotice;

type PlayCitySource = "fallback" | "supabase-published" | "supabase-draft";
type PlayCityPreviewMode = "published" | "draft";
type PlayCityBoardLoadResult = {
  board: CityBoard;
  source: PlayCitySource;
  publishedEditionId: string | null;
  matchesFallback: boolean | null;
};

type ActiveMultiplayerSession = {
  gameId: string;
  cityEditionId: string | null;
  status: "invited" | "active" | "completed" | "abandoned" | "cancelled";
  rated: boolean;
  yourSide: "white" | "black" | "spectator";
  currentTurn: "white" | "black" | null;
  syncedMoveCount: number;
  timeControlKind: TimeControlKind;
  baseSeconds: number | null;
  incrementSeconds: number;
  moveDeadlineSeconds: number | null;
  deadlineAt: string | null;
  whiteSecondsRemaining: number | null;
  blackSecondsRemaining: number | null;
  turnStartedAt: string | null;
  result: "white" | "black" | "draw" | "abandoned" | "cancelled" | null;
  whiteRatingDelta: number | null;
  blackRatingDelta: number | null;
};

const historyPlaybackDelayMs = 700;

const pageOptions: Array<{ value: AppPage; label: string; icon?: React.ReactNode }> = [
  { value: "match", label: "Play", icon: <ChessPawn className="size-4" /> },
  { value: "cities", label: "Cities", icon: <Building2 className="size-4" /> },
  { value: "roles", label: "Characters", icon: <UsersRound className="size-4" /> },
  { value: "classics", label: "Historic", icon: <Scroll className="size-4" /> },
  { value: "research", label: "Research", icon: <Telescope className="size-4" /> },
  { value: "design", label: "Design", icon: <Pencil className="size-4" /> }
];

const pageLayoutSaveTargets = allPageLayoutTargets;

function isAppPage(value: string | null): value is AppPage {
  return (
    value === "match" ||
    value === "classics" ||
    value === "cities" ||
    value === "roles" ||
    value === "design" ||
    value === "research"
  );
}

function getInitialPage() {
  if (typeof window === "undefined") {
    return "match" as AppPage;
  }

  const requestedPage = new URLSearchParams(window.location.search).get("page");
  if (requestedPage === "edinburgh") {
    return "cities";
  }
  return isAppPage(requestedPage) ? requestedPage : ("match" as AppPage);
}

function statusLabel(isCheck: boolean, isCheckmate: boolean, isStalemate: boolean) {
  if (isCheckmate) {
    return "Checkmate";
  }

  if (isStalemate) {
    return "Stalemate";
  }

  if (isCheck) {
    return "Check";
  }

  return "In play";
}

function statusCardStateClassName(isCheck: boolean, isCheckmate: boolean) {
  if (isCheckmate) {
    return "app-header__status-card--king-checkmate";
  }

  if (isCheck) {
    return "app-header__status-card--king-check";
  }

  return "";
}

function turnLabel(turn: "white" | "black") {
  return turn === "white" ? "White" : "Black";
}

function multiplayerResultLabel(result: ActiveMultiplayerSession["result"]) {
  if (result === "white") {
    return "White won";
  }

  if (result === "black") {
    return "Black won";
  }

  if (result === "draw") {
    return "Draw";
  }

  if (result === "abandoned") {
    return "Abandoned";
  }

  if (result === "cancelled") {
    return "Cancelled";
  }

  return "In progress";
}

function formatClockSeconds(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const [page, setPage] = useState<AppPage>(() => getInitialPage());
  const [referenceGamesLibrary, setReferenceGamesLibrary] = useState<ReferenceGameLibrary>(() =>
    listReferenceGames()
  );
  const [selectedReferenceGameId, setSelectedReferenceGameId] = useState(
    () => listReferenceGames()[0]?.id ?? ""
  );
  const [settings, setSettings] = useState<AppSettings>(() => listAppSettings());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [inspectedSquare, setInspectedSquare] = useState<Square | null>(null);
  const [roleCatalog, setRoleCatalog] = useState(() => listRoleCatalog());
  const [roleCatalogDirectoryName, setRoleCatalogDirectoryName] = useState<string | null>(null);
  const [roleCatalogFileBusyAction, setRoleCatalogFileBusyAction] = useState<string | null>(null);
  const [roleCatalogFileNotice, setRoleCatalogFileNotice] = useState<LayoutFileNotice | null>(null);
  const [isRoleCatalogDirectorySupported, setIsRoleCatalogDirectorySupported] = useState(false);
  const [workspaceLayout, setWorkspaceLayout] = useState(() => listWorkspaceLayoutState());
  const [layoutFileName, setLayoutFileName] = useState("match-workspace");
  const [, setLayoutDirectoryName] = useState<string | null>(null);
  const [saveEverythingNotice, setSaveEverythingNotice] = useState<SaveEverythingNotice | null>(null);
  const [isSavingEverything, setIsSavingEverything] = useState(false);
  const [isLoadingEverything, setIsLoadingEverything] = useState(false);
  const [isResettingEverything, setIsResettingEverything] = useState(false);
  const [, setKnownLayoutFiles] = useState(() => listKnownWorkspaceLayoutFiles());
  const [pieceStyleSheet, setPieceStyleSheet] = useState(() => listPieceStyleSheet());
  const [pieceStyleDirectoryName, setPieceStyleDirectoryName] = useState<string | null>(null);
  const [pieceStyleFileBusyAction, setPieceStyleFileBusyAction] = useState<string | null>(null);
  const [pieceStyleFileNotice, setPieceStyleFileNotice] = useState<LayoutFileNotice | null>(null);
  const [isPieceStyleDirectorySupported, setIsPieceStyleDirectorySupported] = useState(false);
  const [selectedSavedMatchId, setSelectedSavedMatchId] = useState<string | null>(null);
  const [isHistoryPlaying, setIsHistoryPlaying] = useState(false);
  const useSupabasePublishedCities = isSupabasePublishedCitiesEnabled();
  const [playCityOptions, setPlayCityOptions] = useState<PlayableCityOption[]>(() =>
    listFallbackPlayableCityOptions()
  );
  const [playCityOptionId, setPlayCityOptionId] = useState<string>(() =>
    listFallbackPlayableCityOptions()[0]?.id ?? edinburghBoard.id
  );
  const [playCityBoard, setPlayCityBoard] = useState<CityBoard>(() =>
    useSupabasePublishedCities ? edinburghBoard : listCityBoardDraft(edinburghBoard.id, edinburghBoard)
  );
  const [playCitySource, setPlayCitySource] = useState<PlayCitySource>(
    useSupabasePublishedCities ? "fallback" : "fallback"
  );
  const [playCityPreviewMode, setPlayCityPreviewMode] = useState<PlayCityPreviewMode>("published");
  const [playCityPublishedEditionId, setPlayCityPublishedEditionId] = useState<string | null>(
    listFallbackPlayableCityOptions()[0]?.publishedEditionId ?? null
  );
  const [playCityMatchesFallback, setPlayCityMatchesFallback] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionRole, setSessionRole] = useState<AppRole>("player");
  const [sessionProfile, setSessionProfile] = useState<UserProfile | null>(null);
  const [viewAsRole, setViewAsRole] = useState<AppRole>("player");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [activeMultiplayerSession, setActiveMultiplayerSession] = useState<ActiveMultiplayerSession | null>(null);
  const [isSyncingActiveMultiplayerMove, setIsSyncingActiveMultiplayerMove] = useState(false);
  const [isRefreshingActiveMultiplayerSession, setIsRefreshingActiveMultiplayerSession] = useState(false);
  const [activeMultiplayerRefreshError, setActiveMultiplayerRefreshError] = useState<string | null>(null);
  const [activeMultiplayerLastRefreshAt, setActiveMultiplayerLastRefreshAt] = useState<string | null>(null);
  const [isClaimingActiveMultiplayerTimeout, setIsClaimingActiveMultiplayerTimeout] = useState(false);
  const [isResigningActiveMultiplayerGame, setIsResigningActiveMultiplayerGame] = useState(false);
  const [isResignDialogOpen, setIsResignDialogOpen] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const activeMultiplayerMoveSyncRef = useRef<string | null>(null);
  const handleCityBoardDraftChange = useCallback((board: CityBoard) => {
    if (useSupabasePublishedCities) {
      return;
    }

    if (board.id === playCityBoard.id) {
      setPlayCityBoard(board);
    }
  }, [playCityBoard.id, useSupabasePublishedCities]);

  const selectedPlayCityOption = useMemo(
    () => playCityOptions.find((option) => option.id === playCityOptionId) ?? playCityOptions[0] ?? null,
    [playCityOptionId, playCityOptions]
  );
  const multiplayerCityOptions = useMemo(() => {
    const seen = new Set<string>();

    return playCityOptions
      .filter((option) => option.publishedEditionId)
      .map((option) => ({
        id: option.publishedEditionId ?? option.id,
        label: option.displayLabel
      }))
      .filter((option) => {
        if (seen.has(option.id)) {
          return false;
        }

        seen.add(option.id);
        return true;
      });
  }, [playCityOptions]);
  const effectiveRole = viewAsRole;
  const canAccessDraftCities = effectiveRole === "author" || effectiveRole === "admin";
  const canPublishCities = effectiveRole === "admin";
  const isActiveMultiplayerSessionLoaded = activeMultiplayerSession !== null;
  const isActiveMultiplayerTurn =
    activeMultiplayerSession?.status === "active" &&
    activeMultiplayerSession.currentTurn === activeMultiplayerSession.yourSide &&
    !isSyncingActiveMultiplayerMove;
  const activeMultiplayerMoveSide =
    !activeMultiplayerSession
      ? undefined
      : isActiveMultiplayerTurn &&
          (activeMultiplayerSession.yourSide === "white" || activeMultiplayerSession.yourSide === "black")
        ? activeMultiplayerSession.yourSide
        : null;
  const visiblePageOptions = useMemo(
    () =>
      effectiveRole === "player"
        ? pageOptions.filter((option) => option.value === "match" || option.value === "cities")
        : pageOptions,
    [effectiveRole]
  );
  const canPreviewDraftPlayCity =
    canAccessDraftCities &&
    useSupabasePublishedCities &&
    Boolean(selectedPlayCityOption?.publishedEditionId);
  const effectivePlayCityPreviewMode: PlayCityPreviewMode =
    canPreviewDraftPlayCity && playCityPreviewMode === "draft" ? "draft" : "published";
  const playCitySourceLabel =
    playCitySource === "supabase-draft"
      ? "Supabase draft"
      : playCitySource === "supabase-published"
        ? "Supabase published"
        : "Bundled fallback";
  const playCityMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [playCityMenuMaxWidth, setPlayCityMenuMaxWidth] = useState<number>(320);

  const resolveAppRole = useCallback(async (user: { id: string } | null) => {
    const initialRole = await loadCurrentUserRole(user);
    if (!user || initialRole !== "player") {
      return initialRole;
    }

    const nextRole = await bootstrapFirstAdmin();
    if (nextRole === "admin") {
      return "admin" as AppRole;
    }

    return loadCurrentUserRole(user);
  }, []);

  const refreshCurrentUserProfile = useCallback(async (user: { id: string } | null) => {
    if (!user) {
      setSessionProfile(null);
      return;
    }

    try {
      setSessionProfile(await loadCurrentUserProfile());
    } catch (error) {
      console.warn("[supabase] Could not read current profile.", error);
      setSessionProfile(null);
    }
  }, []);

  const clearActiveMultiplayerSession = useCallback(() => {
    activeMultiplayerMoveSyncRef.current = null;
    setActiveMultiplayerSession(null);
    setActiveMultiplayerRefreshError(null);
    setActiveMultiplayerLastRefreshAt(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    void listPlayableCityOptions()
      .then((options) => {
        if (!cancelled) {
          setPlayCityOptions(options);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("[supabase] Could not load playable city options.", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (canPreviewDraftPlayCity) {
      return;
    }

    setPlayCityPreviewMode("published");
  }, [canPreviewDraftPlayCity]);

  useEffect(() => {
    if (!selectedPlayCityOption) {
      return;
    }

    if (playCityOptions.some((option) => option.id === playCityOptionId)) {
      return;
    }

    setPlayCityOptionId(selectedPlayCityOption.id);
  }, [playCityOptionId, playCityOptions, selectedPlayCityOption]);

  useEffect(() => {
    if (!selectedPlayCityOption) {
      return;
    }

    const definition = getCityBoardDefinition(selectedPlayCityOption.boardId);
    if (!definition) {
      return;
    }

    let cancelled = false;

    if (!useSupabasePublishedCities) {
      const nextBoard = listCityBoardDraft(definition.id, definition.board);
      setPlayCityBoard(nextBoard);
      setPlayCitySource("fallback");
      setPlayCityPublishedEditionId(selectedPlayCityOption.publishedEditionId);
      setPlayCityMatchesFallback(null);
      return;
    }

    const loadRemoteBoard = async (): Promise<PlayCityBoardLoadResult> => {
      if (effectivePlayCityPreviewMode === "draft") {
        const draftResult = await loadLatestDraftCityBoard(definition);
        if (draftResult) {
          return {
            board: draftResult.board,
            source: "supabase-draft",
            publishedEditionId: draftResult.cityEditionId,
            matchesFallback: null
          };
        }
      }

      const result = await loadPublishedCityBoard(definition, selectedPlayCityOption.publishedEditionId);
      return {
        ...result,
        source: result.source === "supabase" ? "supabase-published" : "fallback"
      };
    };

    void loadRemoteBoard()
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.source === "supabase-published" && result.matchesFallback === false) {
          console.warn(
            `[supabase] Published city board for ${selectedPlayCityOption.id} differs from bundled fallback ${definition.boardFileStem}.`
          );
        }

        setPlayCityBoard(result.board);
        setPlayCitySource(result.source);
        setPlayCityPublishedEditionId(result.publishedEditionId);
        setPlayCityMatchesFallback(result.matchesFallback);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn(`[supabase] Could not load published city board for ${selectedPlayCityOption.id}.`, error);
          setPlayCityBoard(definition.board);
          setPlayCitySource("fallback");
          setPlayCityPublishedEditionId(selectedPlayCityOption.publishedEditionId);
          setPlayCityMatchesFallback(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectivePlayCityPreviewMode, selectedPlayCityOption, useSupabasePublishedCities]);

  useEffect(() => {
    let cancelled = false;

    const applySessionState = async () => {
      try {
        const session = await getCurrentSession();
        if (cancelled) {
          return;
        }

        const user = session?.user ?? null;
        setSessionEmail(user?.email ?? null);
        setSessionRole(await resolveAppRole(user));
        await refreshCurrentUserProfile(user);
      } catch (error) {
        if (!cancelled) {
          console.warn("[supabase] Could not read current auth session.", error);
          setSessionEmail(null);
          setSessionRole("player");
          setSessionProfile(null);
        }
      }
    };

    void applySessionState();

    const unsubscribe = subscribeToAuthChanges((session) => {
      const user = session?.user ?? null;
      setSessionEmail(user?.email ?? null);
      void refreshCurrentUserProfile(user);
      void resolveAppRole(user)
        .then((role) => {
          if (!cancelled) {
            setSessionRole(role);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.warn("[supabase] Could not read user role.", error);
            setSessionRole("player");
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [refreshCurrentUserProfile, resolveAppRole]);

  useEffect(() => {
    if (sessionEmail) {
      return;
    }

    clearActiveMultiplayerSession();
  }, [clearActiveMultiplayerSession, sessionEmail]);

  useEffect(() => {
    const allowedViewAsRoles =
      sessionRole === "admin"
        ? (["admin", "author", "player"] as AppRole[])
        : sessionRole === "author"
          ? (["author", "player"] as AppRole[])
          : (["player"] as AppRole[]);

    if (!allowedViewAsRoles.includes(viewAsRole)) {
      setViewAsRole(allowedViewAsRoles[0]);
    }
  }, [sessionRole, viewAsRole]);

  useEffect(() => {
    if (visiblePageOptions.some((option) => option.value === page)) {
      return;
    }

    setPage("match");
  }, [page, visiblePageOptions]);

  useEffect(() => {
    const trigger = playCityMenuTriggerRef.current;
    const panel = trigger?.closest(".panel");
    if (!trigger || !panel || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateMenuWidth = () => {
      const triggerWidth = trigger.getBoundingClientRect().width;
      const panelWidth = panel.getBoundingClientRect().width;
      setPlayCityMenuMaxWidth(Math.max(triggerWidth, panelWidth - 32));
    };

    updateMenuWidth();

    const observer = new ResizeObserver(() => {
      updateMenuWidth();
    });

    observer.observe(trigger);
    observer.observe(panel);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (
      !workspaceLayout.collapsed.board &&
      !workspaceLayout.collapsed.moves &&
      !workspaceLayout.collapsed["story-tone"] &&
      !workspaceLayout.collapsed["city-map-maplibre"]
    ) {
      return;
    }

    setWorkspaceLayout((current) =>
      ["board", "moves", "story-tone", "city-map-maplibre"].reduce(
        (nextLayout, panelId) =>
          setWorkspacePanelCollapsed({
            layoutState: nextLayout,
            panelId: panelId as CollapsibleWorkspacePanelId,
            collapsed: false
          }),
        current
      )
    );
  }, [workspaceLayout.collapsed]);
  const canCommitActiveMultiplayerMove = useCallback((nextSnapshot: GameSnapshot) => {
    if (!activeMultiplayerSession) {
      return true;
    }

    return (
      activeMultiplayerSession.status === "active" &&
      activeMultiplayerSession.currentTurn === activeMultiplayerSession.yourSide &&
      nextSnapshot.moveHistory.length <= activeMultiplayerSession.syncedMoveCount &&
      !isSyncingActiveMultiplayerMove
    );
  }, [activeMultiplayerSession, isSyncingActiveMultiplayerMove]);

  const {
    snapshot,
    timelineKey,
    historySnapshots,
    historyMoves,
    historyEvents,
    selectedPly,
    totalPlies,
    boardSquares,
    selectedSquare,
    savedMatches,
    legalMoves,
    isStudyMode,
    tonePreset,
    lastMove,
    handleSquareClick,
    goToPly,
    loadReferenceGame,
    jumpToStart,
    stepBackward,
    stepForward,
    jumpToEnd,
    updateTonePreset,
    loadSavedMatch,
    removeSavedMatch,
    loadSnapshot
  } = useChessMatch({
    roleCatalog,
    moveInteractionLocked: isActiveMultiplayerSessionLoaded && !isActiveMultiplayerTurn,
    localControlsLocked: isActiveMultiplayerSessionLoaded,
    localMoveSide: activeMultiplayerMoveSide,
    canCommitLocalMove: canCommitActiveMultiplayerMove
  });
  const handleLoadActiveMultiplayerGame = useCallback(async (gameId: string) => {
    try {
      const session = await loadActiveGameSessionFromSupabase(gameId);
      if (!session) {
        return;
      }

      if (
        session.cityEditionId &&
        playCityOptions.some((option) => option.id === session.cityEditionId)
      ) {
        setPlayCityOptionId(session.cityEditionId);
      }

      loadSnapshot(session.snapshot);
      activeMultiplayerMoveSyncRef.current = null;
      setActiveMultiplayerRefreshError(null);
      setActiveMultiplayerLastRefreshAt(new Date().toISOString());
      setActiveMultiplayerSession({
        gameId: session.gameId,
        cityEditionId: session.cityEditionId,
        status: session.status,
        rated: session.rated,
        yourSide: session.yourSide,
        currentTurn: session.currentTurn,
        syncedMoveCount: session.syncedMoveCount,
        timeControlKind: session.timeControlKind,
        baseSeconds: session.baseSeconds,
        incrementSeconds: session.incrementSeconds,
        moveDeadlineSeconds: session.moveDeadlineSeconds,
        deadlineAt: session.deadlineAt,
        whiteSecondsRemaining: session.whiteSecondsRemaining,
        blackSecondsRemaining: session.blackSecondsRemaining,
        turnStartedAt: session.turnStartedAt,
        result: session.result,
        whiteRatingDelta: session.whiteRatingDelta,
        blackRatingDelta: session.blackRatingDelta
      });
      setPage("match");
    } catch (error) {
      console.warn("[supabase] Could not load multiplayer game session.", error);
    }
  }, [loadSnapshot, playCityOptions]);

  const refreshLoadedActiveMultiplayerGame = useCallback(async (options?: { silent?: boolean }) => {
    if (!activeMultiplayerSession) {
      return;
    }

    if (!options?.silent) {
      setIsRefreshingActiveMultiplayerSession(true);
    }

    try {
      const session = await loadActiveGameSessionFromSupabase(activeMultiplayerSession.gameId);
      if (!session) {
        setActiveMultiplayerRefreshError("This multiplayer game is no longer available.");
        return;
      }

      if (session.syncedMoveCount > activeMultiplayerSession.syncedMoveCount) {
        loadSnapshot(session.snapshot);
        activeMultiplayerMoveSyncRef.current = null;
      }

      setActiveMultiplayerSession((current) =>
        current && current.gameId === session.gameId
          ? {
              ...current,
              status: session.status,
              currentTurn: session.currentTurn,
              syncedMoveCount: Math.max(current.syncedMoveCount, session.syncedMoveCount),
              deadlineAt: session.deadlineAt,
              whiteSecondsRemaining: session.whiteSecondsRemaining,
              blackSecondsRemaining: session.blackSecondsRemaining,
              turnStartedAt: session.turnStartedAt,
              result: session.result,
              whiteRatingDelta: session.whiteRatingDelta,
              blackRatingDelta: session.blackRatingDelta
            }
          : current
      );
      setActiveMultiplayerRefreshError(null);
      setActiveMultiplayerLastRefreshAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh multiplayer game.";
      setActiveMultiplayerRefreshError(message);
      console.warn("[supabase] Could not refresh multiplayer game session.", error);
    } finally {
      if (!options?.silent) {
        setIsRefreshingActiveMultiplayerSession(false);
      }
    }
  }, [activeMultiplayerSession, loadSnapshot]);

  const claimLoadedActiveMultiplayerTimeout = useCallback(async () => {
    if (!activeMultiplayerSession) {
      return;
    }

    setIsClaimingActiveMultiplayerTimeout(true);
    try {
      await claimGameTimeoutInSupabase(activeMultiplayerSession.gameId);
      setActiveMultiplayerRefreshError(null);
      await refreshLoadedActiveMultiplayerGame({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not claim the timeout.";
      setActiveMultiplayerRefreshError(message);
      console.warn("[supabase] Could not claim multiplayer timeout.", error);
    } finally {
      setIsClaimingActiveMultiplayerTimeout(false);
    }
  }, [activeMultiplayerSession, refreshLoadedActiveMultiplayerGame]);

  const resignLoadedActiveMultiplayerGame = useCallback(async () => {
    if (!activeMultiplayerSession) {
      return;
    }

    setIsResigningActiveMultiplayerGame(true);
    try {
      await resignGameInSupabase(activeMultiplayerSession.gameId);
      setActiveMultiplayerRefreshError(null);
      setIsResignDialogOpen(false);
      await refreshLoadedActiveMultiplayerGame({ silent: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not resign the game.";
      setActiveMultiplayerRefreshError(message);
      console.warn("[supabase] Could not resign multiplayer game.", error);
    } finally {
      setIsResigningActiveMultiplayerGame(false);
    }
  }, [activeMultiplayerSession, refreshLoadedActiveMultiplayerGame]);

  useEffect(() => {
    if (!activeMultiplayerSession || isSyncingActiveMultiplayerMove) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshLoadedActiveMultiplayerGame({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeMultiplayerSession, isSyncingActiveMultiplayerMove, refreshLoadedActiveMultiplayerGame]);

  useEffect(() => {
    if (!activeMultiplayerSession) {
      return;
    }

    const unsubscribe = subscribeToActiveGameMoveInserts(
      activeMultiplayerSession.gameId,
      () => {
        void refreshLoadedActiveMultiplayerGame({ silent: true });
      }
    );

    return unsubscribe;
  }, [activeMultiplayerSession, refreshLoadedActiveMultiplayerGame]);

  useEffect(() => {
    if (!activeMultiplayerSession) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeMultiplayerSession]);

  const motionPlayhead = useMovePlayhead({
    targetPly: selectedPly,
    totalPlies,
    resetKey: timelineKey
  });

  useEffect(() => {
    if (
      !activeMultiplayerSession ||
      isStudyMode ||
      isSyncingActiveMultiplayerMove ||
      snapshot.moveHistory.length <= activeMultiplayerSession.syncedMoveCount
    ) {
      return;
    }

    const latestMove = snapshot.moveHistory.at(-1);
    if (!latestMove || latestMove.side !== activeMultiplayerSession.yourSide) {
      return;
    }

    if (activeMultiplayerMoveSyncRef.current === latestMove.id) {
      return;
    }

    let cancelled = false;
    activeMultiplayerMoveSyncRef.current = latestMove.id;
    setIsSyncingActiveMultiplayerMove(true);

    void appendActiveGameMoveInSupabase({
      gameId: activeMultiplayerSession.gameId,
      move: latestMove,
      snapshot
    })
      .then((result) => {
        if (cancelled) {
          return;
        }

        setActiveMultiplayerSession((current) =>
          current && current.gameId === activeMultiplayerSession.gameId
            ? {
                ...current,
                status: result.status,
                currentTurn: result.currentTurn,
                deadlineAt: result.deadlineAt,
                turnStartedAt: result.status === "active" ? new Date().toISOString() : null,
                syncedMoveCount: result.nextPlyNumber,
                result: result.result,
                whiteRatingDelta: result.whiteRatingDelta,
                blackRatingDelta: result.blackRatingDelta
              }
            : current
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("[supabase] Could not sync multiplayer move.", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSyncingActiveMultiplayerMove(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeMultiplayerSession,
    isStudyMode,
    isSyncingActiveMultiplayerMove,
    snapshot
  ]);

  const animatedPieces = useMemo(
    () => getAnimatedPieceFrames({ snapshots: historySnapshots, playhead: motionPlayhead }),
    [historySnapshots, motionPlayhead]
  );

  const status = snapshot.status;
  const moveHistory = historyMoves;
  const hasPendingActiveMultiplayerMove =
    activeMultiplayerSession !== null &&
    snapshot.moveHistory.length > activeMultiplayerSession.syncedMoveCount;
  const eventByMoveId = new Map(historyEvents.map((event) => [event.moveId, event] as const));
  const selectedMove = selectedPly > 0 ? historyMoves[selectedPly - 1] ?? null : null;
  const selectedEvent = selectedMove ? eventByMoveId.get(selectedMove.id) ?? null : null;
  const storyFocusedSquare = hoveredSquare ?? selectedMove?.to ?? lastMove?.to ?? selectedSquare ?? null;
  const selectedSavedMatch = selectedSavedMatchId
    ? savedMatches.find((savedMatch) => savedMatch.id === selectedSavedMatchId) ?? null
    : null;
  const playDistrictsBySquare = useMemo(
    () => new Map<Square, CityBoard["districts"][number]>(
      playCityBoard.districts.map((district) => [district.square, district] as const)
    ),
    [playCityBoard.districts]
  );
  const getPlayDistrictForSquare = (square: Square | null) =>
    square ? playDistrictsBySquare.get(square) ?? null : null;
  const focusedDistrict = getPlayDistrictForSquare(storyFocusedSquare);
  const selectedDistrict = getPlayDistrictForSquare(selectedSquare);
  const lastMoveDistrict = lastMove ? getPlayDistrictForSquare(lastMove.to) : null;
  const focusedPiece = storyFocusedSquare ? getPieceAtSquare(snapshot, storyFocusedSquare) : null;
  const focusedCharacter = focusedPiece ? snapshot.characters[focusedPiece.pieceId] ?? null : null;
  const focusedCharacterMoments = focusedCharacter
    ? getCharacterEventHistory({
        events: snapshot.eventHistory,
        pieceId: focusedCharacter.pieceId,
        limit: 3
      })
    : [];
  const selectedReferenceGame =
    referenceGamesLibrary.find((game) => game.id === selectedReferenceGameId) ??
    referenceGamesLibrary[0] ??
    null;
  const hasActiveGame = isStudyMode || totalPlies > 0;
  const headerTurnValue =
    activeMultiplayerSession?.status === "active" && activeMultiplayerSession.currentTurn
      ? activeMultiplayerSession.currentTurn === activeMultiplayerSession.yourSide
        ? hasPendingActiveMultiplayerMove || isSyncingActiveMultiplayerMove
          ? "Syncing move"
          : "Your turn"
        : `${turnLabel(activeMultiplayerSession.currentTurn)} turn`
      : turnLabel(status.turn);
  const activeMultiplayerClockSeconds = (() => {
    if (!activeMultiplayerSession || activeMultiplayerSession.status !== "active") {
      return null;
    }

    if (activeMultiplayerSession.timeControlKind === "live_clock") {
      const currentTurn = activeMultiplayerSession.currentTurn;
      const storedSeconds =
        currentTurn === "white"
          ? activeMultiplayerSession.whiteSecondsRemaining
          : currentTurn === "black"
            ? activeMultiplayerSession.blackSecondsRemaining
            : null;
      if (storedSeconds === null) {
        return null;
      }

      const turnStartedAtMs = activeMultiplayerSession.turnStartedAt
        ? Date.parse(activeMultiplayerSession.turnStartedAt)
        : Number.NaN;
      const elapsedSeconds = Number.isFinite(turnStartedAtMs)
        ? Math.max(0, Math.floor((clockNow - turnStartedAtMs) / 1000))
        : 0;

      return Math.max(0, storedSeconds - elapsedSeconds);
    }

    if (!activeMultiplayerSession.deadlineAt) {
      return null;
    }

    const deadlineAtMs = Date.parse(activeMultiplayerSession.deadlineAt);
    if (!Number.isFinite(deadlineAtMs)) {
      return null;
    }

    return Math.max(0, Math.ceil((deadlineAtMs - clockNow) / 1000));
  })();
  const multiplayerTimeValue = activeMultiplayerSession
    ? activeMultiplayerClockSeconds !== null
      ? formatClockSeconds(activeMultiplayerClockSeconds)
      : formatTimeControlLabel({
          timeControlKind: activeMultiplayerSession.timeControlKind,
          baseSeconds: activeMultiplayerSession.baseSeconds,
          incrementSeconds: activeMultiplayerSession.incrementSeconds,
          moveDeadlineSeconds: activeMultiplayerSession.moveDeadlineSeconds
        })
    : null;
  const activeMultiplayerDeadlineMs = activeMultiplayerSession?.deadlineAt
    ? Date.parse(activeMultiplayerSession.deadlineAt)
    : null;
  const activeMultiplayerDeadlineElapsed =
    activeMultiplayerDeadlineMs !== null &&
    Number.isFinite(activeMultiplayerDeadlineMs) &&
    activeMultiplayerDeadlineMs <= clockNow;
  const activeMultiplayerCanClaimTimeout = Boolean(
    activeMultiplayerSession &&
      activeMultiplayerSession.status === "active" &&
      activeMultiplayerDeadlineElapsed &&
      activeMultiplayerSession.currentTurn &&
      activeMultiplayerSession.currentTurn !== activeMultiplayerSession.yourSide &&
      (activeMultiplayerSession.yourSide === "white" || activeMultiplayerSession.yourSide === "black")
  );
  const activeMultiplayerOwnClockExpired = Boolean(
    activeMultiplayerSession &&
      activeMultiplayerSession.status === "active" &&
      activeMultiplayerDeadlineElapsed &&
      activeMultiplayerSession.currentTurn === activeMultiplayerSession.yourSide
  );
  const activeMultiplayerCanResign = Boolean(
    activeMultiplayerSession &&
      activeMultiplayerSession.status === "active" &&
      (activeMultiplayerSession.yourSide === "white" || activeMultiplayerSession.yourSide === "black")
  );
  const multiplayerStatusValue = activeMultiplayerSession
    ? activeMultiplayerSession.status === "completed"
      ? multiplayerResultLabel(activeMultiplayerSession.result)
      : activeMultiplayerSession.status === "active"
        ? hasPendingActiveMultiplayerMove || isSyncingActiveMultiplayerMove
          ? "Syncing"
          : activeMultiplayerCanClaimTimeout
            ? "Opponent timed out"
            : activeMultiplayerOwnClockExpired
              ? "Clock expired"
              : activeMultiplayerSession.currentTurn === activeMultiplayerSession.yourSide
                ? "Your turn"
                : "Waiting"
        : activeMultiplayerSession.status === "invited"
          ? "Invite pending"
          : activeMultiplayerSession.status
    : null;
  const multiplayerEloDelta =
    activeMultiplayerSession?.yourSide === "white"
      ? activeMultiplayerSession.whiteRatingDelta
      : activeMultiplayerSession?.yourSide === "black"
        ? activeMultiplayerSession.blackRatingDelta
        : null;
  const multiplayerEloValue =
    activeMultiplayerSession?.rated && activeMultiplayerSession.status === "completed"
      ? multiplayerEloDelta === null
        ? "Pending"
        : `${multiplayerEloDelta >= 0 ? "+" : ""}${multiplayerEloDelta}`
      : null;
  const multiplayerRefreshValue = activeMultiplayerRefreshError
    ? "Refresh failed"
    : isRefreshingActiveMultiplayerSession
      ? "Refreshing"
      : activeMultiplayerLastRefreshAt
        ? new Date(activeMultiplayerLastRefreshAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            second: "2-digit"
          })
        : "Not synced";

  useEffect(() => {
    if (!isHistoryPlaying) {
      return;
    }

    if (page !== "match" || totalPlies <= 0 || selectedPly >= totalPlies) {
      setIsHistoryPlaying(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      goToPly(selectedPly + 1);
    }, historyPlaybackDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [goToPly, isHistoryPlaying, page, selectedPly, totalPlies]);

  useEffect(() => {
    setIsHistoryPlaying(false);
  }, [timelineKey]);

  const handleToggleHistoryPlayback = useCallback(() => {
    if (isHistoryPlaying) {
      setIsHistoryPlaying(false);
      return;
    }

    if (totalPlies <= 0) {
      return;
    }

    if (selectedPly >= totalPlies) {
      goToPly(0);
    }

    setIsHistoryPlaying(true);
  }, [goToPly, isHistoryPlaying, selectedPly, totalPlies]);

  const handleHistoryJumpToStart = useCallback(() => {
    setIsHistoryPlaying(false);
    jumpToStart();
  }, [jumpToStart]);

  const handleHistoryStepBackward = useCallback(() => {
    setIsHistoryPlaying(false);
    stepBackward();
  }, [stepBackward]);

  const handleHistoryStepForward = useCallback(() => {
    setIsHistoryPlaying(false);
    stepForward();
  }, [stepForward]);

  const handleHistoryJumpToEnd = useCallback(() => {
    setIsHistoryPlaying(false);
    jumpToEnd();
  }, [jumpToEnd]);

  const handleHistorySelectPly = useCallback((nextPly: number) => {
    setIsHistoryPlaying(false);
    goToPly(nextPly);
  }, [goToPly]);

  const maybeBootstrapAdmin = useCallback(async () => {
    try {
      const nextRole = await bootstrapFirstAdmin();
      if (nextRole === "admin") {
        setSessionRole("admin");
        return true;
      }
    } catch (error) {
      console.warn("[supabase] First-admin bootstrap failed.", error);
    }

    return false;
  }, []);

  const handleSignInWithPassword = useCallback(async (email: string, password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await signInWithPassword({ email, password });
      if (result.error) {
        throw result.error;
      }
      const didBootstrapAdmin = await maybeBootstrapAdmin();
      return didBootstrapAdmin ? "Signed in. First admin claimed." : "Signed in.";
    } catch (error) {
      console.warn("[supabase] Email/password sign-in failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, [maybeBootstrapAdmin]);

  const handleSignUpWithPassword = useCallback(async (email: string, password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await signUpWithPassword({ email, password });
      if (result.error) {
        throw result.error;
      }

      if (result.data.session) {
        const didBootstrapAdmin = await maybeBootstrapAdmin();
        return didBootstrapAdmin
          ? "Account created. First admin claimed."
          : "Account created and signed in.";
      }

      return "Account created. If email confirmation is enabled, confirm first, then sign in.";
    } catch (error) {
      console.warn("[supabase] Email/password sign-up failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, [maybeBootstrapAdmin]);

  const handleSendPasswordResetEmail = useCallback(async (email: string) => {
    setIsAuthBusy(true);
    try {
      const result = await sendPasswordResetEmail(email);
      if (result.error) {
        throw result.error;
      }
      return "Password reset email sent.";
    } catch (error) {
      console.warn("[supabase] Password reset email failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleUpdatePassword = useCallback(async (password: string) => {
    setIsAuthBusy(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        throw result.error;
      }
      return "Password updated.";
    } catch (error) {
      console.warn("[supabase] Password update failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOut();
      setSessionRole("player");
      setSessionProfile(null);
      setViewAsRole("player");
      return "Signed out.";
    } catch (error) {
      console.warn("[supabase] Sign-out failed.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const handleSaveProfile = useCallback(async (username: string, displayName: string) => {
    setIsAuthBusy(true);
    try {
      const profile = await saveCurrentUserProfile({ username, displayName });
      setSessionProfile(profile);
      return profile.username
        ? `Profile saved as @${profile.username}.`
        : "Profile saved.";
    } catch (error) {
      console.warn("[supabase] Could not save profile.", error);
      throw error;
    } finally {
      setIsAuthBusy(false);
    }
  }, []);

  const effectiveLayoutMode = isLayoutMode && !isCompactViewport;
  const layoutNavigation = useMemo<LayoutNavigation>(
    () => ({
      pages: visiblePageOptions,
      activePage: page,
      onPageChange: (nextPage: string) => {
        if (isAppPage(nextPage)) setPage(nextPage);
      }
    }),
    [page, visiblePageOptions]
  );
  const playMapCityMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={playCityMenuTriggerRef}
          type="button"
          variant="ghost"
          size="sm"
          className="panel__title-trigger max-w-full"
        >
          <span className="panel__title-trigger-label">
            {selectedPlayCityOption?.displayLabel ?? playCityBoard.name}
          </span>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-muted-foreground" aria-label={playCitySourceLabel}>
                  {playCitySource === "fallback" ? <FileJson className="size-4" /> : <Cloud className="size-4" />}
                </span>
              </TooltipTrigger>
              <TooltipContent>{playCitySource === "fallback" ? "local" : "remote"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        style={{
          width: `${Math.max(220, Math.min(playCityMenuMaxWidth, 360))}px`,
          maxWidth: `${playCityMenuMaxWidth}px`
        }}
      >
        <DropdownMenuLabel>Playable settings</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedPlayCityOption?.id ?? playCityOptionId}
          onValueChange={(nextOptionId) => {
            const nextOption = playCityOptions.find((option) => option.id === nextOptionId);
            if (!nextOption) {
              return;
            }

            setPlayCityOptionId(nextOption.id);
          }}
        >
          {playCityOptions.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              {option.displayLabel}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {canAccessDraftCities ? (
          <>
            <DropdownMenuLabel inset>Preview mode</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={effectivePlayCityPreviewMode}
              onValueChange={(nextMode) => {
                if (nextMode === "draft" && !canPreviewDraftPlayCity) {
                  return;
                }

                setPlayCityPreviewMode(nextMode === "draft" ? "draft" : "published");
              }}
            >
              <DropdownMenuRadioItem value="published">Published</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="draft" disabled={!canPreviewDraftPlayCity}>
                Draft preview
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
  const playHeaderDistrict = hoveredSquare ? focusedDistrict : selectedDistrict;
  const renderPlayModeBadge = () => (
    <Badge variant={effectivePlayCityPreviewMode === "draft" ? "secondary" : "outline"}>
      {effectivePlayCityPreviewMode === "draft" ? "Draft preview" : "Published"}
    </Badge>
  );
  const renderPlayHeaderDistrictBadge = () => (
    <DistrictBadge
      name={playHeaderDistrict?.name ?? null}
      square={playHeaderDistrict?.square ?? null}
      className="district-badge--header"
    />
  );
  const renderPlayHeaderActions = () => (
    <div className="flex items-center gap-2">
      {renderPlayModeBadge()}
      {renderPlayHeaderDistrictBadge()}
    </div>
  );
  useEffect(() => {
    if (
      selectedReferenceGameId &&
      referenceGamesLibrary.some((game) => game.id === selectedReferenceGameId)
    ) {
      return;
    }

    const nextReferenceGameId = referenceGamesLibrary[0]?.id ?? "";
    if (nextReferenceGameId !== selectedReferenceGameId) {
      setSelectedReferenceGameId(nextReferenceGameId);
    }
  }, [referenceGamesLibrary, selectedReferenceGameId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1080px)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactViewport(event.matches);
    };

    setIsCompactViewport(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (isCompactViewport) {
      setIsLayoutMode(false);
    }
  }, [isCompactViewport]);

  useEffect(() => {
    applyAppTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    applyHighlightColor(settings.highlightColor, settings.customHighlightColor);
  }, [settings.customHighlightColor, settings.highlightColor]);

  useEffect(() => {
    applyPieceStyleSheet(pieceStyleSheet);
  }, [pieceStyleSheet]);

  useEffect(() => {
    saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveWorkspaceLayoutState(workspaceLayout);
  }, [workspaceLayout]);

  useEffect(() => {
    if (selectedSavedMatchId && !savedMatches.some((savedMatch) => savedMatch.id === selectedSavedMatchId)) {
      setSelectedSavedMatchId(null);
    }
  }, [savedMatches, selectedSavedMatchId]);

  useEffect(() => {
    setIsPieceStyleDirectorySupported(supportsWorkspaceLayoutDirectory());

    const rememberedLayoutFiles = listKnownWorkspaceLayoutFiles();
    if (rememberedLayoutFiles.length) {
      setKnownLayoutFiles(rememberedLayoutFiles);
      setLayoutFileName((current) => current || rememberedLayoutFiles[0]?.name || "match-workspace");
    }

    let cancelled = false;

    setIsRoleCatalogDirectorySupported(supportsRoleCatalogDirectory());

    void getConnectedRoleCatalogDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setRoleCatalogDirectoryName(directoryName);
      }
    });

    void getConnectedWorkspaceLayoutDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setLayoutDirectoryName(directoryName);
      }
    });

    void getConnectedPieceStylesDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setPieceStyleDirectoryName(directoryName);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextUrl = new URL(window.location.href);
    if (page === "match") {
      nextUrl.searchParams.delete("page");
    } else {
      nextUrl.searchParams.set("page", page);
    }

    window.history.replaceState({}, "", nextUrl);
  }, [page]);

  useEffect(() => {
    if (hoveredSquare) {
      setInspectedSquare(hoveredSquare);
    }
  }, [hoveredSquare]);

  useEffect(() => {
    if (selectedSquare) {
      setInspectedSquare(selectedSquare);
    }
  }, [selectedSquare]);

  useEffect(() => {
    if (lastMove?.to) {
      setInspectedSquare(lastMove.to);
    }
  }, [lastMove?.to]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle view mode with 'M' key (case-insensitive)
      if ((event.key === 'M' || event.key === 'm') && !event.ctrlKey && !event.metaKey && !event.altKey) {
        // Check if focus is not in an input field
        const activeElement = document.activeElement;
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return;
        }
        
        event.preventDefault();
        const nextViewMode = settings.defaultViewMode === 'board' ? 'map' : 'board';
        handleDefaultViewModeChange(nextViewMode);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [settings.defaultViewMode]);

  const loadChosenReferenceGame = (referenceGameId?: string) => {
    const nextReferenceGame =
      (referenceGameId
        ? referenceGamesLibrary.find((game) => game.id === referenceGameId)
        : null) ?? selectedReferenceGame;

    if (!nextReferenceGame) {
      return;
    }

    loadReferenceGame(nextReferenceGame);
  };

  const handleLoadReferenceGame = () => {
    clearActiveMultiplayerSession();
    loadChosenReferenceGame();
  };

  const handleLoadReferenceGameFromLibrary = (referenceGameId: string) => {
    clearActiveMultiplayerSession();
    loadChosenReferenceGame(referenceGameId);
    setPage("match");
  };

  const handleRoleCatalogChange = (
    roleId: string,
    field:
      | "pieceKind"
      | "name"
      | "summary"
      | "traits"
      | "verbs"
      | "notes"
      | "contentStatus"
      | "reviewStatus"
      | "reviewNotes"
      | "lastReviewedAt",
    value:
      | PieceKind
      | string
      | string[]
      | null
      | "empty"
      | "procedural"
      | "authored"
      | "needs review"
      | "reviewed"
      | "approved"
  ) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        updateRoleCatalogEntry({
          roleCatalog: current,
          roleId,
          field,
          value
        })
      )
    );
  };

  const handleRoleCatalogAdd = (pieceKind?: PieceKind) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        addRoleCatalogEntry({
          roleCatalog: current,
          pieceKind
        })
      )
    );
  };

  const handleRoleCatalogDuplicate = (roleId: string) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        duplicateRoleCatalogEntry({
          roleCatalog: current,
          roleId
        })
      )
    );
  };

  const handleRoleCatalogRemove = (roleId: string) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        removeRoleCatalogEntry({
          roleCatalog: current,
          roleId
        })
      )
    );
  };

  const handleRoleCatalogReset = () => {
    setRoleCatalog(resetRoleCatalog());
  };

  const runRoleCatalogFileAction = async (actionName: string, action: () => Promise<void>) => {
    setRoleCatalogFileBusyAction(actionName);
    setRoleCatalogFileNotice(null);

    try {
      await action();
    } catch (error) {
      setRoleCatalogFileNotice({
        tone: "error",
        text: error instanceof Error
          ? error.message
          : "Something went wrong while working with the role catalog file."
      });
    } finally {
      setRoleCatalogFileBusyAction(null);
    }
  };

  const handleConnectRoleCatalogDirectory = () => {
    void runRoleCatalogFileAction("connect-role-catalog-directory", async () => {
      const result = await connectRoleCatalogDirectory();
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Connected role catalog files to ${result.directoryName}.`
      });
    });
  };

  const handleSaveRoleCatalogFile = () => {
    void runRoleCatalogFileAction("save-role-catalog-file", async () => {
      const result = await saveRoleCatalogDraftToDirectory(roleCatalog);
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Saved role catalog to ${result.displayPath}.`
      });
    });
  };

  const handleLoadRoleCatalogFile = () => {
    void runRoleCatalogFileAction("load-role-catalog-file", async () => {
      const result = await loadRoleCatalogFromDirectory();
      if (!result) {
        setRoleCatalogFileNotice({
          tone: "neutral",
          text: "No role catalog file matched that name in the connected folder."
        });
        return;
      }

      setRoleCatalog(saveRoleCatalog(result.roleCatalog));
      setRoleCatalogDirectoryName(result.directoryName);
      setRoleCatalogFileNotice({
        tone: "success",
        text: `Loaded role catalog from ${result.relativePath}.`
      });
    });
  };

  const handleThemeChange = (theme: AppSettings["theme"]) => {
    setSettings((current) => ({
      ...current,
      theme
    }));
  };

  const handleDefaultViewModeChange = (nextViewMode: "board" | "map") => {
    setSettings((current) => ({
      ...current,
      defaultViewMode: nextViewMode
    }));
  };

  const handleBooleanSettingChange = (
    key:
      | "showBoardCoordinates"
      | "showDistrictLabels"
      | "showRecentCharacterActions"
      | "showLayoutGrid",
    value: boolean
  ) => {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  };

  const runPieceStyleFileAction = async (actionName: string, action: () => Promise<void>) => {
    setPieceStyleFileBusyAction(actionName);
    setPieceStyleFileNotice(null);

    try {
      await action();
    } catch (error) {
      setPieceStyleFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong while working with the piece style file."
      });
    } finally {
      setPieceStyleFileBusyAction(null);
    }
  };

  const handleConnectPieceStyleDirectory = () => {
    void runPieceStyleFileAction("connect-piece-style-directory", async () => {
      const result = await connectPieceStylesDirectory();
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Connected piece styles to ${result.directoryName}.`
      });
    });
  };

  const handleSavePieceStyleSheetToDirectory = () => {
    void runPieceStyleFileAction("save-piece-style-file", async () => {
      const result = await savePieceStylesDraftToDirectory(pieceStyleSheet);
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Saved piece styles to ${result.relativePath}.`
      });
    });
  };

  const handleLoadPieceStyleSheetFromDirectory = () => {
    void runPieceStyleFileAction("load-piece-style-file", async () => {
      const result = await loadPieceStylesFromDirectory();
      if (!result) {
        setPieceStyleFileNotice({
          tone: "neutral",
          text: "No saved piece-styles.local.css file was found in the connected folder."
        });
        return;
      }

      const nextSheet = savePieceStyleSheet(result.cssText);
      setPieceStyleSheet(nextSheet);
      setPieceStyleDirectoryName(result.directoryName);
      setPieceStyleFileNotice({
        tone: "success",
        text: `Loaded ${result.relativePath} into the live app stylesheet.`
      });
    });
  };

  const handleResetPieceStyleSheet = () => {
    const nextSheet = resetPieceStyleSheet();
    setPieceStyleSheet(nextSheet);
    setPieceStyleFileNotice({
      tone: "neutral",
      text: "Reset the piece stylesheet back to the bundled defaults."
    });
  };

  const handlePieceStyleSheetChange = (value: string) => {
    setPieceStyleSheet(savePieceStyleSheet(value));
  };

  const handleResetEverything = () => {
    if (isSavingEverything || isLoadingEverything || isResettingEverything) {
      return;
    }

    setIsResettingEverything(true);

    try {
      // Restore workspace layout from the committed/bundled default
      const bundledWorkspace = getBundledWorkspaceLayout("match-workspace");
      if (bundledWorkspace) {
        saveWorkspaceLayoutState(bundledWorkspace.layoutState);
        setWorkspaceLayout(bundledWorkspace.layoutState);
      }

      // Restore each page layout from its committed/bundled default
      for (const target of pageLayoutSaveTargets) {
        const bundledLayout = getBundledPageLayout({
          layoutKey: target.layoutKey,
          layoutVariant: target.layoutVariant,
          panelIds: target.panelIds
        });
        if (bundledLayout) {
          savePageLayoutState({
            layoutKey: target.layoutKey,
            layoutState: bundledLayout.layoutState,
            variant: target.layoutVariant,
            panelIds: target.panelIds
          });
        }
      }

      // Reload so all IndexedWorkspace components re-initialize from the restored state
      window.location.reload();
    } finally {
      setIsResettingEverything(false);
    }
  };

  const handleSaveEverything = () => {
    if (isSavingEverything || isLoadingEverything) {
      return;
    }

    void (async () => {
      setIsSavingEverything(true);
      setSaveEverythingNotice(null);

      const savedItems: string[] = [];
      const failedItems: string[] = [];
      const recordSave = async (label: string, action: () => Promise<void>) => {
        try {
          await action();
          savedItems.push(label);
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          failedItems.push(`${label}: ${message}`);
        }
      };

      try {
        saveAppSettings(settings);
        saveWorkspaceLayoutState(workspaceLayout);
        saveRoleCatalog(roleCatalog);
        savePieceStyleSheet(pieceStyleSheet);
        saveReferenceGames(referenceGamesLibrary);
        cityBoardDefinitions.forEach((definition) => {
          saveCityBoardDraft(listCityBoardDraft(definition.id, definition.board));
        });
        savedItems.push("browser state");

        await recordSave("Play layout", async () => {
          const result = await saveWorkspaceLayoutFileToDirectory({
            name: layoutFileName,
            layoutState: workspaceLayout
          });
          setKnownLayoutFiles(result.knownFiles);
          setLayoutDirectoryName(result.directoryName);
          setLayoutFileName(result.layoutName);
        });

        for (const target of pageLayoutSaveTargets) {
          await recordSave(`${target.name} layout`, async () => {
            const layoutState = listPageLayoutState({
              layoutKey: target.layoutKey,
              variant: target.layoutVariant,
              panelIds: target.panelIds
            });
            savePageLayoutState({
              layoutKey: target.layoutKey,
              layoutState,
              variant: target.layoutVariant,
              panelIds: target.panelIds
            });
            await savePageLayoutFileToDirectory({
              layoutKey: target.layoutKey,
              layoutVariant: target.layoutVariant,
              panelIds: target.panelIds,
              name: target.name,
              layoutState
            });
          });
        }

        for (const definition of cityBoardDefinitions) {
          await recordSave(`${definition.displayLabel} city data`, async () => {
            const board = listCityBoardDraft(definition.id, definition.board);
            const result = await saveCityDraftToDirectory(board);
            saveCityBoardDraft(board);
            setSaveEverythingNotice({
              tone: "neutral",
              text: `Saving ${result.relativePath}...`
            });
          });
        }

        await recordSave("Historic games", async () => {
          await saveClassicGamesDraftToDirectory(referenceGamesLibrary);
        });

        await recordSave("Character roles", async () => {
          const result = await saveRoleCatalogDraftToDirectory(roleCatalog);
          setRoleCatalogDirectoryName(result.directoryName);
        });

        await recordSave("Piece styles", async () => {
          const result = await savePieceStylesDraftToDirectory(pieceStyleSheet);
          setPieceStyleDirectoryName(result.directoryName);
        });

        setSaveEverythingNotice({
          tone: failedItems.length ? "error" : "success",
          text: failedItems.length
            ? `Saved ${savedItems.length} item(s). ${failedItems.length} item(s) need a connected folder: ${failedItems.join(" | ")}`
            : `Saved everything: ${savedItems.join(", ")}.`
        });
      } finally {
        setIsSavingEverything(false);
      }
    })();
  };

  const handleLoadEverything = () => {
    if (isSavingEverything || isLoadingEverything) {
      return;
    }

    void (async () => {
      setIsLoadingEverything(true);
      setSaveEverythingNotice(null);

      const loadedItems: string[] = [];
      const skippedItems: string[] = [];
      const failedItems: string[] = [];
      const recordLoad = async (
        label: string,
        action: () => Promise<boolean>
      ) => {
        try {
          const didLoad = await action();
          if (didLoad) {
            loadedItems.push(label);
          } else {
            skippedItems.push(label);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown error";
          failedItems.push(`${label}: ${message}`);
        }
      };

      try {
        const nextWorkspaceLayout = listWorkspaceLayoutState();
        const nextRoleCatalog = listRoleCatalog();
        const nextReferenceGames = listReferenceGames();

        setWorkspaceLayout(nextWorkspaceLayout);
        setKnownLayoutFiles(listKnownWorkspaceLayoutFiles());
        setRoleCatalog(nextRoleCatalog);
        setReferenceGamesLibrary(nextReferenceGames);
        setSelectedReferenceGameId((currentId) =>
          nextReferenceGames.some((game) => game.id === currentId)
            ? currentId
            : nextReferenceGames[0]?.id ?? ""
        );

        cityBoardDefinitions.forEach((definition) => {
          const board = listCityBoardDraft(definition.id, definition.board);
          saveCityBoardDraft(board);
          if (definition.id === edinburghBoard.id) {
            setPlayCityBoard(board);
          }
        });

        loadedItems.push("browser state");

        await recordLoad("Play layout", async () => {
          const result = await loadWorkspaceLayoutFileFromDirectory(layoutFileName);
          if (!result) {
            return false;
          }

          saveWorkspaceLayoutState(result.layoutState);
          setWorkspaceLayout(result.layoutState);
          setKnownLayoutFiles(result.knownFiles);
          setLayoutDirectoryName(result.directoryName);
          setLayoutFileName(result.layoutName);
          return true;
        });

        for (const definition of cityBoardDefinitions) {
          await recordLoad(`${definition.displayLabel} city data`, async () => {
            const result = await loadCityDraftFromDirectory(definition.board);
            if (!result) {
              return false;
            }

            const nextBoard = saveCityBoardDraft(result.board);
            if (definition.id === edinburghBoard.id) {
              setPlayCityBoard(nextBoard);
            }
            return true;
          });
        }

        await recordLoad("Historic games", async () => {
          const result = await loadClassicGamesFromDirectory();
          if (!result) {
            return false;
          }

          const nextGames = saveReferenceGames(result.games);
          setReferenceGamesLibrary(nextGames);
          setSelectedReferenceGameId((currentId) =>
            nextGames.some((game) => game.id === currentId)
              ? currentId
              : nextGames[0]?.id ?? ""
          );
          return true;
        });

        await recordLoad("Character roles", async () => {
          const result = await loadRoleCatalogFromDirectory();
          if (!result) {
            return false;
          }

          const nextCatalog = saveRoleCatalog(result.roleCatalog);
          setRoleCatalog(nextCatalog);
          setRoleCatalogDirectoryName(result.directoryName);
          return true;
        });

        setSaveEverythingNotice({
          tone: failedItems.length ? "error" : "success",
          text: failedItems.length
            ? `Loaded ${loadedItems.length} item(s). ${failedItems.length} failed: ${failedItems.join(" | ")}`
            : skippedItems.length
              ? `Loaded ${loadedItems.join(", ")}. Skipped: ${skippedItems.join(", ")}.`
              : `Loaded ${loadedItems.join(", ")}.`
        });
      } finally {
        setIsLoadingEverything(false);
      }
    })();
  };

  const handleLoadSelectedSavedMatch = () => {
    if (!selectedSavedMatch) {
      return;
    }

    clearActiveMultiplayerSession();
    loadSavedMatch(selectedSavedMatch.id);
  };

  const handleRemoveSelectedSavedMatch = () => {
    if (!selectedSavedMatch) {
      return;
    }

    removeSavedMatch(selectedSavedMatch.id);
    setSelectedSavedMatchId(null);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__main">
          <div className="app-header__title-row">
            <div>
              <h1>Narrative Chess</h1>
            </div>
          </div>

          <TooltipProvider>
            <Tabs
              value={page}
              onValueChange={(nextPage) => {
                if (isAppPage(nextPage)) {
                  setPage(nextPage);
                }
              }}
              className="page-switcher-tabs"
            >
              <TabsList aria-label="Workspace sections">
                {visiblePageOptions.map(({ value, label, icon }) => (
                  <TabsTrigger key={value} value={value}>
                    {icon && <span className="mr-1.5">{icon}</span>}
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </TooltipProvider>
        </div>

        <div className="app-header__aside">
          <div className="app-header__actions">
            <UserMenu
              isOpen={isUserMenuOpen}
              onOpenChange={(open) => {
                setIsUserMenuOpen(open);
                if (open) {
                  setIsMenuOpen(false);
                }
              }}
              accountEmail={sessionEmail}
              accountRole={sessionRole}
              accountUsername={sessionProfile?.username ?? null}
              accountDisplayName={sessionProfile?.displayName ?? null}
              accountEloRating={sessionProfile?.eloRating ?? null}
              viewAsRole={viewAsRole}
              onViewAsRoleChange={setViewAsRole}
              isAuthBusy={isAuthBusy}
              onSignInWithPassword={handleSignInWithPassword}
              onSignUpWithPassword={handleSignUpWithPassword}
              onSendPasswordResetEmail={handleSendPasswordResetEmail}
              onUpdatePassword={handleUpdatePassword}
              onSignOut={handleSignOut}
              onSaveProfile={handleSaveProfile}
            />
            <AppMenu
              isOpen={isMenuOpen}
              onOpenChange={(open) => {
                setIsMenuOpen(open);
                if (open) {
                  setIsUserMenuOpen(false);
                }
              }}
              isLayoutModeActive={effectiveLayoutMode}
              isLayoutModeDisabled={isCompactViewport}
              onToggleLayoutMode={() => setIsLayoutMode((current) => !current)}
              theme={settings.theme}
              onThemeChange={handleThemeChange}
              onResetEverything={handleResetEverything}
              onSaveEverything={handleSaveEverything}
              onLoadEverything={handleLoadEverything}
              isResettingEverything={isResettingEverything}
              isSavingEverything={isSavingEverything}
              isLoadingEverything={isLoadingEverything}
              saveEverythingNotice={saveEverythingNotice}
              onDismissSaveEverythingNotice={() => setSaveEverythingNotice(null)}
              highlightColor={settings.highlightColor}
              onHighlightColorChange={(color: HighlightColor) =>
                setSettings((s) => ({ ...s, highlightColor: color }))
              }
              customHighlightColor={settings.customHighlightColor}
              onCustomHighlightColorChange={(color: string) =>
                setSettings((s) => ({ ...s, customHighlightColor: color }))
              }
              playCitySourceLabel={playCitySourceLabel}
              playCityPreviewModeLabel={
                effectivePlayCityPreviewMode === "draft" ? "Draft preview" : "Published"
              }
              playCityEditionLabel={playCityPublishedEditionId}
              isPlayCityFallbackMatchKnown={playCityMatchesFallback !== null}
            />
          </div>

          <div className="app-header__status">
            {page === "match" || hasActiveGame ? (
              <div
                className={
                  activeMultiplayerSession || multiplayerEloValue
                    ? "app-header__status-grid app-header__status-grid--extended"
                    : "app-header__status-grid"
                }
              >
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Turn</span>
                  <strong className="app-header__status-value">{headerTurnValue}</strong>
                </div>
                <div
                  className={[
                    "app-header__status-card",
                    statusCardStateClassName(status.isCheck, status.isCheckmate)
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="app-header__status-label">State</span>
                  <strong className="app-header__status-value">
                    {statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}
                  </strong>
                </div>
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Moves</span>
                  <strong className="app-header__status-value">
                    {totalPlies}
                  </strong>
                </div>
                {activeMultiplayerSession ? (
                  <div className="app-header__status-card">
                    <span className="app-header__status-label">Online</span>
                    <strong className="app-header__status-value">{multiplayerStatusValue}</strong>
                  </div>
                ) : null}
                {activeMultiplayerSession && multiplayerTimeValue ? (
                  <div className="app-header__status-card">
                    <span className="app-header__status-label">
                      {activeMultiplayerSession.timeControlKind === "live_clock" ? "Clock" : "Due"}
                    </span>
                    <strong className="app-header__status-value">{multiplayerTimeValue}</strong>
                  </div>
                ) : null}
                {activeMultiplayerSession ? (
                  <div
                    className={[
                      "app-header__status-card",
                      activeMultiplayerRefreshError ? "app-header__status-card--warning" : ""
                    ].filter(Boolean).join(" ")}
                  >
                    <span className="app-header__status-label">Cloud sync</span>
                    <strong className="app-header__status-value app-header__status-value--inline">
                      {multiplayerRefreshValue}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void refreshLoadedActiveMultiplayerGame()}
                        disabled={isRefreshingActiveMultiplayerSession}
                        aria-label="Refresh multiplayer game"
                        title={activeMultiplayerRefreshError ?? "Refresh multiplayer game"}
                      >
                        <RefreshCcw />
                      </Button>
                      {activeMultiplayerCanClaimTimeout ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-sm"
                          onClick={() => void claimLoadedActiveMultiplayerTimeout()}
                          disabled={isClaimingActiveMultiplayerTimeout}
                          aria-label="Claim opponent timeout"
                          title={
                            isClaimingActiveMultiplayerTimeout
                              ? "Claiming opponent timeout"
                              : "Claim opponent timeout"
                          }
                        >
                          <Flag />
                        </Button>
                      ) : null}
                      {activeMultiplayerCanResign ? (
                        <AlertDialog open={isResignDialogOpen} onOpenChange={setIsResignDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Resign multiplayer game"
                              title="Resign multiplayer game"
                            >
                              <Handshake />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Resign this game?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your opponent wins immediately. Rated games apply the usual Elo change. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={isResigningActiveMultiplayerGame}>
                                Keep playing
                              </AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={isResigningActiveMultiplayerGame}
                                onClick={(event) => {
                                  event.preventDefault();
                                  void resignLoadedActiveMultiplayerGame();
                                }}
                              >
                                {isResigningActiveMultiplayerGame ? "Resigning..." : "Resign"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : null}
                    </strong>
                  </div>
                ) : null}
                {multiplayerEloValue ? (
                  <div className="app-header__status-card">
                    <span className="app-header__status-label">Elo</span>
                    <strong className="app-header__status-value">{multiplayerEloValue}</strong>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <Suspense fallback={<div className="page-loading" role="status">Loading section...</div>}>
        {page === "cities" ? (
          <CityReviewPage
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            canEditCities={canAccessDraftCities}
            canManageRemoteDrafts={canAccessDraftCities}
            canPublishRemoteCities={canPublishCities}
            onCityBoardDraftChange={handleCityBoardDraftChange}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
          />
        ) : page === "classics" ? (
          <ClassicGamesLibraryPage
            referenceGames={referenceGamesLibrary}
            selectedReferenceGameId={selectedReferenceGameId}
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            onSelectReferenceGame={setSelectedReferenceGameId}
            onLoadReferenceGame={(game) => handleLoadReferenceGameFromLibrary(game.id)}
            onReferenceGamesChange={setReferenceGamesLibrary}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
          />
        ) : page === "roles" ? (
          <RoleCatalogPage
            roleCatalog={roleCatalog}
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            roleCatalogDirectoryName={roleCatalogDirectoryName}
            isRoleCatalogDirectorySupported={isRoleCatalogDirectorySupported}
            roleCatalogFileBusyAction={roleCatalogFileBusyAction}
            roleCatalogFileNotice={roleCatalogFileNotice}
            onRoleCatalogChange={handleRoleCatalogChange}
            onRoleCatalogReset={handleRoleCatalogReset}
            onRoleCatalogAdd={handleRoleCatalogAdd}
            onRoleCatalogDuplicate={handleRoleCatalogDuplicate}
            onRoleCatalogRemove={handleRoleCatalogRemove}
            onConnectRoleCatalogDirectory={handleConnectRoleCatalogDirectory}
            onLoadRoleCatalogFromDirectory={handleLoadRoleCatalogFile}
            onSaveRoleCatalogToDirectory={handleSaveRoleCatalogFile}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
          />
        ) : page === "design" ? (
          <DesignPage
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            pieceStyleSheet={pieceStyleSheet}
            pieceStyleDirectoryName={pieceStyleDirectoryName}
            isPieceStyleDirectorySupported={isPieceStyleDirectorySupported}
            pieceStyleFileBusyAction={pieceStyleFileBusyAction}
            pieceStyleFileNotice={pieceStyleFileNotice}
            onPieceStyleSheetChange={handlePieceStyleSheetChange}
            onConnectPieceStyleDirectory={handleConnectPieceStyleDirectory}
            onLoadPieceStyleSheetFromDirectory={handleLoadPieceStyleSheetFromDirectory}
            onSavePieceStyleSheetToDirectory={handleSavePieceStyleSheetToDirectory}
            onResetPieceStyleSheet={handleResetPieceStyleSheet}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
          />
        ) : page === "research" ? (
          <ResearchPage
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
          />
        ) : (
          <MatchWorkspacePage
            layoutMode={effectiveLayoutMode}
            showLayoutGrid={settings.showLayoutGrid}
            layoutNavigation={layoutNavigation}
            onToggleLayoutMode={() => setIsLayoutMode(false)}
            onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
            playHeaderDistrict={playHeaderDistrict}
            showDistrictLabels={settings.showDistrictLabels}
            onShowDistrictLabelsChange={(value) => handleBooleanSettingChange("showDistrictLabels", value)}
            snapshot={snapshot}
            boardSquares={boardSquares}
            selectedSquare={selectedSquare}
            hoveredSquare={hoveredSquare}
            inspectedSquare={inspectedSquare}
            legalMoves={legalMoves}
            defaultViewMode={settings.defaultViewMode}
            playDistrictsBySquare={playDistrictsBySquare}
            animatedPieces={animatedPieces}
            onSquareClick={handleSquareClick}
            onSquareHover={setHoveredSquare}
            playMapCityMenu={playMapCityMenu}
            playHeaderActions={renderPlayHeaderActions()}
            playHeaderDistrictBadge={renderPlayHeaderDistrictBadge()}
            playCityBoard={playCityBoard}
            selectedDistrict={selectedDistrict}
            focusedDistrict={focusedDistrict}
            lastMoveDistrict={lastMoveDistrict}
            lastMove={lastMove}
            selectedMove={selectedMove}
            selectedEvent={selectedEvent}
            focusedPiece={focusedPiece}
            focusedCharacter={focusedCharacter}
            focusedCharacterMoments={focusedCharacterMoments}
            storyFocusedSquare={storyFocusedSquare}
            moveHistory={moveHistory}
            showRecentCharacterActions={settings.showRecentCharacterActions}
            tonePreset={tonePreset}
            onToneChange={updateTonePreset}
            savedMatches={savedMatches}
            selectedSavedMatchId={selectedSavedMatchId}
            onSelectSavedMatch={setSelectedSavedMatchId}
            onLoadSavedMatch={handleLoadSelectedSavedMatch}
            onDeleteSelectedSavedMatch={handleRemoveSelectedSavedMatch}
            referenceGames={referenceGamesLibrary}
            selectedReferenceGameId={selectedReferenceGameId}
            onSelectReferenceGame={setSelectedReferenceGameId}
            onLoadReferenceGame={handleLoadReferenceGame}
            accountEmail={sessionEmail}
            accountUsername={sessionProfile?.username ?? null}
            multiplayerCityOptions={multiplayerCityOptions}
            activeMultiplayerGameId={activeMultiplayerSession?.gameId ?? null}
            onLoadActiveGame={(gameId) => {
              void handleLoadActiveMultiplayerGame(gameId);
            }}
            onActiveGameStateChanged={(gameId) => {
              if (activeMultiplayerSession?.gameId === gameId) {
                void refreshLoadedActiveMultiplayerGame({ silent: true });
              }
            }}
            selectedPly={selectedPly}
            totalPlies={totalPlies}
            isHistoryPlaying={isHistoryPlaying}
            onHistoryJumpToStart={handleHistoryJumpToStart}
            onHistoryStepBackward={handleHistoryStepBackward}
            onToggleHistoryPlayback={handleToggleHistoryPlayback}
            onHistoryStepForward={handleHistoryStepForward}
            onHistoryJumpToEnd={handleHistoryJumpToEnd}
            onHistorySelectPly={handleHistorySelectPly}
          />
        )}
      </Suspense>
    </div>
  );
}
