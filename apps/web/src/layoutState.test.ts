import { describe, expect, it } from "vitest";
import {
  canPlaceWorkspacePanel,
  getDefaultWorkspaceLayoutState,
  getWorkspaceGridUnitFractions,
  getWorkspaceLayoutRowCount,
  normalizeWorkspaceLayoutState,
  updateWorkspacePanelRect
} from "./layoutState";

describe("layoutState", () => {
  it("normalizes incomplete layout payloads to safe defaults", () => {
    const layoutState = normalizeWorkspaceLayoutState({
      columnFractions: [2, "bad", 0.1],
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

    expect(layoutState.columnFractions).toEqual([2, 1, 0.5]);
    expect(layoutState.rowHeight).toBe(80);
    expect(layoutState.panels.moves.x).toBeLessThanOrEqual(11);
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

  it("derives column unit fractions and row counts for the editor grid", () => {
    const unitFractions = getWorkspaceGridUnitFractions([1.5, 1, 1]);
    const rowCount = getWorkspaceLayoutRowCount(getDefaultWorkspaceLayoutState());

    expect(unitFractions).toEqual([0.25, 1 / 3, 1 / 3]);
    expect(rowCount).toBeGreaterThanOrEqual(18);
  });
});
