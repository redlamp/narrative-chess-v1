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
  getConnectedWorkspaceLayoutDirectoryName,
  loadLayoutBundleFromDirectory,
  saveLayoutBundleToDirectory,
  supportsWorkspaceLayoutDirectory
} from "../fileSystemAccess";
import {
  loadLayoutBundleFromSupabase,
  saveLayoutBundleToSupabase
} from "../layoutCloud";
import {
  activatePreset,
  createPageLayoutPreset,
  deletePreset,
  listPageLayoutPresets,
  renamePreset,
  reorderPreset,
  saveActivePreset,
  type PageLayoutPresetStore
} from "../pageLayoutPresets";
import type { SharedLayoutPresetEntry, SharedLayoutPageOption } from "./SharedLayoutToolbar";
import {
  getDefaultPageLayoutState,
  getPageLayoutRowCount,
  getSnappedPageLayoutColumn,
  getSnappedPageLayoutRow,
  listPageLayoutState,
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

export type IndexedWorkspacePanel = {
  id: string;
  label: string;
  content: ReactNode;
};

type IndexedWorkspaceProps = {
  intro?: ReactNode;
  index?: ReactNode;
  secondaryIndex?: ReactNode;
  detail?: ReactNode;
  tertiary?: ReactNode;
  quaternary?: ReactNode;
  panels?: IndexedWorkspacePanel[];
  panelLabels?: Partial<Record<string, string>>;
  className?: string;
  scrollMode?: "panel" | "page";
  layoutMode?: boolean;
  layoutKey?: string;
  layoutVariant?: PageLayoutVariant;
  showLayoutGrid?: boolean;
  layoutNavigation?: LayoutNavigation;
  onToggleLayoutMode?: () => void;
  onToggleLayoutGrid?: (checked: boolean) => void;
};

export type LayoutNavigation = {
  pages: SharedLayoutPageOption[];
  activePage: string;
  onPageChange: (page: string) => void;
};

const defaultPanelLabels: Record<string, string> = {
  intro: "Header",
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

function createDefaultPanelSizeConstraints(
  panelIds: string[],
  input: { maxWidth: number; maxHeight: number }
) {
  const safeMaxWidth = Math.max(1, input.maxWidth);
  const safeMaxHeight = Math.max(1, input.maxHeight);

  return panelIds.reduce((next, panelId) => {
    next[panelId] = {
      minW: 1,
      maxW: safeMaxWidth,
      minH: 1,
      maxH: safeMaxHeight
    };
    return next;
  }, {} as Record<string, PanelSizeConstraint>);
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
  panels: dynamicPanels,
  panelLabels: panelLabelsOverride,
  className,
  scrollMode = "panel",
  layoutMode = false,
  layoutKey,
  layoutVariant,
  showLayoutGrid = false,
  layoutNavigation,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: IndexedWorkspaceProps) {
  const resolvedLayoutVariant = layoutVariant ?? (secondaryIndex ? "three-pane" : "two-pane");
  const resolvedPanelLabels = useMemo(
    () => {
      if (dynamicPanels) {
        const dynamicLabels: Record<string, string> = {};
        for (const panel of dynamicPanels) {
          dynamicLabels[panel.id] = panel.label;
        }
        return { ...dynamicLabels, ...panelLabelsOverride };
      }
      return { ...defaultPanelLabels, ...panelLabelsOverride };
    },
    [dynamicPanels, panelLabelsOverride]
  );
  const panelContentMap = useMemo(() => {
    if (dynamicPanels) {
      const map: Record<string, ReactNode> = {};
      for (const panel of dynamicPanels) {
        map[panel.id] = panel.content;
      }
      return map;
    }
    const map: Record<string, ReactNode> = {};
    if (intro) map.intro = intro;
    if (index) map.index = index;
    if (secondaryIndex) map.secondary = secondaryIndex;
    if (detail) map.detail = detail;
    if (tertiary) map.tertiary = tertiary;
    if (quaternary) map.quaternary = quaternary;
    return map;
  }, [dynamicPanels, intro, index, secondaryIndex, detail, tertiary, quaternary]);
  const activePanelIds = useMemo<string[]>(
    () => {
      if (dynamicPanels) {
        return dynamicPanels.map((p) => p.id);
      }

      const nextIds: string[] = [];

      if (intro) {
        nextIds.push("intro");
      }

      nextIds.push("index");

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
    [dynamicPanels, intro, quaternary, secondaryIndex, tertiary]
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

    return createDefaultPanelSizeConstraints(activePanelIds, {
      maxWidth: initialLayout.columnCount,
      maxHeight: Math.max(24, getPageLayoutRowCount({ layoutState: initialLayout, panelIds: activePanelIds }) + 12)
    });
  });
  const [activePanelConstraintEditor, setActivePanelConstraintEditor] = useState<PageLayoutPanelId | null>(null);
  const [layoutFileName, setLayoutFileName] = useState(() => getDefaultLayoutFileName(layoutKey));
  const [layoutDirectoryName, setLayoutDirectoryName] = useState<string | null>(null);
  const [layoutFileBusyAction, setLayoutFileBusyAction] = useState<string | null>(null);
  const [layoutFileNotice, setLayoutFileNotice] = useState<LayoutFileNotice | null>(null);
  const [isLayoutDirectorySupported, setIsLayoutDirectorySupported] = useState(false);
  const [activeLayoutEdit, setActiveLayoutEdit] = useState<ActivePageLayoutEdit | null>(null);
  const [presetStore, setPresetStore] = useState<PageLayoutPresetStore>(() =>
    layoutKey ? listPageLayoutPresets(layoutKey) : { version: 1, activePresetId: null, presets: [] }
  );
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const effectiveLayoutMode = layoutMode && !isCompactViewport;
  const useFreeformLayout = !isCompactViewport;
  const rowCount = useMemo(
    () =>
      getPageLayoutRowCount({
        layoutState,
        panelIds: activePanelIds,
        minimumRows: effectiveLayoutMode ? undefined : 1
      }),
    [activePanelIds, effectiveLayoutMode, layoutState]
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
        label: resolvedPanelLabels[panelId] ?? panelId,
        visible: layoutState.visible[panelId]
      })),
    [activePanelIds, layoutState.visible, resolvedPanelLabels]
  );
  const presetEntries = useMemo<SharedLayoutPresetEntry[]>(
    () =>
      presetStore.presets.map((p) => ({
        id: p.id,
        name: p.name,
        active: p.id === presetStore.activePresetId
      })),
    [presetStore]
  );

  useEffect(() => {
    if (layoutKey) {
      setPresetStore(listPageLayoutPresets(layoutKey));
    }
  }, [layoutKey]);

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
      activePanelIds.reduce((next, panelId) => {
        next[panelId] = normalizePanelSizeConstraint(
          current[panelId] ?? { minW: 1, maxW: panelConstraintMaxSize.maxWidth, minH: 1, maxH: panelConstraintMaxSize.maxHeight },
          panelConstraintMaxSize
        );
        return next;
      }, {} as Record<string, PanelSizeConstraint>)
    );
  }, [activePanelIds, panelConstraintMaxSize]);

  useEffect(() => {
    if (!effectiveLayoutMode) {
      setActivePanelConstraintEditor(null);
    }
  }, [effectiveLayoutMode]);

  useEffect(() => {
    setIsLayoutDirectorySupported(supportsWorkspaceLayoutDirectory());
    setLayoutFileName(getDefaultLayoutFileName(layoutKey));

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
    if (layoutKey) {
      setPresetStore((current) => ({ ...current, activePresetId: null }));
    }
  };

  const handleCreatePreset = () => {
    if (!layoutKey) return;
    const name = `Layout ${presetStore.presets.length + 1}`;
    setPresetStore(createPageLayoutPreset(layoutKey, name, layoutState));
  };

  // Ensure a "Default" preset exists on first open
  useEffect(() => {
    if (!layoutKey) return;
    const store = listPageLayoutPresets(layoutKey);
    if (store.presets.length === 0) {
      const nextStore = createPageLayoutPreset(layoutKey, "Default", layoutState);
      setPresetStore(nextStore);
    }
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSavePreset = () => {
    if (!layoutKey) return;
    setPresetStore(saveActivePreset(layoutKey, layoutState));
  };

  const handleActivatePreset = (presetId: string) => {
    if (!layoutKey) return;
    const result = activatePreset(layoutKey, presetId);
    setPresetStore(result.store);
    if (result.layoutState) {
      setLayoutState(result.layoutState);
    }
  };

  const handleDeletePreset = (presetId: string) => {
    if (!layoutKey) return;
    setPresetStore(deletePreset(layoutKey, presetId));
  };

  const handleRenamePreset = (presetId: string, name: string) => {
    if (!layoutKey) return;
    setPresetStore(renamePreset(layoutKey, presetId, name));
  };

  const handleReorderPreset = (presetId: string, targetId: string) => {
    if (!layoutKey) return;
    setPresetStore(reorderPreset(layoutKey, presetId, targetId));
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

  const handleSaveLayoutBundle = () => {
    void runLayoutFileAction("save-layout-bundle", async () => {
      const result = await saveLayoutBundleToDirectory({ name: layoutFileName });
      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName(result.bundleName);
      setLayoutFileNotice({
        tone: "success",
        text: `Saved all layouts to ${result.relativePath}.`
      });
    });
  };

  const handleLoadLayoutBundle = () => {
    void runLayoutFileAction("load-layout-bundle", async () => {
      const result = await loadLayoutBundleFromDirectory({ name: layoutFileName });
      if (!result) {
        setLayoutFileNotice({
          tone: "neutral",
          text: "No layout bundle matched that name in the connected folder."
        });
        return;
      }

      // Reload this page's layout from localStorage (bundle already applied)
      if (layoutKey) {
        const currentPageLayout = result.bundle.pages[layoutKey];
        if (currentPageLayout) {
          setLayoutState(currentPageLayout.layoutState);
        }
      }

      setLayoutDirectoryName(result.directoryName);
      setLayoutFileName(result.bundleName);
      setLayoutFileNotice({
        tone: "success",
        text: `Loaded all layouts from ${result.relativePath}.`
      });
    });
  };

  const handleSaveLayoutBundleToCloud = () => {
    void runLayoutFileAction("save-layout-bundle-cloud", async () => {
      const result = await saveLayoutBundleToSupabase(layoutFileName);
      setLayoutFileName(result.bundleName);
      setLayoutFileNotice({
        tone: "success",
        text: `Saved all layouts to cloud as ${result.bundleName}.`
      });
    });
  };

  const handleLoadLayoutBundleFromCloud = () => {
    void runLayoutFileAction("load-layout-bundle-cloud", async () => {
      const result = await loadLayoutBundleFromSupabase(layoutFileName);
      if (!result) {
        setLayoutFileNotice({
          tone: "neutral",
          text: "No cloud layout bundle matched that name."
        });
        return;
      }

      if (layoutKey) {
        const currentPageLayout = result.pages[layoutKey];
        if (currentPageLayout) {
          setLayoutState(currentPageLayout.layoutState);
        }
      }

      setLayoutFileName(result.name);
      setLayoutFileNotice({
        tone: "success",
        text: `Loaded all layouts from cloud bundle ${result.name}.`
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
    const rawConstraint = panelSizeConstraints[panelId] ?? {
      minW: 1, maxW: panelConstraintMaxSize.maxWidth,
      minH: 1, maxH: panelConstraintMaxSize.maxHeight
    };
    const constraint = normalizePanelSizeConstraint(rawConstraint, panelConstraintMaxSize);

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
        {activePanelIds.map((panelId) => {
          const content = panelContentMap[panelId];
          if (!content || !layoutState.visible[panelId]) return null;
          return (
            <div key={panelId} className={`indexed-workspace__${panelId}`}>
              {content}
            </div>
          );
        })}
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
              components={componentOptions}
              pages={layoutNavigation?.pages}
              activePage={layoutNavigation?.activePage}
              onPageChange={layoutNavigation?.onPageChange}
              presets={presetEntries}
              onCreatePreset={handleCreatePreset}
              onSavePreset={handleSavePreset}
              onActivatePreset={handleActivatePreset}
              onDeletePreset={handleDeletePreset}
              onRenamePreset={handleRenamePreset}
              onReorderPreset={handleReorderPreset}
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
              onSaveLayoutBundle={handleSaveLayoutBundle}
              onLoadLayoutBundle={handleLoadLayoutBundle}
              onSaveLayoutBundleToCloud={handleSaveLayoutBundleToCloud}
              onLoadLayoutBundleFromCloud={handleLoadLayoutBundleFromCloud}
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

          {activePanelIds.map((panelId) => {
            const content = panelContentMap[panelId];
            if (!content || !layoutState.visible[panelId]) return null;

            return (
              <div
                key={panelId}
                className={cn(
                  "workspace-item",
                  "page-layout-panel",
                  `page-layout-panel--${panelId}`,
                  activeLayoutEdit?.panelId === panelId ? "is-editing" : null
                )}
                style={getPagePanelStyle(layoutState, panelId)}
              >
                <div className="page-layout-panel__content">{content}</div>
                {renderMoveSurface(panelId)}
                {renderConstraintHandle(panelId)}
                {renderResizeHandle(panelId)}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
