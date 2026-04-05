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
      columnCount: 20,
      columnGap: 4,
      rowHeight: 200,
      panels: {
        moves: {
          x: 20,
          y: 0,
          w: 100,
          h: 1
        }
      }
    });

    expect(layoutState.columnCount).toBe(16);
    expect(layoutState.columnGap).toBe(8);
    expect(layoutState.rowHeight).toBe(80);
    expect(layoutState.panels.moves.x).toBeLessThanOrEqual(15);
    expect(layoutState.panels.moves.h).toBeGreaterThanOrEqual(5);
  });

  it("blocks overlapping panel placements and keeps the prior rect", () => {
    const layoutState = getDefaultWorkspaceLayoutState();
    const canPlaceMovesOnBoard = canPlaceWorkspacePanel(layoutState, "moves", {
      x: 1,
      y: 1,
      w: 3,
      h: 5
    });
    const nextLayoutState = updateWorkspacePanelRect({
      layoutState,
      panelId: "moves",
      nextRect: {
        x: 1,
        y: 1,
        w: 3,
        h: 5
      }
    });

    expect(canPlaceMovesOnBoard).toBe(false);
    expect(nextLayoutState.panels.moves).toEqual(layoutState.panels.moves);
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
