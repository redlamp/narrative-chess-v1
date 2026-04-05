import { describe, expect, it } from "vitest";
import {
  canPlacePageLayoutPanel,
  getDefaultPageLayoutState,
  getPageLayoutRowCount,
  normalizePageLayoutState,
  updatePageLayoutColumnCount
} from "./pageLayoutState";

describe("pageLayoutState", () => {
  it("clamps invalid sizing values", () => {
    const layoutState = normalizePageLayoutState({
      value: {
        columnCount: 20,
        columnGap: 4,
        rowHeight: 120
      },
      variant: "three-pane",
      panelIds: ["intro", "index", "secondary", "detail"]
    });

    expect(layoutState.columnCount).toBe(16);
    expect(layoutState.columnGap).toBe(8);
    expect(layoutState.rowHeight).toBe(80);
  });

  it("prevents overlapping panels", () => {
    const layoutState = getDefaultPageLayoutState("two-pane");
    const canPlaceIndexOnIntro = canPlacePageLayoutPanel({
      layoutState,
      panelIds: ["intro", "index", "detail"],
      panelId: "index",
      variant: "two-pane",
      nextRect: {
        x: 1,
        y: 1,
        w: 4,
        h: 6
      }
    });

    expect(canPlaceIndexOnIntro).toBe(false);
  });

  it("reflows active panels when the column count changes", () => {
    const resizedLayout = updatePageLayoutColumnCount({
      layoutState: getDefaultPageLayoutState("three-pane"),
      panelIds: ["intro", "index", "secondary", "detail"],
      variant: "three-pane",
      value: 8
    });
    const rowCount = getPageLayoutRowCount({
      layoutState: resizedLayout,
      panelIds: ["intro", "index", "secondary", "detail"]
    });

    expect(resizedLayout.columnCount).toBe(8);
    expect(resizedLayout.panels.detail.x + resizedLayout.panels.detail.w - 1).toBeLessThanOrEqual(8);
    expect(rowCount).toBeGreaterThanOrEqual(18);
  });
});
