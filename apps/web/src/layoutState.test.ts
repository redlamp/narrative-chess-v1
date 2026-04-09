import { describe, expect, it } from "vitest";
import {
  canPlaceWorkspacePanel,
  getDefaultWorkspaceLayoutState,
  getWorkspaceLayoutRowCount,
  normalizeWorkspaceLayoutState,
  setWorkspacePanelVisible,
  updateWorkspaceColumnCount,
  updateWorkspacePanelRect
} from "./layoutState";

describe("layoutState", () => {
  it("normalizes incomplete layout payloads to safe defaults", () => {
    const layoutState = normalizeWorkspaceLayoutState({
      columnCount: 30,
      columnGap: 4,
      rowHeight: 300,
      panels: {
        moves: {
          x: 20,
          y: 0,
          w: 100,
          h: 1
        }
      }
    });

    expect(layoutState.columnCount).toBe(24);
    expect(layoutState.columnGap).toBe(4);
    expect(layoutState.rowHeight).toBe(256);
    expect(layoutState.panels.moves.x).toBeLessThanOrEqual(23);
    expect(layoutState.panels.moves.h).toBeGreaterThanOrEqual(1);
    expect(layoutState.panels.moves.y).toBeLessThanOrEqual(256);
  });

  it("allows overlapping panel placements so the user can layer panels freely", () => {
    const layoutState = getDefaultWorkspaceLayoutState();
    const canPlaceMovesOnBoard = canPlaceWorkspacePanel(layoutState, "moves", {
      x: 1,
      y: 1,
      w: 3,
      h: 12
    });
    const nextLayoutState = updateWorkspacePanelRect({
      layoutState,
      panelId: "moves",
      nextRect: {
        x: 1,
        y: 1,
        w: 3,
        h: 12
      }
    });

    expect(canPlaceMovesOnBoard).toBe(true);
    expect(nextLayoutState.panels.moves.h).toBe(12);
    expect(nextLayoutState.panels.moves.x).toBe(1);
    expect(nextLayoutState.panels["recent-games"].y).toBe(
      layoutState.panels["recent-games"].y
    );
  });

  it("keeps layouts valid when the column count changes", () => {
    const resizedLayout = updateWorkspaceColumnCount({
      layoutState: getDefaultWorkspaceLayoutState(),
      value: 8
    });
    const rowCount = getWorkspaceLayoutRowCount(getDefaultWorkspaceLayoutState());

    expect(resizedLayout.columnCount).toBe(8);
    expect(resizedLayout.panels.board.w).toBeLessThanOrEqual(8);
    expect(resizedLayout.panels.moves.x + resizedLayout.panels.moves.w - 1).toBeLessThanOrEqual(8);
    expect(rowCount).toBeGreaterThanOrEqual(18);
  });

  it("keeps the recent-games panel finite when loading defaults", () => {
    const layoutState = getDefaultWorkspaceLayoutState();

    expect(layoutState.panels["recent-games"].w).toBeGreaterThanOrEqual(2);
    expect(layoutState.panels["recent-games"].h).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(layoutState.panels["recent-games"].x)).toBe(true);
    expect(Number.isFinite(layoutState.panels["recent-games"].y)).toBe(true);
    expect(layoutState.panels["city-map"].w).toBeGreaterThanOrEqual(1);
    expect(layoutState.panels["city-map"].h).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(layoutState.panels["city-map"].x)).toBe(true);
    expect(Number.isFinite(layoutState.panels["city-map"].y)).toBe(true);
    expect(layoutState.panels["city-map-maplibre"].w).toBeGreaterThanOrEqual(1);
    expect(layoutState.panels["city-map-maplibre"].h).toBeGreaterThanOrEqual(1);
    expect(Number.isFinite(layoutState.panels["city-map-maplibre"].x)).toBe(true);
    expect(Number.isFinite(layoutState.panels["city-map-maplibre"].y)).toBe(true);
  });

  it("migrates legacy narrative panels into split story panels", () => {
    const layoutState = normalizeWorkspaceLayoutState({
      columnCount: 12,
      panels: {
        board: { x: 1, y: 1, w: 6, h: 8 },
        moves: { x: 7, y: 1, w: 3, h: 8 },
        narrative: { x: 1, y: 9, w: 10, h: 8 },
        "recent-games": { x: 10, y: 1, w: 3, h: 8 }
      },
      collapsed: {
        moves: false,
        narrative: true,
        "recent-games": false
      }
    });

    expect(layoutState.panels["story-beat"].w).toBeGreaterThanOrEqual(2);
    expect(layoutState.panels["story-tile"].w).toBeGreaterThanOrEqual(2);
    expect(layoutState.panels["story-character"].w).toBeGreaterThanOrEqual(2);
    expect(layoutState.panels["story-tone"].w).toBeGreaterThanOrEqual(2);
    expect(layoutState.collapsed["story-beat"]).toBe(true);
    expect(layoutState.collapsed["story-tile"]).toBe(true);
    expect(layoutState.collapsed["story-character"]).toBe(true);
    expect(layoutState.collapsed["story-tone"]).toBe(true);
  });

  it("defaults panel visibility to true when older layouts omit it", () => {
    const layoutState = normalizeWorkspaceLayoutState({
      columnCount: 12,
      panels: {
        board: { x: 1, y: 1, w: 6, h: 8 }
      }
    });

    expect(layoutState.visible.board).toBe(true);
    expect(layoutState.visible["city-map"]).toBe(true);
    expect(layoutState.visible["city-map-maplibre"]).toBe(true);
    expect(layoutState.visible["recent-games"]).toBe(true);
  });

  it("ignores hidden panels when calculating row count", () => {
    const layoutState = updateWorkspacePanelRect({
      layoutState: getDefaultWorkspaceLayoutState(),
      panelId: "recent-games",
      nextRect: {
        x: 1,
        y: 30,
        w: 3,
        h: 6
      }
    });
    const hiddenBottomPanelLayout = setWorkspacePanelVisible({
      layoutState,
      panelId: "recent-games",
      visible: false
    });

    expect(getWorkspaceLayoutRowCount(layoutState)).toBe(35);
    expect(getWorkspaceLayoutRowCount(hiddenBottomPanelLayout)).toBeLessThan(35);
    expect(hiddenBottomPanelLayout.visible["recent-games"]).toBe(false);
  });

  it("can fit to visible rendered panels when a lower minimum row floor is requested", () => {
    const compactLayout = normalizeWorkspaceLayoutState({
      columnCount: 12,
      panels: {
        board: { x: 1, y: 1, w: 4, h: 6 },
        moves: { x: 5, y: 1, w: 2, h: 6 },
        "city-map": { x: 7, y: 1, w: 3, h: 3 },
        "city-map-maplibre": { x: 10, y: 1, w: 3, h: 3 },
        "story-beat": { x: 1, y: 7, w: 4, h: 2 },
        "story-tile": { x: 5, y: 7, w: 4, h: 2 },
        "story-character": { x: 9, y: 7, w: 4, h: 2 },
        "story-tone": { x: 1, y: 9, w: 4, h: 1 },
        "recent-games": { x: 5, y: 9, w: 4, h: 2 }
      }
    });

    expect(getWorkspaceLayoutRowCount(compactLayout, 1)).toBe(10);
  });

  it("uses collapsed render height when calculating row count", () => {
    const layoutState = updateWorkspacePanelRect({
      layoutState: getDefaultWorkspaceLayoutState(),
      panelId: "recent-games",
      nextRect: {
        x: 1,
        y: 20,
        w: 3,
        h: 8
      }
    });
    const collapsedLayout = {
      ...layoutState,
      collapsed: {
        ...layoutState.collapsed,
        "recent-games": true
      }
    };

    expect(getWorkspaceLayoutRowCount(layoutState, 1)).toBe(27);
    expect(getWorkspaceLayoutRowCount(collapsedLayout, 1)).toBe(20);
  });
});
