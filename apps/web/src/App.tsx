import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { FolderOpen, LayoutDashboard, Moon, Save, Sun, Trash2 } from "lucide-react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { PieceKind, Square } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  applyAppTheme,
  listAppSettings,
  resetAppSettings,
  saveAppSettings,
  type AppSettings
} from "./appSettings";
import { edinburghDistrictsBySquare, getDistrictForSquare } from "./edinburghBoard";
import { getPieceDisplayName } from "./chessPresentation";
import {
  getSnappedWorkspaceColumn,
  getSnappedWorkspaceRow,
  getWorkspaceLayoutRowCount,
  getWorkspacePanelRenderHeight,
  listWorkspaceLayoutState,
  resetWorkspaceLayoutState,
  saveWorkspaceLayoutState,
  setWorkspacePanelCollapsed,
  updateWorkspaceColumnCount,
  updateWorkspaceColumnGap,
  updateWorkspacePanelRect,
  updateWorkspaceRowHeight,
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
import { listReferenceGames, type ReferenceGameLibrary } from "./referenceGames";
import {
  listStoryPanelLayoutState,
  saveStoryPanelLayoutState,
  updateStoryPanelRect,
  type StoryPanelLayoutState,
  type StoryPanelSectionId,
  type StoryPanelSectionRect
} from "./storyPanelLayoutState";
import {
  connectRoleCatalogDirectory,
  getConnectedRoleCatalogDirectoryName,
  loadRoleCatalogFromDirectory,
  saveRoleCatalogDraftToDirectory,
  supportsDirectoryWrite as supportsRoleCatalogDirectory,
  connectWorkspaceLayoutDirectory,
  getConnectedWorkspaceLayoutDirectoryName,
  deleteWorkspaceLayoutFileFromDirectory,
  loadWorkspaceLayoutFileFromDirectory,
  saveWorkspaceLayoutFileToDirectory,
  connectPieceStylesDirectory,
  getConnectedPieceStylesDirectoryName,
  loadPieceStylesFromDirectory,
  savePieceStylesDraftToDirectory,
  supportsWorkspaceLayoutDirectory
} from "./fileSystemAccess";
import { Board } from "./components/Board";
import { Panel } from "./components/Panel";
import { AppMenu } from "./components/AppMenu";
import { ClassicGamesLibraryPage } from "./components/ClassicGamesLibraryPage";
import { DesignPage } from "./components/DesignPage";
import { EdinburghReviewPage } from "./components/EdinburghReviewPage";
import { LayoutToolbar } from "./components/LayoutToolbar";
import { MatchHistoryPanel } from "./components/MatchHistoryPanel";
import { ResearchPage } from "./components/ResearchPage";
import { RoleCatalogPage } from "./components/RoleCatalogPage";
import { StoryPanel } from "./components/StoryPanel";
import { StudyPanel } from "./components/StudyPanel";
import { useChessMatch } from "./hooks/useChessMatch";
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

const panelTitles: Record<WorkspacePanelId, string> = {
  board: "Board",
  moves: "Match History (PGN)",
  narrative: "Story",
  saved: "Saved Matches",
  study: "Historic Matches"
};

const pageOptions: Array<{ value: AppPage; label: string }> = [
  { value: "match", label: "Play" },
  { value: "cities", label: "Cities" },
  { value: "roles", label: "Characters" },
  { value: "classics", label: "Historic" },
  { value: "research", label: "Research" },
  { value: "design", label: "Design" }
];

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

function turnLabel(turn: "white" | "black") {
  return turn === "white" ? "White to move" : "Black to move";
}

function toneLabel(tonePreset: "grounded" | "civic-noir" | "dark-comedy") {
  switch (tonePreset) {
    case "civic-noir":
      return "Civic noir";
    case "dark-comedy":
      return "Dark comedy";
    default:
      return "Grounded";
  }
}

function formatSavedAt(savedAt: string) {
  return new Date(savedAt).toLocaleString();
}

function getPageCaption(page: AppPage) {
  switch (page) {
    case "cities":
      return "Review city boards and district drafts.";
    case "classics":
      return "Study historic games and their key lines.";
    case "roles":
      return "Edit piece roles and roster flavor.";
    case "design":
      return "Inspect piece assets and edit the shared style sheet.";
    case "research":
      return "Review competitive chess products and references.";
    default:
      return "Keep the board central and inspect moves in context.";
  }
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
  const renderHeight = getWorkspacePanelRenderHeight(layoutState, panelId);
  const area = panel.w * renderHeight;
  const zIndex = 10000 - area * 100 - panel.w * 10 - panel.h;

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
  const [storyPanelLayout, setStoryPanelLayout] = useState<StoryPanelLayoutState>(() =>
    listStoryPanelLayoutState()
  );
  const [layoutFileName, setLayoutFileName] = useState("match-workspace");
  const [layoutDirectoryName, setLayoutDirectoryName] = useState<string | null>(null);
  const [layoutFileBusyAction, setLayoutFileBusyAction] = useState<string | null>(null);
  const [layoutFileNotice, setLayoutFileNotice] = useState<LayoutFileNotice | null>(null);
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
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const {
    snapshot,
    historyMoves,
    historyEvents,
    selectedPly,
    totalPlies,
    boardSquares,
    selectedSquare,
    savedMatches,
    legalMoves,
    canSave,
    isStudyMode,
    tonePreset,
    studySession,
    canStepBackward,
    canStepForward,
    lastMove,
    handleSquareClick,
    goToPly,
    loadReferenceGame,
    exitStudyMode,
    jumpToStart,
    stepBackward,
    stepForward,
    jumpToEnd,
    updateTonePreset,
    saveCurrentMatch,
    loadSavedMatch,
    removeSavedMatch
  } = useChessMatch({
    roleCatalog
  });

  const status = snapshot.status;
  const moveHistory = historyMoves;
  const eventByMoveId = new Map(historyEvents.map((event) => [event.moveId, event] as const));
  const selectedMove = selectedPly > 0 ? historyMoves[selectedPly - 1] ?? null : null;
  const selectedEvent = selectedMove ? eventByMoveId.get(selectedMove.id) ?? null : null;
  const storyFocusedSquare = hoveredSquare ?? selectedMove?.to ?? lastMove?.to ?? selectedSquare ?? null;
  const focusedDistrict = getDistrictForSquare(storyFocusedSquare);
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
  const effectiveLayoutMode = isLayoutMode && !isCompactViewport;
  const useFreeformWorkspaceLayout = !isCompactViewport;
  const workspaceRowCount = useMemo(
    () => getWorkspaceLayoutRowCount(workspaceLayout),
    [workspaceLayout]
  );
  const workspaceGridStyle = useMemo(
    () => getWorkspaceGridStyle(workspaceLayout, workspaceRowCount),
    [workspaceLayout, workspaceRowCount]
  );
  const focusedSquareSummary = storyFocusedSquare
    ? (() => {
        const squareParts = [`Inspecting ${storyFocusedSquare}`];
        if (focusedPiece) {
          squareParts.push(getPieceDisplayName(focusedPiece));
        } else {
          squareParts.push("empty square");
        }
        if (focusedDistrict) {
          squareParts.push(`mapped to ${focusedDistrict.name}`);
        }
        return `${squareParts.join(", ")}.`;
      })()
    : "Hover a square to inspect it. When hover ends, the Story panel returns to the current move.";
  const gridOverlayCells = useMemo(
    () => Array.from({ length: workspaceRowCount * workspaceLayout.columnCount }, (_, index) => index),
    [workspaceLayout.columnCount, workspaceRowCount]
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
    applyPieceStyleSheet(pieceStyleSheet);
  }, [pieceStyleSheet]);

  useEffect(() => {
    saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveWorkspaceLayoutState(workspaceLayout);
  }, [workspaceLayout]);

  useEffect(() => {
    saveStoryPanelLayoutState(storyPanelLayout);
  }, [storyPanelLayout]);

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
          nextRect: {
            ...activeLayoutEdit.initialRect,
            w: Math.max(1, nextColumn - activeLayoutEdit.initialRect.x + 1),
            h: Math.max(2, nextRow - activeLayoutEdit.initialRect.y + 1)
          }
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

  const beginPanelEdit =
    (panelId: WorkspacePanelId, mode: LayoutEditMode) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!effectiveLayoutMode || !workspaceRef.current) {
        return;
      }

      event.preventDefault();

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
        initialRect: workspaceLayout.panels[panelId]
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
          : {
              ...currentRect,
              w: currentRect.w + deltaX,
              h: currentRect.h + deltaY
            };

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

  const handleResetSettings = () => {
    const nextSettings = resetAppSettings();
    setSettings(nextSettings);
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

  const handleStoryPanelRectChange = (
    panelId: StoryPanelSectionId,
    nextRect: StoryPanelSectionRect
  ) => {
    setStoryPanelLayout((currentLayout) =>
      updateStoryPanelRect({
        layoutState: currentLayout,
        panelId,
        nextRect
      })
    );
  };

  const renderPanelTools = (extraActions?: ReactNode) => {
    if (!effectiveLayoutMode && !extraActions) {
      return undefined;
    }

    return (
      <div className="panel-toolbar">
        {extraActions}
      </div>
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
                {pageOptions.map(({ value, label }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <TabsTrigger value={value} className="page-switcher__trigger">
                        {label}
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={8}>
                      {getPageCaption(value)}
                    </TooltipContent>
                  </Tooltip>
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
              settings={settings}
              onOpenChange={setIsMenuOpen}
              onResetSettings={handleResetSettings}
              onThemeChange={handleThemeChange}
              onDefaultViewModeChange={handleDefaultViewModeChange}
              onBooleanSettingChange={handleBooleanSettingChange}
            />
          </div>

          <div className="app-header__status">
            {page === "match" || hasActiveGame ? (
              <div className="app-header__status-grid">
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Turn</span>
                  <strong className="app-header__status-value">{turnLabel(status.turn)}</strong>
                </div>
                <div className="app-header__status-card">
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
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Mode</span>
                  <strong className="app-header__status-value">
                    {isStudyMode ? "Study replay" : "Local play"}
                  </strong>
                </div>
                <div className="app-header__status-card">
                  <span className="app-header__status-label">Tone</span>
                  <strong className="app-header__status-value">{toneLabel(tonePreset)}</strong>
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
          onToggleLayoutMode={() => setIsLayoutMode(false)}
          onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
        />
      ) : page === "classics" ? (
        <ClassicGamesLibraryPage
          referenceGames={referenceGamesLibrary}
          selectedReferenceGameId={selectedReferenceGameId}
          layoutMode={effectiveLayoutMode}
          showLayoutGrid={settings.showLayoutGrid}
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
          onToggleLayoutMode={() => setIsLayoutMode(false)}
          onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
        />
      ) : (
        <div className={`workspace-layout-shell ${effectiveLayoutMode ? "workspace-layout-shell--editing" : ""}`}>
          {effectiveLayoutMode && page === "match" ? (
            <aside className="workspace-layout-shell__sidebar">
              <LayoutToolbar
                columnCount={workspaceLayout.columnCount}
                columnGap={workspaceLayout.columnGap}
                rowHeight={workspaceLayout.rowHeight}
                showLayoutGrid={settings.showLayoutGrid}
                layoutFileName={layoutFileName}
                layoutDirectoryName={layoutDirectoryName}
                layoutFileNotice={layoutFileNotice}
                isLayoutDirectorySupported={isLayoutDirectorySupported}
                layoutFileBusyAction={layoutFileBusyAction}
                knownLayoutFiles={knownLayoutFiles}
                onToggleLayoutMode={() => setIsLayoutMode(false)}
                onColumnCountChange={handleWorkspaceColumnCountChange}
                onColumnGapChange={handleWorkspaceColumnGapChange}
                onRowHeightChange={handleWorkspaceRowHeightChange}
                onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
                onLayoutFileNameChange={setLayoutFileName}
                onConnectLayoutDirectory={handleConnectLayoutDirectory}
                onLoadLayoutFile={handleLoadLayoutFile}
                onSaveLayoutFile={handleSaveLayoutFile}
                onDeleteLayoutFile={handleDeleteLayoutFile}
                onSelectKnownLayoutFile={setLayoutFileName}
                onResetLayout={handleResetLayout}
              />
            </aside>
          ) : null}

          <main
            ref={workspaceRef}
            className={`workspace-grid ${useFreeformWorkspaceLayout ? "workspace-grid--freeform" : ""} ${effectiveLayoutMode ? "workspace-grid--layout-mode" : ""}`}
            style={workspaceGridStyle}
          >
            {!isCompactViewport ? (
              <div
                className="workspace-grid__sizer"
                style={{
                  gridColumn: "1 / -1",
                  gridRow: `1 / span ${workspaceRowCount}`
                }}
                aria-hidden="true"
              />
            ) : null}

            {effectiveLayoutMode && settings.showLayoutGrid && !isCompactViewport ? (
              <div
                className="workspace-grid__overlay"
                style={{ gridTemplateRows: `repeat(${workspaceRowCount}, var(--workspace-row-height))` }}
                aria-hidden="true"
              >
                {gridOverlayCells.map((cellIndex) => (
                  <span key={cellIndex} className="workspace-grid__overlay-cell" />
                ))}
              </div>
            ) : null}

            <div
              className={[
                "workspace-item",
                "workspace-item--board",
                activeLayoutEdit?.panelId === "board" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(
                workspaceLayout,
                "board",
                isCompactViewport,
                useFreeformWorkspaceLayout
              )}
            >
              <Card className="board-panel" size="sm">
                <CardHeader className="board-panel__header">
                  <div>
                    <CardTitle>{isStudyMode ? "Study replay board" : "Board"}</CardTitle>
                  </div>
                  <div className="board-panel__meta">
                    <span className="side-pill">Edinburgh</span>
                  </div>
                </CardHeader>

                <CardContent className="board-panel__content">
                  <Board
                    snapshot={snapshot}
                    cells={boardSquares}
                    selectedSquare={selectedSquare}
                    hoveredSquare={hoveredSquare}
                    inspectedSquare={inspectedSquare}
                    legalMoves={legalMoves}
                    viewMode="board"
                    districtsBySquare={edinburghDistrictsBySquare}
                    showCoordinates={settings.showBoardCoordinates}
                    showDistrictLabels={false}
                    onSquareClick={handleSquareClick}
                    onSquareHover={setHoveredSquare}
                    onSquareLeave={() => setHoveredSquare(null)}
                  />
                </CardContent>
              </Card>

              {renderMoveSurface("board")}
              {renderResizeHandle("board")}
            </div>

            <div
              className={[
                "workspace-item",
                "workspace-item--moves",
                activeLayoutEdit?.panelId === "moves" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(
                workspaceLayout,
                "moves",
                isCompactViewport,
                useFreeformWorkspaceLayout
              )}
            >
              <MatchHistoryPanel
                moves={moveHistory}
                characters={snapshot.characters}
                selectedPly={selectedPly}
                totalPlies={totalPlies}
                collapsed={workspaceLayout.collapsed.moves}
                onToggleCollapse={() => handleTogglePanelCollapse("moves")}
                onJumpToStart={jumpToStart}
                onStepBackward={stepBackward}
                onStepForward={stepForward}
                onJumpToEnd={jumpToEnd}
                onSelectPly={goToPly}
              />
              {renderMoveSurface("moves")}
              {renderResizeHandle("moves")}
            </div>

            <div
              className={[
                "workspace-item",
                "workspace-item--narrative",
                activeLayoutEdit?.panelId === "narrative" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(
                workspaceLayout,
                "narrative",
                isCompactViewport,
                useFreeformWorkspaceLayout
              )}
            >
              <StoryPanel
                collapsed={workspaceLayout.collapsed.narrative}
                onToggleCollapse={() => handleTogglePanelCollapse("narrative")}
                selectedMove={selectedMove}
                selectedEvent={selectedEvent}
                focusedSquare={storyFocusedSquare}
                focusedSquareSummary={focusedSquareSummary}
                focusedDistrict={focusedDistrict}
                focusedPiece={focusedPiece}
                focusedCharacter={focusedCharacter}
                focusedCharacterMoments={focusedCharacterMoments}
                showRecentCharacterActions={settings.showRecentCharacterActions}
                layoutState={storyPanelLayout}
                layoutMode={effectiveLayoutMode}
                parentColumnGap={workspaceLayout.columnGap}
                parentRowHeight={workspaceLayout.rowHeight}
                onLayoutRectChange={handleStoryPanelRectChange}
                tonePreset={tonePreset}
                onToneChange={updateTonePreset}
              />
              {renderMoveSurface("narrative")}
              {renderResizeHandle("narrative")}
            </div>

            <div
              className={[
                "workspace-item",
                "workspace-item--saved",
                activeLayoutEdit?.panelId === "saved" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(
                workspaceLayout,
                "saved",
                isCompactViewport,
                useFreeformWorkspaceLayout
              )}
            >
              <Panel
                title="Saved Matches"
                collapsed={workspaceLayout.collapsed.saved}
                action={renderPanelTools(
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => saveCurrentMatch()}
                    disabled={!canSave}
                    aria-label="Save current match"
                  >
                    <Save />
                  </Button>
                )}
                onToggleCollapse={() => handleTogglePanelCollapse("saved")}
              >
                {savedMatches.length ? (
                  <div className="saved-match-list">
                    {savedMatches.map((savedMatch) => (
                      <article key={savedMatch.id} className="saved-match">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="saved-match__icon-button saved-match__icon-button--destructive"
                          onClick={() => removeSavedMatch(savedMatch.id)}
                          aria-label={`Delete saved match ${savedMatch.name}`}
                        >
                          <Trash2 />
                        </Button>
                        <div className="saved-match__summary">
                          <h3 className="saved-match__title">{savedMatch.name}</h3>
                          <p className="saved-match__meta">
                            {formatSavedAt(savedMatch.savedAt)} | {savedMatch.moveCount} moves
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="saved-match__icon-button saved-match__icon-button--load"
                          onClick={() => loadSavedMatch(savedMatch.id)}
                          aria-label={`Load saved match ${savedMatch.name}`}
                        >
                          <FolderOpen />
                        </Button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    {isStudyMode
                      ? "Local save is disabled in study mode. Resume local play to save a match."
                      : "No saved matches yet. Save the current local game to keep your place."}
                  </p>
                )}
              </Panel>
              {renderMoveSurface("saved")}
              {renderResizeHandle("saved")}
            </div>

            <div
              className={[
                "workspace-item",
                "workspace-item--study",
                activeLayoutEdit?.panelId === "study" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(
                workspaceLayout,
                "study",
                isCompactViewport,
                useFreeformWorkspaceLayout
              )}
            >
              <Panel
                title="Study Games"
                collapsed={workspaceLayout.collapsed.study}
                action={renderPanelTools()}
                onToggleCollapse={() => handleTogglePanelCollapse("study")}
                >
                  <StudyPanel
                    referenceGames={referenceGamesLibrary}
                    selectedReferenceGameId={selectedReferenceGameId}
                    onSelectReferenceGame={setSelectedReferenceGameId}
                    onLoadReferenceGame={handleLoadReferenceGame}
                  studySession={studySession}
                  canStepBackward={canStepBackward}
                  canStepForward={canStepForward}
                  onJumpToStart={jumpToStart}
                  onStepBackward={stepBackward}
                  onStepForward={stepForward}
                  onJumpToEnd={jumpToEnd}
                  onExitStudy={exitStudyMode}
                  embedded
                />
              </Panel>
              {renderMoveSurface("study")}
              {renderResizeHandle("study")}
            </div>

          </main>
        </div>
      )}
    </div>
  );
}
