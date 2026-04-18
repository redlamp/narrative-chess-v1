import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Building2,
  ChessPawn,
  Cloud,
  ChevronDown,
  FileJson,
  LayoutDashboard,
  Moon,
  Pencil,
  Scroll,
  Sun,
  Telescope,
  UsersRound
} from "lucide-react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { CityBoard, PieceKind, Square } from "@narrative-chess/content-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
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
  getSnappedWorkspaceColumn,
  getSnappedWorkspaceRow,
  getWorkspaceLayoutRowCount,
  getWorkspacePanelRenderHeight,
  listWorkspaceLayoutState,
  resetWorkspaceLayoutState,
  restoreWorkspacePanel,
  saveWorkspaceLayoutState,
  setWorkspacePanelCollapsed,
  setWorkspacePanelVisible,
  updateWorkspaceColumnCount,
  updateWorkspaceColumnGap,
  updateWorkspacePanelRect,
  updateWorkspaceRowHeight,
  workspacePanelIds,
  type CollapsibleWorkspacePanelId,
  type WorkspaceLayoutState,
  type WorkspacePanelId,
  type WorkspacePanelRect
} from "./layoutState";
import {
  listKnownWorkspaceLayoutFiles,
  type WorkspaceLayoutFileReference
} from "./layoutFiles";
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
  connectWorkspaceLayoutDirectory,
  getConnectedWorkspaceLayoutDirectoryName,
  deleteWorkspaceLayoutFileFromDirectory,
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
  bootstrapFirstAdmin,
  getCurrentSession,
  loadCurrentUserRole,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  subscribeToAuthChanges,
  type AppRole
} from "./auth";
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
import { Board } from "./components/Board";
import { BoardPanel } from "./components/BoardPanel";
import { CityMapLibrePanel } from "./components/CityMapLibrePanel";
import { Panel } from "./components/Panel";
import { AppMenu } from "./components/AppMenu";
import { ClassicGamesLibraryPage } from "./components/ClassicGamesLibraryPage";
import { DesignPage } from "./components/DesignPage";
import { IndexedWorkspace, type LayoutNavigation } from "./components/IndexedWorkspace";
import { EdinburghReviewPage } from "./components/EdinburghReviewPage";
import { MatchHistoryPanel } from "./components/MatchHistoryPanel";
import { ResearchPage } from "./components/ResearchPage";
import { RoleCatalogPage } from "./components/RoleCatalogPage";
import { StoryBeatSection } from "./components/StoryBeatSection";
import { StoryCityTileSection } from "./components/StoryCityTileSection";
import { StoryToneSection } from "./components/StoryToneSection";
import { CharacterDetailPanel } from "./components/CharacterDetailPanel";
import { DistrictBadge } from "./components/DistrictBadge";
import { RecentGamesPanel } from "./components/RecentGamesPanel";
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

type AppPage = "match" | "classics" | "cities" | "roles" | "design" | "research";
type LayoutEditMode = "move" | "resize";

type ActiveLayoutEdit = {
  panelId: WorkspacePanelId;
  mode: LayoutEditMode;
  originColumn: number;
  originRow: number;
  initialRect: WorkspacePanelRect;
};

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type SaveEverythingNotice = LayoutFileNotice;

type PlayCitySource = "fallback" | "supabase-published" | "supabase-draft";
type PlayCityPreviewMode = "published" | "draft";

type PanelSizeConstraint = {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
};

const historyPlaybackDelayMs = 700;

const panelTitles: Record<WorkspacePanelId, string> = {
  board: "Board",
  moves: "Match History (PGN)",
  "city-map": "City Map (Google)",
  "city-map-maplibre": "Map",
  "story-beat": "Story Beat",
  "story-tile": "District",
  "story-character": "Character",
  "story-tone": "Narrative Tone",
  "recent-games": "Games"
};

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

function getWorkspaceGridStyle(
  layoutState: WorkspaceLayoutState,
  rowCount: number
): CSSProperties {
  return {
    "--workspace-column-count": String(layoutState.columnCount),
    "--workspace-column-gap": `${layoutState.columnGap}px`,
    "--workspace-row-height": `${layoutState.rowHeight}px`,
    "--workspace-row-count": String(rowCount)
  } as CSSProperties;
}

function getWorkspacePanelStyle(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId,
  isCompactViewport: boolean,
  freeformLayout: boolean
): CSSProperties | undefined {
  if (isCompactViewport) {
    return undefined;
  }

  const panel = layoutState.panels[panelId];
  if (!panel) {
    // Fallback: return a minimal style for panels that don't exist in layout
    return {
      gridColumn: "1 / span 1",
      gridRow: "1 / span 1",
      zIndex: 100
    };
  }

  const renderHeight = getWorkspacePanelRenderHeight(layoutState, panelId);
  const area = panel.w * renderHeight;
  const zIndex = Math.max(
    100,
    Number.isFinite(area) && Number.isFinite(panel.w) && Number.isFinite(renderHeight)
      ? 6000 - area * 10 - panel.w - renderHeight
      : 100
  );

  if (freeformLayout) {
    const columnOffset = Math.max(0, panel.x - 1);
    const rowOffset = Math.max(0, panel.y - 1);

    return {
      left: `calc(((100% - (var(--workspace-column-gap) * (var(--workspace-column-count) - 1))) / var(--workspace-column-count) * ${columnOffset}) + (var(--workspace-column-gap) * ${columnOffset}))`,
      top: `calc((var(--workspace-row-height) * ${rowOffset}) + (var(--workspace-column-gap) * ${rowOffset}))`,
      width: `calc(((100% - (var(--workspace-column-gap) * (var(--workspace-column-count) - 1))) / var(--workspace-column-count) * ${panel.w}) + (var(--workspace-column-gap) * ${Math.max(panel.w - 1, 0)}))`,
      height: `calc((var(--workspace-row-height) * ${renderHeight}) + (var(--workspace-column-gap) * ${Math.max(renderHeight - 1, 0)}))`,
      zIndex
    };
  }

  return {
    gridColumn: `${panel.x} / span ${panel.w}`,
    gridRow: `${panel.y} / span ${renderHeight}`,
    zIndex
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createDefaultPanelSizeConstraints(input: {
  maxWidth: number;
  maxHeight: number;
}): Record<WorkspacePanelId, PanelSizeConstraint> {
  const safeMaxWidth = Math.max(1, input.maxWidth);
  const safeMaxHeight = Math.max(1, input.maxHeight);

  return workspacePanelIds.reduce((next, panelId) => {
    next[panelId] = {
      minW: 1,
      maxW: safeMaxWidth,
      minH: 1,
      maxH: safeMaxHeight
    };
    return next;
  }, {} as Record<WorkspacePanelId, PanelSizeConstraint>);
}

function normalizePanelSizeConstraint(
  constraint: PanelSizeConstraint,
  maxSize: {
    maxWidth: number;
    maxHeight: number;
  }
): PanelSizeConstraint {
  const safeMaxWidth = Math.max(1, maxSize.maxWidth);
  const safeMaxHeight = Math.max(1, maxSize.maxHeight);
  const minW = clamp(Math.round(constraint.minW), 1, safeMaxWidth);
  const maxW = clamp(Math.round(constraint.maxW), minW, safeMaxWidth);
  const minH = clamp(Math.round(constraint.minH), 1, safeMaxHeight);
  const maxH = clamp(Math.round(constraint.maxH), minH, safeMaxHeight);

  return {
    minW,
    maxW,
    minH,
    maxH
  };
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
  const [panelSizeConstraints, setPanelSizeConstraints] = useState<
    Record<WorkspacePanelId, PanelSizeConstraint>
  >(() => {
    const initialLayout = listWorkspaceLayoutState();
    return createDefaultPanelSizeConstraints({
      maxWidth: initialLayout.columnCount,
      maxHeight: Math.max(24, getWorkspaceLayoutRowCount(initialLayout) + 12)
    });
  });
  const [activePanelConstraintEditor, setActivePanelConstraintEditor] = useState<WorkspacePanelId | null>(null);
  const [layoutFileName, setLayoutFileName] = useState("match-workspace");
  const [layoutDirectoryName, setLayoutDirectoryName] = useState<string | null>(null);
  const [layoutFileBusyAction, setLayoutFileBusyAction] = useState<string | null>(null);
  const [layoutFileNotice, setLayoutFileNotice] = useState<LayoutFileNotice | null>(null);
  const [saveEverythingNotice, setSaveEverythingNotice] = useState<SaveEverythingNotice | null>(null);
  const [isSavingEverything, setIsSavingEverything] = useState(false);
  const [isLoadingEverything, setIsLoadingEverything] = useState(false);
  const [isResettingEverything, setIsResettingEverything] = useState(false);
  const [knownLayoutFiles, setKnownLayoutFiles] = useState<WorkspaceLayoutFileReference[]>(() =>
    listKnownWorkspaceLayoutFiles()
  );
  const [isLayoutDirectorySupported, setIsLayoutDirectorySupported] = useState(false);
  const [activeLayoutEdit, setActiveLayoutEdit] = useState<ActiveLayoutEdit | null>(null);
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
  const [viewAsRole, setViewAsRole] = useState<AppRole>("player");
  const [isAuthBusy, setIsAuthBusy] = useState(false);
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
  const effectiveRole = viewAsRole;
  const canAccessDraftCities = effectiveRole === "author" || effectiveRole === "admin";
  const canPublishCities = effectiveRole === "admin";
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

    const loadRemoteBoard =
      effectivePlayCityPreviewMode === "draft"
        ? loadLatestDraftCityBoard(definition).then((draftResult) => {
            if (draftResult) {
              return {
                board: draftResult.board,
                source: "supabase-draft" as const,
                publishedEditionId: draftResult.cityEditionId,
                matchesFallback: null
              };
            }

            return loadPublishedCityBoard(definition, selectedPlayCityOption.publishedEditionId).then((result) => ({
              ...result,
              source: result.source === "supabase" ? ("supabase-published" as const) : "fallback"
            }));
          })
        : loadPublishedCityBoard(definition, selectedPlayCityOption.publishedEditionId).then((result) => ({
            ...result,
            source: result.source === "supabase" ? ("supabase-published" as const) : "fallback"
          }));

    void loadRemoteBoard
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
      } catch (error) {
        if (!cancelled) {
          console.warn("[supabase] Could not read current auth session.", error);
          setSessionEmail(null);
          setSessionRole("player");
        }
      }
    };

    void applySessionState();

    const unsubscribe = subscribeToAuthChanges((session) => {
      const user = session?.user ?? null;
      setSessionEmail(user?.email ?? null);
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
  }, [resolveAppRole]);

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
  const workspaceRef = useRef<HTMLDivElement | null>(null);
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
    removeSavedMatch
  } = useChessMatch({
    roleCatalog
  });
  const motionPlayhead = useMovePlayhead({
    targetPly: selectedPly,
    totalPlies,
    resetKey: timelineKey
  });
  const animatedPieces = useMemo(
    () => getAnimatedPieceFrames({ snapshots: historySnapshots, playhead: motionPlayhead }),
    [historySnapshots, motionPlayhead]
  );

  const status = snapshot.status;
  const moveHistory = historyMoves;
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

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOut();
      setSessionRole("player");
      setViewAsRole("player");
      return "Signed out.";
    } catch (error) {
      console.warn("[supabase] Sign-out failed.", error);
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
  const useFreeformWorkspaceLayout = !isCompactViewport;
  const workspaceRowCount = useMemo(
    () => getWorkspaceLayoutRowCount(workspaceLayout, effectiveLayoutMode ? 18 : 1),
    [effectiveLayoutMode, workspaceLayout]
  );
  const panelConstraintMaxSize = useMemo(
    () => ({
      maxWidth: Math.max(1, workspaceLayout.columnCount),
      maxHeight: Math.max(24, workspaceRowCount + 12)
    }),
    [workspaceLayout.columnCount, workspaceRowCount]
  );
  const workspaceGridStyle = useMemo(
    () => getWorkspaceGridStyle(workspaceLayout, workspaceRowCount),
    [workspaceLayout, workspaceRowCount]
  );
  const gridOverlayCells = useMemo(
    () => Array.from({ length: workspaceRowCount * workspaceLayout.columnCount }, (_, index) => index),
    [workspaceLayout.columnCount, workspaceRowCount]
  );
  const layoutToolbarComponents = useMemo(
    () => [
      {
        id: "board",
        label: panelTitles.board,
        visible: workspaceLayout.visible.board
      },
      {
        id: "moves",
        label: panelTitles.moves,
        visible: workspaceLayout.visible.moves
      },
      {
        id: "city-map",
        label: panelTitles["city-map"],
        collapsed: workspaceLayout.collapsed["city-map"],
        visible: workspaceLayout.visible["city-map"]
      },
      {
        id: "city-map-maplibre",
        label: panelTitles["city-map-maplibre"],
        visible: workspaceLayout.visible["city-map-maplibre"]
      },
      {
        id: "story-beat",
        label: panelTitles["story-beat"],
        collapsed: workspaceLayout.collapsed["story-beat"],
        visible: workspaceLayout.visible["story-beat"]
      },
      {
        id: "story-tile",
        label: panelTitles["story-tile"],
        collapsed: workspaceLayout.collapsed["story-tile"],
        visible: workspaceLayout.visible["story-tile"]
      },
      {
        id: "story-character",
        label: panelTitles["story-character"],
        collapsed: workspaceLayout.collapsed["story-character"],
        visible: workspaceLayout.visible["story-character"]
      },
      {
        id: "story-tone",
        label: panelTitles["story-tone"],
        visible: workspaceLayout.visible["story-tone"]
      },
      {
        id: "recent-games",
        label: panelTitles["recent-games"],
        collapsed: workspaceLayout.collapsed["recent-games"],
        visible: workspaceLayout.visible["recent-games"]
      }
    ],
    [workspaceLayout.collapsed, workspaceLayout.visible]
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
  const applyResizeConstraints = (
    panelId: WorkspacePanelId,
    nextRect: WorkspacePanelRect,
    layoutState: WorkspaceLayoutState = workspaceLayout
  ): WorkspacePanelRect => {
    const maxSize = {
      maxWidth: Math.max(1, layoutState.columnCount),
      maxHeight: Math.max(24, getWorkspaceLayoutRowCount(layoutState) + 12)
    };
    const normalized = normalizePanelSizeConstraint(
      panelSizeConstraints[panelId],
      maxSize
    );

    return {
      ...nextRect,
      w: clamp(nextRect.w, normalized.minW, normalized.maxW),
      h: clamp(nextRect.h, normalized.minH, normalized.maxH)
    };
  };

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
    setPanelSizeConstraints((current) =>
      workspacePanelIds.reduce((next, panelId) => {
        next[panelId] = normalizePanelSizeConstraint(current[panelId], panelConstraintMaxSize);
        return next;
      }, {} as Record<WorkspacePanelId, PanelSizeConstraint>)
    );
  }, [panelConstraintMaxSize]);

  useEffect(() => {
    if (!effectiveLayoutMode) {
      setActivePanelConstraintEditor(null);
    }
  }, [effectiveLayoutMode]);

  useEffect(() => {
    applyAppTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    applyHighlightColor(settings.highlightColor);
  }, [settings.highlightColor]);

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
    setIsLayoutDirectorySupported(supportsWorkspaceLayoutDirectory());
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
    if (!activeLayoutEdit || isCompactViewport) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const workspaceNode = workspaceRef.current;
      if (!workspaceNode) {
        return;
      }

      const rect = workspaceNode.getBoundingClientRect();
      const nextColumn = getSnappedWorkspaceColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: workspaceLayout.columnCount,
        columnGap: workspaceLayout.columnGap
      });
      const nextRow = getSnappedWorkspaceRow({
        offsetY: event.clientY - rect.top,
        rowHeight: workspaceLayout.rowHeight,
        rowGap: workspaceLayout.columnGap
      });

      setWorkspaceLayout((currentLayout) => {
        if (!activeLayoutEdit) {
          return currentLayout;
        }

        if (activeLayoutEdit.mode === "move") {
          return updateWorkspacePanelRect({
            layoutState: currentLayout,
            panelId: activeLayoutEdit.panelId,
            nextRect: {
              ...activeLayoutEdit.initialRect,
              x: activeLayoutEdit.initialRect.x + (nextColumn - activeLayoutEdit.originColumn),
              y: Math.max(1, activeLayoutEdit.initialRect.y + (nextRow - activeLayoutEdit.originRow))
            }
          });
        }

        return updateWorkspacePanelRect({
          layoutState: currentLayout,
          panelId: activeLayoutEdit.panelId,
          nextRect: applyResizeConstraints(
            activeLayoutEdit.panelId,
            {
              ...activeLayoutEdit.initialRect,
              w: Math.max(1, nextColumn - activeLayoutEdit.initialRect.x + 1),
              h: Math.max(1, nextRow - activeLayoutEdit.initialRect.y + 1)
            },
            currentLayout
          )
        });
      });
    };

    const handlePointerUp = () => {
      setActiveLayoutEdit(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    applyResizeConstraints,
    activeLayoutEdit,
    isCompactViewport,
    workspaceLayout.columnCount,
    workspaceLayout.rowHeight
  ]);

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

  const beginPanelEdit =
    (panelId: WorkspacePanelId, mode: LayoutEditMode) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!effectiveLayoutMode || !workspaceRef.current) {
        return;
      }

      event.preventDefault();

      const initialRect = workspaceLayout.panels[panelId];
      if (!initialRect) {
        return;
      }

      const rect = workspaceRef.current.getBoundingClientRect();
      const originColumn = getSnappedWorkspaceColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: workspaceLayout.columnCount,
        columnGap: workspaceLayout.columnGap
      });
      const originRow = getSnappedWorkspaceRow({
        offsetY: event.clientY - rect.top,
        rowHeight: workspaceLayout.rowHeight,
        rowGap: workspaceLayout.columnGap
      });

      setActiveLayoutEdit({
        panelId,
        mode,
        originColumn,
        originRow,
        initialRect
      });
    };

  const adjustPanelLayout = (
    panelId: WorkspacePanelId,
    mode: LayoutEditMode,
    deltaX: number,
    deltaY: number
  ) => {
    if (!effectiveLayoutMode) {
      return;
    }

    setWorkspaceLayout((currentLayout) => {
      const currentRect = currentLayout.panels[panelId];
      const nextRect =
        mode === "move"
          ? {
              ...currentRect,
              x: currentRect.x + deltaX,
              y: currentRect.y + deltaY
            }
          : applyResizeConstraints(
              panelId,
              {
                ...currentRect,
                w: currentRect.w + deltaX,
                h: currentRect.h + deltaY
              },
              currentLayout
            );

      return updateWorkspacePanelRect({
        layoutState: currentLayout,
        panelId,
        nextRect
      });
    });
  };

  const handlePanelEditKeyDown =
    (panelId: WorkspacePanelId, mode: LayoutEditMode) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!effectiveLayoutMode) {
        return;
      }

      const step = event.shiftKey ? 2 : 1;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, 0, mode === "move" ? -step : -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, 0, step);
          break;
        case "ArrowLeft":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, mode === "move" ? -step : -step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, step, 0);
          break;
        default:
          break;
      }
    };

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
    loadChosenReferenceGame();
  };

  const handleLoadReferenceGameFromLibrary = (referenceGameId: string) => {
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

  const handleTogglePanelCollapse = (panelId: CollapsibleWorkspacePanelId) => {
    setWorkspaceLayout((currentLayout) =>
      setWorkspacePanelCollapsed({
        layoutState: currentLayout,
        panelId,
        collapsed: !currentLayout.collapsed[panelId]
      })
    );
  };

  const handleWorkspacePanelVisibilityChange = (panelId: WorkspacePanelId, visible: boolean) => {
    setWorkspaceLayout((currentLayout) =>
      setWorkspacePanelVisible({
        layoutState: currentLayout,
        panelId,
        visible
      })
    );

    if (!visible) {
      setActiveLayoutEdit((currentEdit) => (currentEdit?.panelId === panelId ? null : currentEdit));
      setActivePanelConstraintEditor((currentPanelId) =>
        currentPanelId === panelId ? null : currentPanelId
      );
    }
  };

  const handleWorkspaceColumnCountChange = (value: number) => {
    setWorkspaceLayout((currentLayout) =>
      updateWorkspaceColumnCount({
        layoutState: currentLayout,
        value
      })
    );
  };

  const handleWorkspaceColumnGapChange = (value: number) => {
    setWorkspaceLayout((currentLayout) =>
      updateWorkspaceColumnGap({
        layoutState: currentLayout,
        value
      })
    );
  };

  const handleWorkspaceRowHeightChange = (value: number) => {
    setWorkspaceLayout((currentLayout) =>
      updateWorkspaceRowHeight({
        layoutState: currentLayout,
        value
      })
    );
  };

  const handleResetLayout = () => {
    setWorkspaceLayout(resetWorkspaceLayoutState());
  };

  const handleRestoreWorkspaceComponent = (panelId: WorkspacePanelId) => {
    setWorkspaceLayout((currentLayout) =>
      restoreWorkspacePanel({
        layoutState: currentLayout,
        panelId
      })
    );
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

  const runLayoutFileAction = async (actionName: string, action: () => Promise<void>) => {
    setLayoutFileBusyAction(actionName);
    setLayoutFileNotice(null);

    try {
      await action();
    } catch (error) {
      setLayoutFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong while working with the layout file."
      });
    } finally {
      setLayoutFileBusyAction(null);
    }
  };

  const handleConnectLayoutDirectory = () => {
    void runLayoutFileAction("connect-layout-directory", async () => {
      const result = await connectWorkspaceLayoutDirectory();
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileNotice({
        tone: "success",
        text: `Connected layout files to ${result.directoryName}.`
      });
    });
  };

  const handleSaveLayoutFile = () => {
    void runLayoutFileAction("save-layout-file", async () => {
      const result = await saveWorkspaceLayoutFileToDirectory({
        name: layoutFileName,
        layoutState: workspaceLayout
      });
      setKnownLayoutFiles(result.knownFiles);
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName(result.layoutName);
      setLayoutFileNotice({
        tone: "success",
        text: `Saved ${result.layoutName} to ${result.relativePath}.`
      });
    });
  };

  const handleLoadLayoutFile = () => {
    void runLayoutFileAction("load-layout-file", async () => {
      const result = await loadWorkspaceLayoutFileFromDirectory(layoutFileName);
      if (!result) {
        setLayoutFileNotice({
          tone: "neutral",
          text: "No named layout file matched that name in the connected folder."
        });
        return;
      }

      setWorkspaceLayout(saveWorkspaceLayoutState(result.layoutState));
      setKnownLayoutFiles(result.knownFiles);
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName(result.layoutName);
      setLayoutFileNotice({
        tone: "success",
        text: `Loaded ${result.layoutName} from ${result.relativePath}.`
      });
    });
  };

  const handleDeleteLayoutFile = () => {
    void runLayoutFileAction("delete-layout-file", async () => {
      const result = await deleteWorkspaceLayoutFileFromDirectory(layoutFileName);
      setKnownLayoutFiles(result.knownFiles);
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName("match-workspace");
      setWorkspaceLayout(resetWorkspaceLayoutState());
      setLayoutFileNotice({
        tone: "neutral",
        text: `Removed ${result.layoutName} from ${result.relativePath} and restored the default layout.`
      });
    });
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

    loadSavedMatch(selectedSavedMatch.id);
  };

  const handleRemoveSelectedSavedMatch = () => {
    if (!selectedSavedMatch) {
      return;
    }

    removeSavedMatch(selectedSavedMatch.id);
    setSelectedSavedMatchId(null);
  };

  const updatePanelConstraintRange = (
    panelId: WorkspacePanelId,
    axis: "width" | "height",
    nextRange: number[]
  ) => {
    if (nextRange.length < 2) {
      return;
    }

    const [start, end] = nextRange;
    const minValue = Math.min(start, end);
    const maxValue = Math.max(start, end);
    const normalized = normalizePanelSizeConstraint(
      axis === "width"
        ? {
            ...panelSizeConstraints[panelId],
            minW: minValue,
            maxW: maxValue
          }
        : {
            ...panelSizeConstraints[panelId],
            minH: minValue,
            maxH: maxValue
          },
      panelConstraintMaxSize
    );

    setPanelSizeConstraints((current) => ({
      ...current,
      [panelId]: normalized
    }));

    setWorkspaceLayout((currentLayout) =>
      updateWorkspacePanelRect({
        layoutState: currentLayout,
        panelId,
        nextRect: {
          ...currentLayout.panels[panelId],
          w: clamp(currentLayout.panels[panelId].w, normalized.minW, normalized.maxW),
          h: clamp(currentLayout.panels[panelId].h, normalized.minH, normalized.maxH)
        }
      })
    );
  };

  const renderMoveSurface = (panelId: WorkspacePanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__move-surface"
        onPointerDown={beginPanelEdit(panelId, "move")}
        onKeyDown={handlePanelEditKeyDown(panelId, "move")}
        aria-label={`Move ${panelTitles[panelId]} panel with pointer or arrow keys`}
      />
    ) : null;

  const renderResizeHandle = (panelId: WorkspacePanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__resize-handle"
        onPointerDown={beginPanelEdit(panelId, "resize")}
        onKeyDown={handlePanelEditKeyDown(panelId, "resize")}
        aria-label={`Resize ${panelTitles[panelId]} panel with pointer or arrow keys`}
      >
        <span />
      </button>
    ) : null;

  const renderConstraintHandle = (panelId: WorkspacePanelId) => {
    if (!effectiveLayoutMode) {
      return null;
    }

    const isOpen = activePanelConstraintEditor === panelId;
    const constraint = normalizePanelSizeConstraint(
      panelSizeConstraints[panelId],
      panelConstraintMaxSize
    );

    return (
      <>
        <Button
          type="button"
          variant={isOpen ? "secondary" : "outline"}
          size="icon-sm"
          className="workspace-item__settings-handle"
          aria-label={`Edit ${panelTitles[panelId]} resize bounds`}
          onClick={(event) => {
            event.stopPropagation();
            setActivePanelConstraintEditor((current) => (current === panelId ? null : panelId));
          }}
        >
          <Cog />
        </Button>
        {isOpen ? (
          <Card
            className="workspace-item__settings-card"
            size="sm"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <CardHeader className="workspace-item__settings-card-header">
              <CardTitle className="workspace-item__settings-card-title">
                {panelTitles[panelId]} bounds
              </CardTitle>
            </CardHeader>
            <CardContent className="workspace-item__settings-card-body">
              <label className="workspace-item__settings-row">
                <span>Width: {constraint.minW} to {constraint.maxW}</span>
                <Slider
                  min={1}
                  max={panelConstraintMaxSize.maxWidth}
                  step={1}
                  value={[constraint.minW, constraint.maxW]}
                  onValueChange={(value) => updatePanelConstraintRange(panelId, "width", value)}
                />
              </label>
              <label className="workspace-item__settings-row">
                <span>Height: {constraint.minH} to {constraint.maxH}</span>
                <Slider
                  min={1}
                  max={panelConstraintMaxSize.maxHeight}
                  step={1}
                  value={[constraint.minH, constraint.maxH]}
                  onValueChange={(value) => updatePanelConstraintRange(panelId, "height", value)}
                />
              </label>
            </CardContent>
          </Card>
        ) : null}
      </>
    );
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
            <Button
              type="button"
              variant={effectiveLayoutMode ? "secondary" : "outline"}
              size="icon-sm"
              onClick={() => setIsLayoutMode((current) => !current)}
              disabled={isCompactViewport}
              aria-label={effectiveLayoutMode ? "Exit layout mode" : "Edit layout"}
              title={effectiveLayoutMode ? "Exit layout mode" : "Edit layout"}
            >
              <LayoutDashboard />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => handleThemeChange(settings.theme === "dark" ? "light" : "dark")}
              aria-label={settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              title={settings.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {settings.theme === "dark" ? (
                <Sun />
              ) : (
                <Moon />
              )}
            </Button>

            <AppMenu
              isOpen={isMenuOpen}
              onOpenChange={setIsMenuOpen}
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
              accountEmail={sessionEmail}
              accountRole={sessionRole}
              viewAsRole={viewAsRole}
              onViewAsRoleChange={setViewAsRole}
              canAccessDraftCities={canAccessDraftCities}
              isAuthBusy={isAuthBusy}
              onSignInWithPassword={handleSignInWithPassword}
              onSignUpWithPassword={handleSignUpWithPassword}
              onSignOut={handleSignOut}
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
              <div className="app-header__status-grid">
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Turn</span>
                  <strong className="app-header__status-value">{turnLabel(status.turn)}</strong>
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
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {page === "cities" ? (
        <EdinburghReviewPage
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
        <IndexedWorkspace
          className="match-workspace"
          layoutMode={effectiveLayoutMode}
          layoutKey="match-workspace"
          layoutVariant="match"
          showLayoutGrid={settings.showLayoutGrid}
          layoutNavigation={layoutNavigation}
          onToggleLayoutMode={() => setIsLayoutMode(false)}
          onToggleLayoutGrid={(checked: boolean) => handleBooleanSettingChange("showLayoutGrid", checked)}
          panels={[
            {
              id: "board",
              label: "Board",
              content: (
                <BoardPanel
                  districtName={playHeaderDistrict?.name ?? null}
                  districtSquare={playHeaderDistrict?.square ?? null}
                  showDistrictLabels={settings.showDistrictLabels}
                  onShowDistrictLabelsChange={(v) => handleBooleanSettingChange("showDistrictLabels", v)}
                  showPieces={true}
                  onShowPiecesChange={null}
                  layoutMode={!!effectiveLayoutMode}
                >
                  <Board
                    snapshot={snapshot}
                    cells={boardSquares}
                    selectedSquare={selectedSquare}
                    hoveredSquare={hoveredSquare}
                    inspectedSquare={inspectedSquare}
                    legalMoves={legalMoves}
                    viewMode={settings.defaultViewMode}
                    districtsBySquare={playDistrictsBySquare}
                    showCoordinates={true}
                    showDistrictLabels={settings.showDistrictLabels}
                    animatedPieces={animatedPieces}
                    onSquareClick={handleSquareClick}
                    onSquareHover={setHoveredSquare}
                    onSquareLeave={() => setHoveredSquare(null)}
                  />
                </BoardPanel>
              )
            },
            {
              id: "moves",
              label: "Match History",
              content: (
                <MatchHistoryPanel
                  moves={moveHistory}
                  characters={snapshot.characters}
                  selectedPly={selectedPly}
                  totalPlies={totalPlies}
                  onJumpToStart={handleHistoryJumpToStart}
                  onStepBackward={handleHistoryStepBackward}
                  isPlaying={isHistoryPlaying}
                  onTogglePlayback={handleToggleHistoryPlayback}
                  onStepForward={handleHistoryStepForward}
                  onJumpToEnd={handleHistoryJumpToEnd}
                  onSelectPly={handleHistorySelectPly}
                />
              )
            },
            {
              id: "city-map-maplibre",
              label: "Map",
              content: (
                <Panel title={playMapCityMenu} action={renderPlayHeaderActions()}>
                  <CityMapLibrePanel
                    cityBoard={playCityBoard}
                    pieces={animatedPieces}
                    selectedDistrict={selectedDistrict}
                    hoveredDistrict={hoveredSquare ? focusedDistrict : null}
                    lastMoveDistrict={lastMoveDistrict}
                    lastMove={lastMove}
                    onPieceSquareHover={setHoveredSquare}
                  />
                </Panel>
              )
            },
            {
              id: "story-beat",
              label: "Story Beat",
              content: (
                <Panel title="Story Beat">
                  <StoryBeatSection
                    selectedMove={selectedMove}
                    selectedEvent={selectedEvent}
                    showLabel={false}
                  />
                </Panel>
              )
            },
            {
              id: "story-tile",
              label: "District",
              content: (
                <Panel title="District" action={renderPlayHeaderDistrictBadge()}>
                  <StoryCityTileSection
                    cityBoard={playCityBoard}
                    focusedDistrict={focusedDistrict}
                    selectedDistrict={selectedDistrict}
                    focusedPiece={focusedPiece}
                    focusedCharacter={focusedCharacter}
                    isHoverPreview={Boolean(hoveredSquare)}
                    showLabel={false}
                  />
                </Panel>
              )
            },
            {
              id: "story-character",
              label: "Character",
              content: (
                <CharacterDetailPanel
                  focusedSquare={storyFocusedSquare}
                  focusedPiece={focusedPiece}
                  focusedCharacter={focusedCharacter}
                  focusedCharacterMoments={focusedCharacterMoments}
                  moveHistory={moveHistory}
                  showRecentCharacterActions={settings.showRecentCharacterActions}
                />
              )
            },
            {
              id: "story-tone",
              label: "Narrative Tone",
              content: (
                <Panel
                  title="Narrative Tone"
                  action={
                    <StoryToneSection
                      tonePreset={tonePreset}
                      onToneChange={updateTonePreset}
                      showLabel={false}
                      inline
                    />
                  }
                >
                  <p className="muted">Set the narration style for generated beats and summaries.</p>
                </Panel>
              )
            },
            {
              id: "recent-games",
              label: "Games",
              content: (
                <Panel title="Games">
                  <RecentGamesPanel
                    savedMatches={savedMatches}
                    selectedSavedMatchId={selectedSavedMatchId}
                    onSelectSavedMatch={setSelectedSavedMatchId}
                    onLoadSavedMatch={handleLoadSelectedSavedMatch}
                    onDeleteSelectedSavedMatch={handleRemoveSelectedSavedMatch}
                    referenceGames={referenceGamesLibrary}
                    selectedReferenceGameId={selectedReferenceGameId}
                    onSelectReferenceGame={setSelectedReferenceGameId}
                    onLoadReferenceGame={handleLoadReferenceGame}
                  />
                </Panel>
              )
            }
          ]}
        />
      )}
    </div>
  );
}
