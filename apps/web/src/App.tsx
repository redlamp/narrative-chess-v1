import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from "react";
import { Moon, Sun } from "lucide-react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { PieceKind, Square } from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  expandAllWorkspacePanels,
  getSnappedWorkspaceColumn,
  getSnappedWorkspaceRow,
  getWorkspaceGridUnitFractions,
  getWorkspaceLayoutRowCount,
  getWorkspacePanelRenderHeight,
  listWorkspaceLayoutState,
  resetWorkspaceLayoutState,
  saveWorkspaceLayoutState,
  setWorkspacePanelCollapsed,
  updateWorkspaceColumnFraction,
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
import { referenceGames } from "./referenceGames";
import {
  connectWorkspaceLayoutDirectory,
  getConnectedWorkspaceLayoutDirectoryName,
  loadWorkspaceLayoutFileFromDirectory,
  saveWorkspaceLayoutFileToDirectory,
  supportsWorkspaceLayoutDirectory
} from "./fileSystemAccess";
import { Board } from "./components/Board";
import { Panel } from "./components/Panel";
import { AppMenu } from "./components/AppMenu";
import { ClassicGamesLibraryPage } from "./components/ClassicGamesLibraryPage";
import { CompetitiveLandscapePage } from "./components/CompetitiveLandscapePage";
import { EdinburghReviewPage } from "./components/EdinburghReviewPage";
import { LayoutToolbar } from "./components/LayoutToolbar";
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
  moves: "Move History",
  narrative: "Narrative Log",
  saved: "Saved Matches",
  study: "Study Games",
  status: "Match State"
};

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

function getWorkspaceGridStyle(layoutState: WorkspaceLayoutState): CSSProperties {
  const [columnOneUnit, columnTwoUnit, columnThreeUnit] = getWorkspaceGridUnitFractions(
    layoutState.columnFractions
  );

  return {
    "--workspace-col-1-unit": `${columnOneUnit}fr`,
    "--workspace-col-2-unit": `${columnTwoUnit}fr`,
    "--workspace-col-3-unit": `${columnThreeUnit}fr`,
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
  const [selectedReferenceGameId, setSelectedReferenceGameId] = useState(referenceGames[0]?.id ?? "");
  const [pastedPgn, setPastedPgn] = useState("");
  const [settings, setSettings] = useState<AppSettings>(() => listAppSettings());
  const [viewMode, setViewMode] = useState<"board" | "map">(() => listAppSettings().defaultViewMode);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLayoutMode, setIsLayoutMode] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [roleCatalog, setRoleCatalog] = useState(() => listRoleCatalog());
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
  const eventByMoveId = new Map(snapshot.eventHistory.map((event) => [event.moveId, event] as const));
  const moveById = new Map(snapshot.moveHistory.map((move) => [move.id, move] as const));
  const focusedSquare = hoveredSquare ?? selectedSquare ?? (lastMove?.to ?? null);
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
    referenceGames.find((game) => game.id === selectedReferenceGameId) ?? referenceGames[0] ?? null;
  const effectiveLayoutMode = isLayoutMode && !isCompactViewport && page === "match";
  const workspaceRowCount = useMemo(
    () => getWorkspaceLayoutRowCount(workspaceLayout),
    [workspaceLayout]
  );
  const workspaceGridStyle = useMemo(
    () => getWorkspaceGridStyle(workspaceLayout),
    [workspaceLayout]
  );
  const gridOverlayCells = useMemo(
    () => Array.from({ length: workspaceRowCount * 12 }, (_, index) => index),
    [workspaceRowCount]
  );

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
    saveAppSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveWorkspaceLayoutState(workspaceLayout);
  }, [workspaceLayout]);

  useEffect(() => {
    setIsLayoutDirectorySupported(supportsWorkspaceLayoutDirectory());

    const rememberedLayoutFiles = listKnownWorkspaceLayoutFiles();
    if (rememberedLayoutFiles.length) {
      setKnownLayoutFiles(rememberedLayoutFiles);
      setLayoutFileName((current) => current || rememberedLayoutFiles[0]?.name || "match-workspace");
    }

    let cancelled = false;

    void getConnectedWorkspaceLayoutDirectoryName().then((directoryName) => {
      if (!cancelled) {
        setLayoutDirectoryName(directoryName);
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
        columnFractions: workspaceLayout.columnFractions
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
    workspaceLayout.columnFractions,
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
        columnFractions: workspaceLayout.columnFractions
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

  const handleLoadReferenceGame = () => {
    if (!selectedReferenceGame) {
      return;
    }

    loadReferenceGame(selectedReferenceGame);
  };

  const handleLoadReferenceGameFromLibrary = () => {
    if (!selectedReferenceGame) {
      return;
    }

    loadReferenceGame(selectedReferenceGame);
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

  const handleTogglePanelCollapse = (panelId: CollapsibleWorkspacePanelId) => {
    setWorkspaceLayout((currentLayout) =>
      setWorkspacePanelCollapsed({
        layoutState: currentLayout,
        panelId,
        collapsed: !currentLayout.collapsed[panelId]
      })
    );
  };

  const handleWorkspaceColumnFractionChange = (index: 0 | 1 | 2, value: number) => {
    setWorkspaceLayout((currentLayout) =>
      updateWorkspaceColumnFraction({
        layoutState: currentLayout,
        index,
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

  const handleExpandPanels = () => {
    setWorkspaceLayout((currentLayout) => expandAllWorkspacePanels(currentLayout));
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

  const renderPanelTools = (
    panelId: CollapsibleWorkspacePanelId,
    extraActions?: ReactNode
  ) => {
    if (!effectiveLayoutMode && !extraActions) {
      return undefined;
    }

    return (
      <div className="panel-toolbar">
        {extraActions}
        {effectiveLayoutMode ? (
          <button
            type="button"
            className="button button--ghost button--icon"
            onPointerDown={beginPanelEdit(panelId, "move")}
            aria-label={`Move ${panelTitles[panelId]} panel`}
          >
            Move
          </button>
        ) : null}
      </div>
    );
  };

  const renderResizeHandle = (panelId: WorkspacePanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__resize-handle"
        onPointerDown={beginPanelEdit(panelId, "resize")}
        aria-label={`Resize ${panelTitles[panelId]} panel`}
      >
        <span />
      </button>
    ) : null;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__brand">
          <div>
            <h1>Narrative Chess</h1>
          </div>

          <div className="app-header__actions">
            <Button
              type="button"
              variant={effectiveLayoutMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsLayoutMode((current) => !current)}
              disabled={page !== "match" || isCompactViewport}
            >
              {effectiveLayoutMode ? "Exit layout" : "Edit layout"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleThemeChange(settings.theme === "dark" ? "light" : "dark")}
            >
              {settings.theme === "dark" ? (
                <Sun data-icon="inline-start" />
              ) : (
                <Moon data-icon="inline-start" />
              )}
              {settings.theme === "dark" ? "Light theme" : "Dark theme"}
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

            <Tabs
              value={page}
              onValueChange={(value) => setPage(value as AppPage)}
              className="page-switcher-tabs"
            >
              <TabsList className="page-switcher">
                <TabsTrigger value="match">Match</TabsTrigger>
                <TabsTrigger value="classics">Classics</TabsTrigger>
                <TabsTrigger value="cities">Cities</TabsTrigger>
                <TabsTrigger value="roles">Role Catalog</TabsTrigger>
                <TabsTrigger value="research">Research</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {page === "match" ? (
          <div className="hero__status app-header__status">
            <div className="status-card">
              <span className="status-card__label">Turn</span>
              <span className="status-card__value">{turnLabel(status.turn)}</span>
            </div>
            <div className="status-card">
              <span className="status-card__label">State</span>
              <span className="status-card__value">
                {statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}
              </span>
            </div>
            <div className="status-card">
              <span className="status-card__label">Moves</span>
              <span className="status-card__value">{snapshot.moveHistory.length}</span>
            </div>
            <div className="status-card">
              <span className="status-card__label">Tone</span>
              <span className="status-card__value">{toneLabel(tonePreset)}</span>
            </div>
          </div>
        ) : (
          <div className="app-header__context">
            <p className="muted">
              {page === "cities"
                ? "Review gathered city boards, switch between cities and districts, and save updates locally."
                : page === "classics"
                ? "Review classic games, historical notes, and the study score before loading a line onto the board."
                : page === "roles"
                ? "Edit individual piece-role records and feed those changes back into the local roster."
                : "Review current chess product references, screenshots, and notes for competitive analysis."}
            </p>
          </div>
        )}
      </header>

      {page === "cities" ? (
        <EdinburghReviewPage />
      ) : page === "classics" ? (
        <ClassicGamesLibraryPage
          referenceGames={referenceGames}
          selectedReferenceGameId={selectedReferenceGameId}
          onSelectReferenceGame={setSelectedReferenceGameId}
          onLoadReferenceGame={handleLoadReferenceGameFromLibrary}
        />
      ) : page === "roles" ? (
        <RoleCatalogPage
          roleCatalog={roleCatalog}
          onRoleCatalogChange={handleRoleCatalogChange}
          onRoleCatalogReset={handleRoleCatalogReset}
          onRoleCatalogAdd={handleRoleCatalogAdd}
          onRoleCatalogDuplicate={handleRoleCatalogDuplicate}
          onRoleCatalogRemove={handleRoleCatalogRemove}
        />
      ) : page === "research" ? (
        <CompetitiveLandscapePage />
      ) : (
        <div className={`workspace-layout-shell ${effectiveLayoutMode ? "workspace-layout-shell--editing" : ""}`}>
          {effectiveLayoutMode ? (
            <aside className="workspace-layout-shell__sidebar">
              <LayoutToolbar
                columnFractions={workspaceLayout.columnFractions}
                rowHeight={workspaceLayout.rowHeight}
                showLayoutGrid={settings.showLayoutGrid}
                layoutFileName={layoutFileName}
                layoutDirectoryName={layoutDirectoryName}
                layoutFileNotice={layoutFileNotice}
                isLayoutDirectorySupported={isLayoutDirectorySupported}
                layoutFileBusyAction={layoutFileBusyAction}
                knownLayoutFiles={knownLayoutFiles}
                onToggleLayoutMode={() => setIsLayoutMode(false)}
                onExpandPanels={handleExpandPanels}
                onColumnFractionChange={handleWorkspaceColumnFractionChange}
                onRowHeightChange={handleWorkspaceRowHeightChange}
                onToggleLayoutGrid={(checked) => handleBooleanSettingChange("showLayoutGrid", checked)}
                onLayoutFileNameChange={setLayoutFileName}
                onConnectLayoutDirectory={handleConnectLayoutDirectory}
                onLoadLayoutFile={handleLoadLayoutFile}
                onSaveLayoutFile={handleSaveLayoutFile}
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
                  {effectiveLayoutMode ? (
                    <button
                      type="button"
                      className="button button--ghost button--icon"
                      onPointerDown={beginPanelEdit("board", "move")}
                    >
                      Move
                    </button>
                  ) : null}
                </div>
              </div>

              <Board
                snapshot={snapshot}
                cells={boardSquares}
                selectedSquare={selectedSquare}
                hoveredSquare={hoveredSquare}
                legalMoves={legalMoves}
                viewMode={viewMode}
                districtsBySquare={edinburghDistrictsBySquare}
                showCoordinates={settings.showBoardCoordinates}
                showDistrictLabels={viewMode === "map" && settings.showDistrictLabels}
                onSquareClick={handleSquareClick}
                onSquareHover={setHoveredSquare}
                onSquareLeave={() => setHoveredSquare(null)}
              />

              <div className="board-panel__footer" role="status" aria-live="polite">
                <p>
                  {focusedSquare
                    ? `Focused ${focusedSquare}`
                    : "Hover any square for city and character context, or click a piece to move."}
                </p>
                {lastMove ? <p>Last move: {lastMove.san}</p> : <p>No moves yet.</p>}
              </div>

              <div className="hover-panel">
                <div className="hover-card">
                  <p className="field-label">City Tile</p>
                  {focusedDistrict ? (
                    <div className="detail-card">
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
                    </div>
                  ) : (
                    <p className="muted">Hover a square to inspect the mapped district.</p>
                  )}
                </div>

                <div className="hover-card">
                  <p className="field-label">Character on Tile</p>
                  {focusedCharacter && focusedPiece ? (
                    <div className="detail-card">
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
                      <p className="detail-card__description">{focusedCharacter.oneLineDescription}</p>
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
                    </div>
                  ) : focusedSquare ? (
                    <p className="muted">No active piece is standing on this tile right now.</p>
                  ) : (
                    <p className="muted">Hover a square to inspect the piece standing there.</p>
                  )}
                </div>
              </div>

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
                title="Move History"
                eyebrow="Rules"
                collapsed={workspaceLayout.collapsed.moves}
                action={renderPanelTools("moves")}
                onToggleCollapse={() => handleTogglePanelCollapse("moves")}
              >
                <div className="timeline timeline--match-log">
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
                            <p className="timeline__link">Story beat: {linkedEvent.headline}</p>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <p className="muted">The game log will appear here as soon as the first move lands.</p>
                  )}
                </div>
              </Panel>
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
                title="Narrative Log"
                eyebrow="Story"
                collapsed={workspaceLayout.collapsed.narrative}
                action={renderPanelTools(
                  "narrative",
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
                )}
                onToggleCollapse={() => handleTogglePanelCollapse("narrative")}
              >
                <div className="timeline timeline--narrative">
                  {narrativeHistory.length ? (
                    narrativeHistory.map((event) => {
                      const linkedMove = moveById.get(event.moveId) ?? null;

                      return (
                        <article key={event.id} className="timeline__item timeline__item--narrative">
                          <div className="timeline__meta">
                            <span className="timeline__turn">Move {event.moveNumber}</span>
                            <span className="timeline__san">{event.eventType}</span>
                          </div>
                          <h3 className="timeline__headline">{event.headline}</h3>
                          <p className="timeline__text">{event.detail}</p>
                          {linkedMove ? (
                            <p className="timeline__link">
                              Board action: {linkedMove.san} | {linkedMove.from} to {linkedMove.to}
                            </p>
                          ) : null}
                        </article>
                      );
                    })
                  ) : (
                    <p className="muted">Each move will add a lightweight narrative beat here.</p>
                  )}
                </div>
              </Panel>
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
                  "saved",
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
                action={renderPanelTools("study")}
                onToggleCollapse={() => handleTogglePanelCollapse("study")}
              >
                <StudyPanel
                  referenceGames={referenceGames}
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
                action={renderPanelTools("status")}
                onToggleCollapse={() => handleTogglePanelCollapse("status")}
              >
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
              </Panel>
              {renderResizeHandle("status")}
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
