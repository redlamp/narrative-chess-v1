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
import { LayoutDashboard, Moon, Sun } from "lucide-react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { PieceKind, Square } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
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
import { getPieceDisplayName, getPieceGlyph, getPieceKindLabel } from "./chessPresentation";
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
import { EdinburghReviewPage } from "./components/EdinburghReviewPage";
import { LayoutToolbar } from "./components/LayoutToolbar";
import { ResearchPage } from "./components/ResearchPage";
import { RoleCatalogPage } from "./components/RoleCatalogPage";
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

type AppPage = "match" | "classics" | "cities" | "roles" | "research";
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
  moves: "Match Ledger",
  narrative: "Board Inspector",
  saved: "Saved Matches",
  study: "Study Games",
  status: "Match State"
};

const pageOptions: Array<{ value: AppPage; label: string }> = [
  { value: "match", label: "Play" },
  { value: "cities", label: "Cities" },
  { value: "roles", label: "Characters" },
  { value: "classics", label: "Classics" },
  { value: "research", label: "Research" }
];

function isAppPage(value: string | null): value is AppPage {
  return (
    value === "match" ||
    value === "classics" ||
    value === "cities" ||
    value === "roles" ||
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
      return "Study classic games and their key lines.";
    case "roles":
      return "Edit piece roles and roster flavor.";
    case "research":
      return "Review references, assets, and style notes.";
    default:
      return "Keep the board central and inspect moves in context.";
  }
}

function getWorkspaceGridStyle(layoutState: WorkspaceLayoutState): CSSProperties {
  return {
    "--workspace-column-count": String(layoutState.columnCount),
    "--workspace-column-gap": `${layoutState.columnGap}px`,
    "--workspace-row-height": `${layoutState.rowHeight}px`
  } as CSSProperties;
}

function getWorkspacePanelStyle(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId,
  isCompactViewport: boolean
): CSSProperties | undefined {
  if (isCompactViewport) {
    return undefined;
  }

  const panel = layoutState.panels[panelId];

  return {
    gridColumn: `${panel.x} / span ${panel.w}`,
    gridRow: `${panel.y} / span ${getWorkspacePanelRenderHeight(layoutState, panelId)}`
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
  const [pastedPgn, setPastedPgn] = useState("");
  const [settings, setSettings] = useState<AppSettings>(() => listAppSettings());
  const [viewMode, setViewMode] = useState<"board" | "map">(() => listAppSettings().defaultViewMode);
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
    boardSquares,
    selectedSquare,
    savedMatches,
    legalMoves,
    canSave,
    canUndo,
    isStudyMode,
    tonePreset,
    studySession,
    canStepBackward,
    canStepForward,
    importError,
    lastMove,
    handleSquareClick,
    handleUndo,
    loadReferenceGame,
    loadPgnStudy,
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
  const moveHistory = [...snapshot.moveHistory].reverse();
  const narrativeHistory = [...snapshot.eventHistory].reverse();
  const latestNarrativeEvent = narrativeHistory[0] ?? null;
  const eventByMoveId = new Map(snapshot.eventHistory.map((event) => [event.moveId, event] as const));
  const moveById = new Map(snapshot.moveHistory.map((move) => [move.id, move] as const));
  const focusedSquare = hoveredSquare ?? inspectedSquare ?? selectedSquare ?? (lastMove?.to ?? null);
  const focusedDistrict = getDistrictForSquare(focusedSquare);
  const focusedPiece = focusedSquare ? getPieceAtSquare(snapshot, focusedSquare) : null;
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
  const hasActiveGame = isStudyMode || snapshot.moveHistory.length > 0;
  const effectiveLayoutMode = isLayoutMode && !isCompactViewport;
  const workspaceRowCount = useMemo(
    () => getWorkspaceLayoutRowCount(workspaceLayout),
    [workspaceLayout]
  );
  const workspaceGridStyle = useMemo(
    () => getWorkspaceGridStyle(workspaceLayout),
    [workspaceLayout]
  );
  const focusedSquareSummary = focusedSquare
    ? (() => {
        const squareParts = [`Inspecting ${focusedSquare}`];
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
    : "Hover or focus a square to inspect it. The last inspected square stays pinned until you pick another square.";
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
        columnCount: workspaceLayout.columnCount
      });
      const nextRow = getSnappedWorkspaceRow({
        offsetY: event.clientY - rect.top,
        rowHeight: workspaceLayout.rowHeight
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
        columnCount: workspaceLayout.columnCount
      });
      const originRow = getSnappedWorkspaceRow({
        offsetY: event.clientY - rect.top,
        rowHeight: workspaceLayout.rowHeight
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

  const handleImportPgn = () => {
    if (!pastedPgn.trim()) {
      return;
    }

    loadPgnStudy(pastedPgn);
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
    setViewMode(nextSettings.defaultViewMode);
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
    setViewMode(nextViewMode);
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
                    {snapshot.moveHistory.length}
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
      ) : page === "research" ? (
        <ResearchPage
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
            className={`workspace-grid ${effectiveLayoutMode ? "workspace-grid--layout-mode" : ""}`}
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

            <section
              className={[
                "workspace-item",
                "workspace-item--board",
                "board-panel",
                activeLayoutEdit?.panelId === "board" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(workspaceLayout, "board", isCompactViewport)}
            >
              <div className="board-panel__header">
                <div>
                  <p className="section-eyebrow">Board</p>
                  <h2>{isStudyMode ? "Study replay board" : "Edinburgh play surface"}</h2>
                </div>
                <div className="board-panel__actions">
                  <button
                    type="button"
                    className={`button button--ghost ${viewMode === "board" ? "button--active" : ""}`}
                    onClick={() => setViewMode("board")}
                  >
                    Board
                  </button>
                  <button
                    type="button"
                    className={`button button--ghost ${viewMode === "map" ? "button--active" : ""}`}
                    onClick={() => setViewMode("map")}
                  >
                    Map
                  </button>
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={handleUndo}
                    disabled={!canUndo}
                  >
                    {isStudyMode ? "Undo disabled" : "Undo"}
                  </button>
                </div>
              </div>

              <Board
                snapshot={snapshot}
                cells={boardSquares}
                selectedSquare={selectedSquare}
                hoveredSquare={hoveredSquare}
                inspectedSquare={inspectedSquare}
                legalMoves={legalMoves}
                viewMode={viewMode}
                districtsBySquare={edinburghDistrictsBySquare}
                showCoordinates={settings.showBoardCoordinates}
                showDistrictLabels={viewMode === "map" && settings.showDistrictLabels}
                onSquareClick={handleSquareClick}
                onSquareHover={setHoveredSquare}
                onSquareLeave={() => setHoveredSquare(null)}
              />

              <div className="board-panel__footer" role="status" aria-live="polite" aria-atomic="true">
                <p>{focusedSquareSummary}</p>
                {lastMove ? <p>Last move: {lastMove.san}</p> : <p>No moves yet.</p>}
              </div>

              {renderMoveSurface("board")}
              {renderResizeHandle("board")}
            </section>

            <div
              className={[
                "workspace-item",
                "workspace-item--moves",
                activeLayoutEdit?.panelId === "moves" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(workspaceLayout, "moves", isCompactViewport)}
            >
              <Panel
                title="Match Ledger"
                eyebrow="Board + story"
                collapsed={workspaceLayout.collapsed.moves}
                action={renderPanelTools()}
                onToggleCollapse={() => handleTogglePanelCollapse("moves")}
              >
                <div className="timeline timeline--match-ledger">
                  {moveHistory.length ? (
                    moveHistory.map((move) => {
                      const linkedEvent = eventByMoveId.get(move.id) ?? null;

                      return (
                        <article key={move.id} className="timeline__item timeline__item--move">
                          <div className="timeline__meta">
                            <span className="timeline__turn">
                              {move.moveNumber}. {move.side}
                            </span>
                            <span className="timeline__san">{move.san}</span>
                          </div>
                          <p className="timeline__text">
                            {move.from} to {move.to}
                            {move.isCheckmate ? " with checkmate" : move.isCheck ? " with check" : ""}
                            {move.capturedPieceId ? " and a capture" : ""}
                          </p>
                          {linkedEvent ? (
                            <>
                              <h3 className="timeline__headline">{linkedEvent.headline}</h3>
                              <p className="timeline__text">{linkedEvent.detail}</p>
                              <p className="timeline__link">
                                Story beat: {linkedEvent.eventType} on {linkedEvent.location}
                              </p>
                            </>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <p className="muted">The game log will appear here as soon as the first move lands.</p>
                  )}
                </div>
              </Panel>
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
              style={getWorkspacePanelStyle(workspaceLayout, "narrative", isCompactViewport)}
            >
              <Panel
                title="Board Inspector"
                eyebrow="Context"
                collapsed={workspaceLayout.collapsed.narrative}
                action={renderPanelTools()}
                onToggleCollapse={() => handleTogglePanelCollapse("narrative")}
              >
                <div className="board-inspector">
                  <p className="muted">{focusedSquareSummary}</p>

                  <div className="detail-card">
                    <p className="field-label">City tile</p>
                    {focusedDistrict ? (
                      <>
                        <div className="detail-card__title-row">
                          <h3>{focusedDistrict.name}</h3>
                          <span className="side-pill side-pill--white">{focusedDistrict.square}</span>
                        </div>
                        <p className="detail-card__description">
                          {focusedDistrict.locality} | {focusedDistrict.dayProfile}
                        </p>
                        <div className="chip-row">
                          {focusedDistrict.descriptors.map((descriptor) => (
                            <span key={descriptor} className="chip">
                              {descriptor}
                            </span>
                          ))}
                        </div>
                        <div className="chip-row">
                          {focusedDistrict.landmarks.map((landmark) => (
                            <span key={landmark} className="chip chip--soft">
                              {landmark}
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="muted">Hover or focus a square to inspect the mapped district.</p>
                    )}
                  </div>

                  <div className="detail-card">
                    <p className="field-label">Character on tile</p>
                    {focusedCharacter && focusedPiece ? (
                      <>
                        <div className="piece-badge">
                          <span className={`piece-badge__icon piece-badge__icon--${focusedPiece.side}`}>
                            {getPieceGlyph({ side: focusedPiece.side, kind: focusedPiece.kind })}
                          </span>
                          <div>
                            <p className="piece-badge__label">
                              {getPieceDisplayName({ side: focusedPiece.side, kind: focusedPiece.kind })}
                            </p>
                            <p className="muted">{getPieceKindLabel(focusedPiece.kind)} piece</p>
                          </div>
                        </div>
                        <h3>{focusedCharacter.fullName}</h3>
                        <p className="detail-card__description">
                          {focusedCharacter.oneLineDescription}
                        </p>
                        <dl className="detail-grid">
                          <div>
                            <dt>Role</dt>
                            <dd>{focusedCharacter.role}</dd>
                          </div>
                          <div>
                            <dt>Origin</dt>
                            <dd>{focusedCharacter.districtOfOrigin}</dd>
                          </div>
                          <div>
                            <dt>Faction</dt>
                            <dd>{focusedCharacter.faction}</dd>
                          </div>
                          <div>
                            <dt>Square</dt>
                            <dd>{focusedSquare ?? "None"}</dd>
                          </div>
                        </dl>
                        <div className="chip-row">
                          {focusedCharacter.traits.map((trait) => (
                            <span key={trait} className="chip">
                              {trait}
                            </span>
                          ))}
                        </div>
                        {settings.showRecentCharacterActions && focusedCharacterMoments.length ? (
                          <div className="memory-list">
                            <p className="memory-list__label">Recent actions</p>
                            {focusedCharacterMoments.map((event) => (
                              <article key={event.id} className="memory-item">
                                <span className="memory-item__meta">
                                  Move {event.moveNumber} | {event.eventType}
                                </span>
                                <p className="memory-item__headline">{event.headline}</p>
                              </article>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : focusedSquare ? (
                      <p className="muted">No active piece is standing on this tile right now.</p>
                    ) : (
                      <p className="muted">Hover a square to inspect the piece standing there.</p>
                    )}
                  </div>

                  <div className="detail-card">
                    <p className="field-label">Latest narrative beat</p>
                    {latestNarrativeEvent ? (
                      <>
                        <div className="detail-card__title-row">
                          <h3>{latestNarrativeEvent.headline}</h3>
                          <span className="side-pill">Move {latestNarrativeEvent.moveNumber}</span>
                        </div>
                        <p className="detail-card__description">{latestNarrativeEvent.detail}</p>
                        {moveById.get(latestNarrativeEvent.moveId) ? (
                          <p className="timeline__link">
                            Board action: {moveById.get(latestNarrativeEvent.moveId)?.san}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="muted">Each move will add a lightweight narrative beat here.</p>
                    )}
                  </div>
                </div>
              </Panel>
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
              style={getWorkspacePanelStyle(workspaceLayout, "saved", isCompactViewport)}
            >
              <Panel
                title="Saved Matches"
                eyebrow="Local"
                collapsed={workspaceLayout.collapsed.saved}
                action={renderPanelTools(
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => saveCurrentMatch()}
                    disabled={!canSave}
                  >
                    Save current match
                  </button>
                )}
                onToggleCollapse={() => handleTogglePanelCollapse("saved")}
              >
                {savedMatches.length ? (
                  <div className="saved-match-list">
                    {savedMatches.map((savedMatch) => (
                      <article key={savedMatch.id} className="saved-match">
                        <div>
                          <h3 className="saved-match__title">{savedMatch.name}</h3>
                          <p className="saved-match__meta">
                            {formatSavedAt(savedMatch.savedAt)} | {savedMatch.moveCount} moves
                          </p>
                        </div>
                        <div className="saved-match__actions">
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => loadSavedMatch(savedMatch.id)}
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            className="button button--ghost"
                            onClick={() => removeSavedMatch(savedMatch.id)}
                          >
                            Delete
                          </button>
                        </div>
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
              style={getWorkspacePanelStyle(workspaceLayout, "study", isCompactViewport)}
            >
              <Panel
                title="Study Games"
                eyebrow="Reference"
                collapsed={workspaceLayout.collapsed.study}
                action={renderPanelTools()}
                onToggleCollapse={() => handleTogglePanelCollapse("study")}
                >
                  <StudyPanel
                    referenceGames={referenceGamesLibrary}
                    selectedReferenceGameId={selectedReferenceGameId}
                    onSelectReferenceGame={setSelectedReferenceGameId}
                    onLoadReferenceGame={handleLoadReferenceGame}
                  pastedPgn={pastedPgn}
                  onPgnChange={setPastedPgn}
                  onImportPgn={handleImportPgn}
                  importError={importError}
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

            <div
              className={[
                "workspace-item",
                "workspace-item--status",
                activeLayoutEdit?.panelId === "status" ? "is-editing" : ""
              ]
                .filter(Boolean)
                .join(" ")}
              style={getWorkspacePanelStyle(workspaceLayout, "status", isCompactViewport)}
            >
              <Panel
                title="Match State"
                eyebrow="Status"
                collapsed={workspaceLayout.collapsed.status}
                action={renderPanelTools()}
                onToggleCollapse={() => handleTogglePanelCollapse("status")}
              >
                <div className="state-panel">
                  <div className="state-list">
                    <div className="state-list__row">
                      <span>Current turn</span>
                      <strong>{turnLabel(status.turn)}</strong>
                    </div>
                    <div className="state-list__row">
                      <span>Mode</span>
                      <strong>{isStudyMode ? "Study replay" : "Local play"}</strong>
                    </div>
                    <div className="state-list__row">
                      <span>Board state</span>
                      <strong>{statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}</strong>
                    </div>
                    <div className="state-list__row">
                      <span>Focused square</span>
                      <strong>{focusedSquare ?? "None"}</strong>
                    </div>
                    <div className="state-list__row">
                      <span>Legal targets</span>
                      <strong>{legalMoves.length}</strong>
                    </div>
                    <div className="state-list__row">
                      <span>Hovered district</span>
                      <strong>{focusedDistrict?.name ?? "None"}</strong>
                    </div>
                  </div>

                  <div className="state-panel__section">
                    <p className="field-label">Narrative tone</p>
                    <div className="tone-switcher">
                      <button
                        type="button"
                        className={`button button--ghost ${tonePreset === "grounded" ? "button--active" : ""}`}
                        onClick={() => updateTonePreset("grounded")}
                      >
                        Grounded
                      </button>
                      <button
                        type="button"
                        className={`button button--ghost ${tonePreset === "civic-noir" ? "button--active" : ""}`}
                        onClick={() => updateTonePreset("civic-noir")}
                      >
                        Civic noir
                      </button>
                      <button
                        type="button"
                        className={`button button--ghost ${tonePreset === "dark-comedy" ? "button--active" : ""}`}
                        onClick={() => updateTonePreset("dark-comedy")}
                      >
                        Dark comedy
                      </button>
                    </div>
                  </div>
                </div>
              </Panel>
              {renderMoveSurface("status")}
              {renderResizeHandle("status")}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
