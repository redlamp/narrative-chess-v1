import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode
} from "react";
import { Grip } from "lucide-react";
import type {
  CharacterSummary,
  DistrictCell,
  MoveRecord,
  NarrativeEvent,
  PieceState,
  Square
} from "@narrative-chess/content-schema";
import { Button } from "@/components/ui/button";
import {
  getSnappedStoryPanelColumn,
  getSnappedStoryPanelRow,
  getStoryPanelLayoutRowCount,
  storyPanelSectionIds,
  type StoryPanelLayoutState,
  type StoryPanelSectionId,
  type StoryPanelSectionRect
} from "../storyPanelLayoutState";
import { Panel } from "./Panel";
import { StoryBeatSection } from "./StoryBeatSection";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { StoryCityTileSection } from "./StoryCityTileSection";
import { StoryToneSection } from "./StoryToneSection";

type StoryPanelProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedMove: MoveRecord | null;
  selectedEvent: NarrativeEvent | null;
  focusedSquare: Square | null;
  focusedSquareSummary: string;
  focusedDistrict: DistrictCell | null;
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: NarrativeEvent[];
  moveHistory: MoveRecord[];
  showRecentCharacterActions: boolean;
  layoutState: StoryPanelLayoutState;
  layoutMode: boolean;
  parentColumnGap: number;
  parentRowHeight: number;
  onLayoutRectChange: (panelId: StoryPanelSectionId, nextRect: StoryPanelSectionRect) => void;
  tonePreset: "grounded" | "civic-noir" | "dark-comedy";
  onToneChange: (tone: "grounded" | "civic-noir" | "dark-comedy") => void;
  headerAction?: ReactNode;
};

type StoryLayoutEditMode = "move" | "resize";

type ActiveStoryLayoutEdit = {
  panelId: StoryPanelSectionId;
  mode: StoryLayoutEditMode;
  originColumn: number;
  originRow: number;
  initialRect: StoryPanelSectionRect;
};

function getStoryPanelStyle(
  layoutState: StoryPanelLayoutState,
  panelId: StoryPanelSectionId
): CSSProperties {
  const panel = layoutState.panels[panelId];
  const area = panel.w * panel.h;
  const zIndex = 1000 - area * 10 - panel.w - panel.h;
  const columnOffset = Math.max(0, panel.x - 1);
  const rowOffset = Math.max(0, panel.y - 1);

  return {
    left: `calc(((100% - (var(--story-layout-gap) * (var(--story-layout-column-count) - 1))) / var(--story-layout-column-count) * ${columnOffset}) + (var(--story-layout-gap) * ${columnOffset}))`,
    top: `calc((var(--story-layout-row-height) * ${rowOffset}) + (var(--story-layout-gap) * ${rowOffset}))`,
    width: `calc(((100% - (var(--story-layout-gap) * (var(--story-layout-column-count) - 1))) / var(--story-layout-column-count) * ${panel.w}) + (var(--story-layout-gap) * ${Math.max(panel.w - 1, 0)}))`,
    height: `calc((var(--story-layout-row-height) * ${panel.h}) + (var(--story-layout-gap) * ${Math.max(panel.h - 1, 0)}))`,
    zIndex
  };
}

export function StoryPanel({
  collapsed,
  onToggleCollapse,
  selectedMove,
  selectedEvent,
  focusedSquare,
  focusedSquareSummary,
  focusedDistrict,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  moveHistory,
  showRecentCharacterActions,
  layoutState,
  layoutMode,
  parentColumnGap,
  parentRowHeight,
  onLayoutRectChange,
  tonePreset,
  onToneChange,
  headerAction
}: StoryPanelProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [activeEdit, setActiveEdit] = useState<ActiveStoryLayoutEdit | null>(null);
  const rowCount = useMemo(() => getStoryPanelLayoutRowCount(layoutState), [layoutState]);
  const layoutStyle = useMemo(
    () =>
      ({
        "--story-layout-column-count": String(layoutState.columnCount),
        "--story-layout-gap": `${parentColumnGap}px`,
        "--story-layout-row-height": `${parentRowHeight}px`,
        "--story-layout-row-count": String(rowCount)
      }) as CSSProperties,
    [layoutState.columnCount, parentColumnGap, parentRowHeight, rowCount]
  );

  useEffect(() => {
    if (!activeEdit) {
      return;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const currentColumn = getSnappedStoryPanelColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: parentColumnGap
      });
      const currentRow = getSnappedStoryPanelRow({
        offsetY: event.clientY - rect.top,
        rowHeight: parentRowHeight,
        rowGap: parentColumnGap
      });
      const deltaColumns = currentColumn - activeEdit.originColumn;
      const deltaRows = currentRow - activeEdit.originRow;

      const nextRect =
        activeEdit.mode === "move"
          ? {
              ...activeEdit.initialRect,
              x: activeEdit.initialRect.x + deltaColumns,
              y: activeEdit.initialRect.y + deltaRows
            }
          : {
              ...activeEdit.initialRect,
              w: activeEdit.initialRect.w + deltaColumns,
              h: activeEdit.initialRect.h + deltaRows
            };

      onLayoutRectChange(activeEdit.panelId, nextRect);
    };

    const handlePointerUp = () => {
      setActiveEdit(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeEdit, layoutState.columnCount, onLayoutRectChange, parentColumnGap, parentRowHeight]);

  const beginEdit =
    (panelId: StoryPanelSectionId, mode: StoryLayoutEditMode) =>
    (event: PointerEvent<HTMLButtonElement>) => {
      if (!layoutMode || !canvasRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const rect = canvasRef.current.getBoundingClientRect();
      const originColumn = getSnappedStoryPanelColumn({
        offsetX: event.clientX - rect.left,
        width: rect.width,
        columnCount: layoutState.columnCount,
        columnGap: parentColumnGap
      });
      const originRow = getSnappedStoryPanelRow({
        offsetY: event.clientY - rect.top,
        rowHeight: parentRowHeight,
        rowGap: parentColumnGap
      });

      setActiveEdit({
        panelId,
        mode,
        originColumn,
        originRow,
        initialRect: layoutState.panels[panelId]
      });
    };

  const sectionPanels: Record<StoryPanelSectionId, ReactNode> = {
    beat: (
      <StoryBeatSection selectedMove={selectedMove} selectedEvent={selectedEvent} />
    ),
    tile: (
      <StoryCityTileSection
        focusedSquareSummary={focusedSquareSummary}
        focusedDistrict={focusedDistrict}
      />
    ),
    character: (
      <CharacterDetailPanel
        focusedSquare={focusedSquare}
        focusedPiece={focusedPiece}
        focusedCharacter={focusedCharacter}
        focusedCharacterMoments={focusedCharacterMoments}
        moveHistory={moveHistory}
        showRecentCharacterActions={showRecentCharacterActions}
      />
    ),
    tone: (
      <StoryToneSection tonePreset={tonePreset} onToneChange={onToneChange} />
    )
  };

  return (
    <Panel
      title="Story"
      collapsed={collapsed}
      action={headerAction}
      onToggleCollapse={onToggleCollapse}
    >
      <div
        ref={canvasRef}
        className={`story-layout ${layoutMode ? "story-layout--editing" : ""}`}
        style={layoutStyle}
      >
        {layoutMode ? (
          <div className="story-layout__overlay" aria-hidden="true">
            {Array.from({ length: layoutState.columnCount * rowCount }, (_, index) => (
              <span key={index} className="story-layout__overlay-cell" />
            ))}
          </div>
        ) : null}
        {storyPanelSectionIds.map((panelId) => (
          <article
            key={panelId}
            className={`detail-card story-layout__item ${
              activeEdit?.panelId === panelId ? "story-layout__item--editing" : ""
            }`}
            style={getStoryPanelStyle(layoutState, panelId)}
          >
            {sectionPanels[panelId]}
            {layoutMode ? (
              <>
                <button
                  type="button"
                  className="story-layout__move-surface"
                  aria-label={`Move ${panelId} card`}
                  onPointerDown={beginEdit(panelId, "move")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="story-layout__resize-handle"
                  aria-label={`Resize ${panelId} card`}
                  onPointerDown={beginEdit(panelId, "resize")}
                >
                  <Grip />
                </Button>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
