import { describe, expect, it } from "vitest";
import {
  canPlaceWorkspacePanel,
  getDefaultWorkspaceLayoutState,
  getWorkspaceLayoutRowCount,
  normalizeWorkspaceLayoutState,
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
  });

  it("reflows overlapping panel placements by moving lower panels down", () => {
    const layoutState = getDefaultWorkspaceLayoutState();
    const canPlaceMovesOnBoard = canPlaceWorkspacePanel(layoutState, "moves", {
      x: 7,
      y: 1,
      w: 3,
      h: 12
    });
    const nextLayoutState = updateWorkspacePanelRect({
      layoutState,
      panelId: "moves",
      nextRect: {
        x: 7,
        y: 1,
        w: 3,
        h: 12
      }
    });

    expect(canPlaceMovesOnBoard).toBe(false);
    expect(nextLayoutState.panels.moves.h).toBe(12);
    expect(nextLayoutState.panels.saved.y).toBeGreaterThan(layoutState.panels.saved.y);
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
});
