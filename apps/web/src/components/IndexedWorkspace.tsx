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
import { Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { FloatingLayoutPanel } from "./FloatingLayoutPanel";
import { PageLayoutToolbar } from "./PageLayoutToolbar";
import {
  connectWorkspaceLayoutDirectory,
  deletePageLayoutFileFromDirectory,
  getConnectedWorkspaceLayoutDirectoryName,
  loadPageLayoutFileFromDirectory,
  savePageLayoutFileToDirectory,
  supportsWorkspaceLayoutDirectory
} from "../fileSystemAccess";
import { listKnownPageLayoutFiles, type PageLayoutFileReference } from "../pageLayoutFiles";
import {
  getDefaultPageLayoutState,
  getPageLayoutRowCount,
  getSnappedPageLayoutColumn,
  getSnappedPageLayoutRow,
  listPageLayoutState,
  pageLayoutPanelIds,
  resetPageLayoutState,
  restorePageLayoutPanel,
  savePageLayoutState,
  setPageLayoutPanelVisible,
  updatePageLayoutColumnCount,
  updatePageLayoutColumnGap,
  updatePageLayoutPanelRect,
  updatePageLayoutRowHeight,
  type PageLayoutPanelId,
  type PageLayoutRect,
  type PageLayoutState,
  type PageLayoutVariant
} from "../pageLayoutState";

type LayoutEditMode = "move" | "resize";

type ActivePageLayoutEdit = {
  panelId: PageLayoutPanelId;
  mode: LayoutEditMode;
  originColumn: number;
  originRow: number;
  initialRect: PageLayoutRect;
};

type IndexedWorkspaceProps = {
  intro: ReactNode;
  index: ReactNode;
  secondaryIndex?: ReactNode;
  detail: ReactNode;
  tertiary?: ReactNode;
  quaternary?: ReactNode;
  panelLabels?: Partial<Record<PageLayoutPanelId, string>>;
  className?: string;
  scrollMode?: "panel" | "page";
  layoutMode?: boolean;
  layoutKey?: string;
  layoutVariant?: PageLayoutVariant;
  showLayoutGrid?: boolean;
  onToggleLayoutMode?: () => void;
  onToggleLayoutGrid?: (checked: boolean) => void;
};

const panelLabels: Record<PageLayoutPanelId, string> = {
  intro: "Intro",
  index: "Primary column",
  secondary: "Secondary column",
  detail: "Detail column",
  tertiary: "Tertiary column",
  quaternary: "Quaternary column"
};

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type PanelSizeConstraint = {
  minW: number;
  maxW: number;
  minH: number;
  maxH: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function createDefaultPanelSizeConstraints(input: {
  maxWidth: number;
  maxHeight: number;
}) {
  const safeMaxWidth = Math.max(1, input.maxWidth);
  const safeMaxHeight = Math.max(1, input.maxHeight);

  return pageLayoutPanelIds.reduce((next, panelId) => {
    next[panelId] = {
      minW: 1,
      maxW: safeMaxWidth,
      minH: 1,
      maxH: safeMaxHeight
    };
    return next;
  }, {} as Record<PageLayoutPanelId, PanelSizeConstraint>);
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

function getDefaultLayoutFileName(layoutKey?: string) {
  if (!layoutKey) {
    return "page-layout";
  }

  return layoutKey.replace(/-page$/u, "") || "page-layout";
}

function getPageGridStyle(layoutState: PageLayoutState, rowCount: number): CSSProperties {
  return {
    "--workspace-column-count": String(layoutState.columnCount),
    "--workspace-column-gap": `${layoutState.columnGap}px`,
    "--workspace-row-height": `${layoutState.rowHeight}px`,
    "--workspace-row-count": String(rowCount)
  } as CSSProperties;
}

function getPagePanelStyle(layoutState: PageLayoutState, panelId: PageLayoutPanelId): CSSProperties {
  const panel = layoutState.panels[panelId];
  const area = panel.w * panel.h;
  const zIndex = Math.max(100, 6000 - area * 10 - panel.w - panel.h);
  const columnOffset = Math.max(0, panel.x - 1);
  const rowOffset = Math.max(0, panel.y - 1);

  return {
    left: `calc(((100% - (var(--workspace-column-gap) * (var(--workspace-column-count) - 1))) / var(--workspace-column-count) * ${columnOffset}) + (var(--workspace-column-gap) * ${columnOffset}))`,
    top: `calc((var(--workspace-row-height) * ${rowOffset}) + (var(--workspace-column-gap) * ${rowOffset}))`,
    width: `calc(((100% - (var(--workspace-column-gap) * (var(--workspace-column-count) - 1))) / var(--workspace-column-count) * ${panel.w}) + (var(--workspace-column-gap) * ${Math.max(panel.w - 1, 0)}))`,
    height: `calc((var(--workspace-row-height) * ${panel.h}) + (var(--workspace-column-gap) * ${Math.max(panel.h - 1, 0)}))`,
    zIndex
  };
}

export function IndexedWorkspace({
  intro,
  index,
  secondaryIndex,
  detail,
  tertiary,
  quaternary,
  panelLabels: panelLabelsOverride,
  className,
  scrollMode = "panel",
  layoutMode = false,
  layoutKey,
  layoutVariant,
  showLayoutGrid = false,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: IndexedWorkspaceProps) {
  const resolvedLayoutVariant = layoutVariant ?? (secondaryIndex ? "three-pane" : "two-pane");
  const resolvedPanelLabels = useMemo(
    () => ({
      ...panelLabels,
      ...panelLabelsOverride
    }),
    [panelLabelsOverride]
  );
  const activePanelIds = useMemo<PageLayoutPanelId[]>(
    () => {
      const nextIds: PageLayoutPanelId[] = ["intro", "index"];

      if (secondaryIndex) {
        nextIds.push("secondary");
      }

      nextIds.push("detail");

      if (tertiary) {
        nextIds.push("tertiary");
      }

      if (quaternary) {
        nextIds.push("quaternary");
      }

      return nextIds;
    },
    [quaternary, secondaryIndex, tertiary]
  );
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [layoutState, setLayoutState] = useState<PageLayoutState>(() =>
    layoutKey
      ? listPageLayoutState({
          layoutKey,
          variant: resolvedLayoutVariant,
          panelIds: activePanelIds
        })
      : getDefaultPageLayoutState(resolvedLayoutVariant)
  );
  const [panelSizeConstraints, setPanelSizeConstraints] = useState<
    Record<PageLayoutPanelId, PanelSizeConstraint>
  >(() => {
    const initialLayout = layoutKey
      ? listPageLayoutState({
          layoutKey,
          variant: resolvedLayoutVariant,
          panelIds: activePanelIds
        })
      : getDefaultPageLayoutState(resolvedLayoutVariant);

    return createDefaultPanelSizeConstraints({
      maxWidth: initialLayout.columnCount,
      maxHeight: Math.max(24, getPageLayoutRowCount({ layoutState: initialLayout, panelIds: activePanelIds }) + 12)
    });
  });
  const [activePanelConstraintEditor, setActivePanelConstraintEditor] = useState<PageLayoutPanelId | null>(null);
  const [layoutFileName, setLayoutFileName] = useState(() => getDefaultLayoutFileName(layoutKey));
  const [layoutDirectoryName, setLayoutDirectoryName] = useState<string | null>(null);
  const [layoutFileBusyAction, setLayoutFileBusyAction] = useState<string | null>(null);
  const [layoutFileNotice, setLayoutFileNotice] = useState<LayoutFileNotice | null>(null);
  const [knownLayoutFiles, setKnownLayoutFiles] = useState<PageLayoutFileReference[]>(() =>
    layoutKey ? listKnownPageLayoutFiles(layoutKey) : []
  );
  const [isLayoutDirectorySupported, setIsLayoutDirectorySupported] = useState(false);
  const [activeLayoutEdit, setActiveLayoutEdit] = useState<ActivePageLayoutEdit | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const effectiveLayoutMode = layoutMode && !isCompactViewport;
  const useFreeformLayout = !isCompactViewport;
  const rowCount = useMemo(
    () =>
      getPageLayoutRowCount({
        layoutState,
        panelIds: activePanelIds
      }),
    [activePanelIds, layoutState]
  );
  const panelConstraintMaxSize = useMemo(
    () => ({
      maxWidth: Math.max(1, layoutState.columnCount),
      maxHeight: Math.max(24, rowCount + 12)
    }),
    [layoutState.columnCount, rowCount]
  );
  const pageGridStyle = useMemo(
    () => getPageGridStyle(layoutState, rowCount),
    [layoutState, rowCount]
  );
  const gridOverlayCells = useMemo(
    () => Array.from({ length: rowCount * layoutState.columnCount }, (_, index) => index),
    [layoutState.columnCount, rowCount]
  );
  const componentOptions = useMemo(
    () =>
      activePanelIds.map((panelId) => ({
        id: panelId,
        label: resolvedPanelLabels[panelId],
        visible: layoutState.visible[panelId]
      })),
    [activePanelIds, layoutState.visible, resolvedPanelLabels]
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
    if (!layoutKey) {
      setLayoutState(getDefaultPageLayoutState(resolvedLayoutVariant));
      return;
    }

    setLayoutState(
      listPageLayoutState({
        layoutKey,
        variant: resolvedLayoutVariant,
        panelIds: activePanelIds
      })
    );
  }, [activePanelIds, layoutKey, resolvedLayoutVariant]);

  useEffect(() => {
    if (!layoutKey) {
      return;
    }

    savePageLayoutState({
      layoutKey,
      layoutState,
      variant: resolvedLayoutVariant,
      panelIds: activePanelIds
    });
  }, [activePanelIds, layoutKey, layoutState, resolvedLayoutVariant]);

  useEffect(() => {
    setPanelSizeConstraints((current) =>
      pageLayoutPanelIds.reduce((next, panelId) => {
        next[panelId] = normalizePanelSizeConstraint(current[panelId], panelConstraintMaxSize);
        return next;
      }, {} as Record<PageLayoutPanelId, PanelSizeConstraint>)
    );
  }, [panelConstraintMaxSize]);

  useEffect(() => {
    if (!effectiveLayoutMode) {
      setActivePanelConstraintEditor(null);
    }
  }, [effectiveLayoutMode]);

  useEffect(() => {
    setIsLayoutDirectorySupported(supportsWorkspaceLayoutDirectory());

    if (layoutKey) {
      const rememberedFiles = listKnownPageLayoutFiles(layoutKey);
      setKnownLayoutFiles(rememberedFiles);
      setLayoutFileName(rememberedFiles[0]?.name ?? getDefaultLayoutFileName(layoutKey));
    } else {
      setKnownLayoutFiles([]);
      setLayoutFileName(getDefaultLayoutFileName());
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
  }, [layoutKey]);

  useEffect(() => {
    if (!activeLayoutEdit || isCompactViewport) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const layoutNode = layoutRef.current;
      if (!layoutNode) {
        return;
      }

      const rect = layoutNode.getBoundingClientRect();
      const nextColumn = getSnappedPageLayoutColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: layoutState.columnGap
      });
      const nextRow = getSnappedPageLayoutRow({
        offsetY: event.clientY - rect.top,
        rowHeight: layoutState.rowHeight,
        rowGap: layoutState.columnGap
      });

      setLayoutState((currentLayout) => {
        if (activeLayoutEdit.mode === "move") {
          return updatePageLayoutPanelRect({
            layoutState: currentLayout,
            panelIds: activePanelIds,
            panelId: activeLayoutEdit.panelId,
            variant: resolvedLayoutVariant,
            nextRect: {
              ...activeLayoutEdit.initialRect,
              x: activeLayoutEdit.initialRect.x + (nextColumn - activeLayoutEdit.originColumn),
              y: Math.max(1, activeLayoutEdit.initialRect.y + (nextRow - activeLayoutEdit.originRow))
            }
          });
        }

        const constrainedRect = normalizePanelSizeConstraint(
          panelSizeConstraints[activeLayoutEdit.panelId],
          {
            maxWidth: Math.max(1, currentLayout.columnCount),
            maxHeight: Math.max(
              24,
              getPageLayoutRowCount({
                layoutState: currentLayout,
                panelIds: activePanelIds
              }) + 12
            )
          }
        );

        return updatePageLayoutPanelRect({
          layoutState: currentLayout,
          panelIds: activePanelIds,
          panelId: activeLayoutEdit.panelId,
          variant: resolvedLayoutVariant,
          nextRect: {
            ...activeLayoutEdit.initialRect,
            w: clamp(
              nextColumn - activeLayoutEdit.initialRect.x + 1,
              constrainedRect.minW,
              constrainedRect.maxW
            ),
            h: clamp(
              nextRow - activeLayoutEdit.initialRect.y + 1,
              constrainedRect.minH,
              constrainedRect.maxH
            )
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
    activePanelIds,
    isCompactViewport,
    layoutState.columnCount,
    layoutState.columnGap,
    layoutState.rowHeight,
    panelSizeConstraints,
    resolvedLayoutVariant
  ]);

  const beginPanelEdit =
    (panelId: PageLayoutPanelId, mode: LayoutEditMode) =>
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!effectiveLayoutMode || !layoutRef.current) {
        return;
      }

      event.preventDefault();

      const rect = layoutRef.current.getBoundingClientRect();
      const originColumn = getSnappedPageLayoutColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: layoutState.columnGap
      });
      const originRow = getSnappedPageLayoutRow({
        offsetY: event.clientY - rect.top,
        rowHeight: layoutState.rowHeight,
        rowGap: layoutState.columnGap
      });

      setActiveLayoutEdit({
        panelId,
        mode,
        originColumn,
        originRow,
        initialRect: layoutState.panels[panelId]
      });
    };

  const adjustPanelLayout = (
    panelId: PageLayoutPanelId,
    mode: LayoutEditMode,
    deltaX: number,
    deltaY: number
  ) => {
    if (!effectiveLayoutMode) {
      return;
    }

    setLayoutState((currentLayout) => {
      const currentRect = currentLayout.panels[panelId];
      const constraint = normalizePanelSizeConstraint(panelSizeConstraints[panelId], {
        maxWidth: Math.max(1, currentLayout.columnCount),
        maxHeight: Math.max(
          24,
          getPageLayoutRowCount({
            layoutState: currentLayout,
            panelIds: activePanelIds
          }) + 12
        )
      });
      const nextRect =
        mode === "move"
          ? {
              ...currentRect,
              x: currentRect.x + deltaX,
              y: currentRect.y + deltaY
            }
          : {
              ...currentRect,
              w: clamp(currentRect.w + deltaX, constraint.minW, constraint.maxW),
              h: clamp(currentRect.h + deltaY, constraint.minH, constraint.maxH)
            };

      return updatePageLayoutPanelRect({
        layoutState: currentLayout,
        panelIds: activePanelIds,
        panelId,
        variant: resolvedLayoutVariant,
        nextRect
      });
    });
  };

  const handlePanelEditKeyDown =
    (panelId: PageLayoutPanelId, mode: LayoutEditMode) =>
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (!effectiveLayoutMode) {
        return;
      }

      const step = event.shiftKey ? 2 : 1;
      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, 0, -step);
          break;
        case "ArrowDown":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, 0, step);
          break;
        case "ArrowLeft":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, -step, 0);
          break;
        case "ArrowRight":
          event.preventDefault();
          adjustPanelLayout(panelId, mode, step, 0);
          break;
        default:
          break;
      }
    };

  const handleResetLayout = () => {
    setLayoutState(
      layoutKey
        ? resetPageLayoutState({
            layoutKey,
            variant: resolvedLayoutVariant
          })
        : getDefaultPageLayoutState(resolvedLayoutVariant)
    );
  };

  const handleRestorePanel = (panelId: PageLayoutPanelId) => {
    setLayoutState((currentLayout) =>
      restorePageLayoutPanel({
        layoutState: currentLayout,
        panelId,
        variant: resolvedLayoutVariant
      })
    );
  };

  const handlePanelVisibilityChange = (panelId: PageLayoutPanelId, visible: boolean) => {
    setLayoutState((currentLayout) =>
      setPageLayoutPanelVisible({
        layoutState: currentLayout,
        panelId,
        visible
      })
    );

    if (!visible) {
      setActiveLayoutEdit((currentEdit) => (currentEdit?.panelId === panelId ? null : currentEdit));
      setActivePanelConstraintEditor((currentPanelId) => (currentPanelId === panelId ? null : currentPanelId));
    }
  };

  const updatePanelConstraintRange = (
    panelId: PageLayoutPanelId,
    axis: "width" | "height",
    nextRange: number[]
  ) => {
    const minValue = Math.max(1, Math.round(Math.min(nextRange[0] ?? 1, nextRange[1] ?? 1)));
    const maxValue = Math.max(minValue, Math.round(Math.max(nextRange[0] ?? minValue, nextRange[1] ?? minValue)));
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

    setLayoutState((currentLayout) =>
      updatePageLayoutPanelRect({
        layoutState: currentLayout,
        panelIds: activePanelIds,
        panelId,
        variant: resolvedLayoutVariant,
        nextRect: {
          ...currentLayout.panels[panelId],
          w: clamp(currentLayout.panels[panelId].w, normalized.minW, normalized.maxW),
          h: clamp(currentLayout.panels[panelId].h, normalized.minH, normalized.maxH)
        }
      })
    );
  };

  const runLayoutFileAction = async (actionName: string, action: () => Promise<void>) => {
    setLayoutFileBusyAction(actionName);
    setLayoutFileNotice(null);

    try {
      await action();
    } catch (error) {
      setLayoutFileNotice({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong while working with the page layout file."
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
    if (!layoutKey) {
      return;
    }

    void runLayoutFileAction("save-layout-file", async () => {
      const result = await savePageLayoutFileToDirectory({
        layoutKey,
        layoutVariant: resolvedLayoutVariant,
        panelIds: activePanelIds,
        name: layoutFileName,
        layoutState
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
    if (!layoutKey) {
      return;
    }

    void runLayoutFileAction("load-layout-file", async () => {
      const result = await loadPageLayoutFileFromDirectory({
        layoutKey,
        layoutVariant: resolvedLayoutVariant,
        panelIds: activePanelIds,
        name: layoutFileName
      });
      if (!result) {
        setLayoutFileNotice({
          tone: "neutral",
          text: "No named layout file matched that name in the connected folder."
        });
        return;
      }

      const nextState = layoutKey
        ? savePageLayoutState({
            layoutKey,
            layoutState: result.layoutState,
            variant: resolvedLayoutVariant,
            panelIds: activePanelIds
          })
        : result.layoutState;
      setLayoutState(nextState);
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
    if (!layoutKey) {
      return;
    }

    void runLayoutFileAction("delete-layout-file", async () => {
      const result = await deletePageLayoutFileFromDirectory({
        layoutKey,
        name: layoutFileName
      });
      setKnownLayoutFiles(result.knownFiles);
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName(getDefaultLayoutFileName(layoutKey));
      handleResetLayout();
      setLayoutFileNotice({
        tone: "neutral",
        text: `Removed ${result.layoutName} from ${result.relativePath} and restored the default layout.`
      });
    });
  };

  const renderMoveSurface = (panelId: PageLayoutPanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__move-surface"
        onPointerDown={beginPanelEdit(panelId, "move")}
        onKeyDown={handlePanelEditKeyDown(panelId, "move")}
        aria-label={`Move ${resolvedPanelLabels[panelId]} section with pointer or arrow keys`}
      />
    ) : null;

  const renderResizeHandle = (panelId: PageLayoutPanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__resize-handle"
        onPointerDown={beginPanelEdit(panelId, "resize")}
        onKeyDown={handlePanelEditKeyDown(panelId, "resize")}
        aria-label={`Resize ${resolvedPanelLabels[panelId]} section with pointer or arrow keys`}
      >
        <span />
      </button>
    ) : null;

  const renderConstraintHandle = (panelId: PageLayoutPanelId) => {
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
          aria-label={`Edit ${resolvedPanelLabels[panelId]} resize bounds`}
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
                {resolvedPanelLabels[panelId]} bounds
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

  if (isCompactViewport) {
    return (
      <main
        className={cn(
          "indexed-workspace",
          secondaryIndex ? "indexed-workspace--three-pane" : null,
          scrollMode === "page" ? "indexed-workspace--page-scroll" : null,
          className
        )}
      >
        {layoutState.visible.intro ? <div className="indexed-workspace__intro">{intro}</div> : null}
        <div
          className={cn(
            "indexed-workspace__columns",
            secondaryIndex ? "indexed-workspace__columns--three-pane" : null
          )}
        >
          {layoutState.visible.index ? <div className="indexed-workspace__index">{index}</div> : null}
          {secondaryIndex && layoutState.visible.secondary ? (
            <div className="indexed-workspace__secondary-index">{secondaryIndex}</div>
          ) : null}
          {layoutState.visible.detail ? <div className="indexed-workspace__detail">{detail}</div> : null}
          {tertiary && layoutState.visible.tertiary ? (
            <div className="indexed-workspace__detail">{tertiary}</div>
          ) : null}
          {quaternary && layoutState.visible.quaternary ? (
            <div className="indexed-workspace__detail">{quaternary}</div>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <div className={cn("workspace-layout-shell", effectiveLayoutMode ? "workspace-layout-shell--editing" : null)}>
      {effectiveLayoutMode ? (
        <FloatingLayoutPanel>
          {({ onDragHandlePointerDown, isDragging }) => (
            <PageLayoutToolbar
              columnCount={layoutState.columnCount}
              columnGap={layoutState.columnGap}
              rowHeight={layoutState.rowHeight}
              showLayoutGrid={showLayoutGrid}
              layoutFileName={layoutFileName}
              layoutDirectoryName={layoutDirectoryName}
              layoutFileNotice={layoutFileNotice}
              isLayoutDirectorySupported={isLayoutDirectorySupported}
              layoutFileBusyAction={layoutFileBusyAction}
              knownLayoutFiles={knownLayoutFiles}
              components={componentOptions}
              onDragHandlePointerDown={onDragHandlePointerDown}
              isDragging={isDragging}
              onToggleLayoutMode={() => onToggleLayoutMode?.()}
              onColumnCountChange={(value) =>
                setLayoutState((currentLayout) =>
                  updatePageLayoutColumnCount({
                    layoutState: currentLayout,
                    panelIds: activePanelIds,
                    variant: resolvedLayoutVariant,
                    value
                  })
                )
              }
              onColumnGapChange={(value) =>
                setLayoutState((currentLayout) =>
                  updatePageLayoutColumnGap({
                    layoutState: currentLayout,
                    value
                  })
                )
              }
              onRowHeightChange={(value) =>
                setLayoutState((currentLayout) =>
                  updatePageLayoutRowHeight({
                    layoutState: currentLayout,
                    value
                  })
                )
              }
              onToggleLayoutGrid={(checked) => onToggleLayoutGrid?.(checked)}
              onLayoutFileNameChange={setLayoutFileName}
              onConnectLayoutDirectory={handleConnectLayoutDirectory}
              onLoadLayoutFile={handleLoadLayoutFile}
              onSaveLayoutFile={handleSaveLayoutFile}
              onDeleteLayoutFile={handleDeleteLayoutFile}
              onSelectKnownLayoutFile={setLayoutFileName}
              onRestoreComponent={(panelId) => handleRestorePanel(panelId as PageLayoutPanelId)}
              onToggleComponentVisibility={(panelId, visible) =>
                handlePanelVisibilityChange(panelId as PageLayoutPanelId, visible)
              }
              onResetLayout={handleResetLayout}
            />
          )}
        </FloatingLayoutPanel>
      ) : null}

      <main
        className={cn(
          "indexed-workspace",
          useFreeformLayout ? "indexed-workspace--layout-mode" : null,
          secondaryIndex ? "indexed-workspace--three-pane" : null,
          scrollMode === "page" ? "indexed-workspace--page-scroll" : null,
          className
        )}
      >
        <div
          ref={layoutRef}
          className={cn(
            "workspace-grid",
            useFreeformLayout ? "workspace-grid--freeform" : null,
            effectiveLayoutMode ? "workspace-grid--layout-mode" : null
          )}
          style={pageGridStyle}
        >
          <div
            className="workspace-grid__sizer"
            style={{
              gridColumn: "1 / -1",
              gridRow: `1 / span ${rowCount}`
            }}
            aria-hidden="true"
          />
          {effectiveLayoutMode && showLayoutGrid ? (
            <div
              className="workspace-grid__overlay"
              style={{ gridTemplateRows: `repeat(${rowCount}, var(--workspace-row-height))` }}
              aria-hidden="true"
            >
              {gridOverlayCells.map((cellIndex) => (
                <span key={cellIndex} className="workspace-grid__overlay-cell" />
              ))}
            </div>
          ) : null}

          {layoutState.visible.intro ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--intro",
                activeLayoutEdit?.panelId === "intro" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "intro")}
            >
              <div className="page-layout-panel__content">{intro}</div>
              {renderMoveSurface("intro")}
              {renderConstraintHandle("intro")}
              {renderResizeHandle("intro")}
            </div>
          ) : null}

          {layoutState.visible.index ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--index",
                activeLayoutEdit?.panelId === "index" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "index")}
            >
              <div className="page-layout-panel__content">{index}</div>
              {renderMoveSurface("index")}
              {renderConstraintHandle("index")}
              {renderResizeHandle("index")}
            </div>
          ) : null}

          {secondaryIndex && layoutState.visible.secondary ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--secondary",
                activeLayoutEdit?.panelId === "secondary" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "secondary")}
            >
              <div className="page-layout-panel__content">{secondaryIndex}</div>
              {renderMoveSurface("secondary")}
              {renderConstraintHandle("secondary")}
              {renderResizeHandle("secondary")}
            </div>
          ) : null}

          {layoutState.visible.detail ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--detail",
                activeLayoutEdit?.panelId === "detail" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "detail")}
            >
              <div className="page-layout-panel__content">{detail}</div>
              {renderMoveSurface("detail")}
              {renderConstraintHandle("detail")}
              {renderResizeHandle("detail")}
            </div>
          ) : null}

          {tertiary && layoutState.visible.tertiary ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--tertiary",
                activeLayoutEdit?.panelId === "tertiary" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "tertiary")}
            >
              <div className="page-layout-panel__content">{tertiary}</div>
              {renderMoveSurface("tertiary")}
              {renderConstraintHandle("tertiary")}
              {renderResizeHandle("tertiary")}
            </div>
          ) : null}

          {quaternary && layoutState.visible.quaternary ? (
            <div
              className={cn(
                "workspace-item",
                "page-layout-panel",
                "page-layout-panel--quaternary",
                activeLayoutEdit?.panelId === "quaternary" ? "is-editing" : null
              )}
              style={getPagePanelStyle(layoutState, "quaternary")}
            >
              <div className="page-layout-panel__content">{quaternary}</div>
              {renderMoveSurface("quaternary")}
              {renderConstraintHandle("quaternary")}
              {renderResizeHandle("quaternary")}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
