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
import { cn } from "@/lib/utils";
import { PageLayoutToolbar } from "./PageLayoutToolbar";
import {
  getDefaultPageLayoutState,
  getPageLayoutRowCount,
  getSnappedPageLayoutColumn,
  getSnappedPageLayoutRow,
  listPageLayoutState,
  resetPageLayoutState,
  savePageLayoutState,
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
  detail: "Detail column"
};

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
  const zIndex = 10000 - area * 100 - panel.w * 10 - panel.h;
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
  const activePanelIds = useMemo<PageLayoutPanelId[]>(
    () =>
      secondaryIndex
        ? ["intro", "index", "secondary", "detail"]
        : ["intro", "index", "detail"],
    [secondaryIndex]
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
  const pageGridStyle = useMemo(
    () => getPageGridStyle(layoutState, rowCount),
    [layoutState, rowCount]
  );
  const gridOverlayCells = useMemo(
    () => Array.from({ length: rowCount * layoutState.columnCount }, (_, index) => index),
    [layoutState.columnCount, rowCount]
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

        return updatePageLayoutPanelRect({
          layoutState: currentLayout,
          panelIds: activePanelIds,
          panelId: activeLayoutEdit.panelId,
          variant: resolvedLayoutVariant,
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
    activePanelIds,
    isCompactViewport,
    layoutState.columnCount,
    layoutState.rowHeight,
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

  const renderMoveSurface = (panelId: PageLayoutPanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__move-surface"
        onPointerDown={beginPanelEdit(panelId, "move")}
        onKeyDown={handlePanelEditKeyDown(panelId, "move")}
        aria-label={`Move ${panelLabels[panelId]} section with pointer or arrow keys`}
      />
    ) : null;

  const renderResizeHandle = (panelId: PageLayoutPanelId) =>
    effectiveLayoutMode ? (
      <button
        type="button"
        className="workspace-item__resize-handle"
        onPointerDown={beginPanelEdit(panelId, "resize")}
        onKeyDown={handlePanelEditKeyDown(panelId, "resize")}
        aria-label={`Resize ${panelLabels[panelId]} section with pointer or arrow keys`}
      >
        <span />
      </button>
    ) : null;

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
        <div className="indexed-workspace__intro">{intro}</div>
        <div
          className={cn(
            "indexed-workspace__columns",
            secondaryIndex ? "indexed-workspace__columns--three-pane" : null
          )}
        >
          <div className="indexed-workspace__index">{index}</div>
          {secondaryIndex ? (
            <div className="indexed-workspace__secondary-index">{secondaryIndex}</div>
          ) : null}
          <div className="indexed-workspace__detail">{detail}</div>
        </div>
      </main>
    );
  }

  return (
    <div className={cn("workspace-layout-shell", effectiveLayoutMode ? "workspace-layout-shell--editing" : null)}>
      {effectiveLayoutMode ? (
        <aside className="workspace-layout-shell__sidebar">
          <PageLayoutToolbar
            columnCount={layoutState.columnCount}
            columnGap={layoutState.columnGap}
            rowHeight={layoutState.rowHeight}
            showLayoutGrid={showLayoutGrid}
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
            onResetLayout={handleResetLayout}
          />
        </aside>
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
            {renderResizeHandle("intro")}
          </div>

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
            {renderResizeHandle("index")}
          </div>

          {secondaryIndex ? (
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
              {renderResizeHandle("secondary")}
            </div>
          ) : null}

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
            {renderResizeHandle("detail")}
          </div>
        </div>
      </main>
    </div>
  );
}
