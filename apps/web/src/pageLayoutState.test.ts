import { describe, expect, it } from "vitest";
import {
  canPlacePageLayoutPanel,
  getDefaultPageLayoutState,
  getPageLayoutRowCount,
  normalizePageLayoutState,
  setPageLayoutPanelVisible,
  updatePageLayoutPanelRect,
  updatePageLayoutColumnCount
} from "./pageLayoutState";

describe("pageLayoutState", () => {
  it("clamps invalid sizing values", () => {
    const layoutState = normalizePageLayoutState({
      value: {
        columnCount: 30,
        columnGap: 4,
        rowHeight: 300
      },
      variant: "three-pane",
      panelIds: ["intro", "index", "secondary", "detail"]
    });

    expect(layoutState.columnCount).toBe(24);
    expect(layoutState.columnGap).toBe(4);
    expect(layoutState.rowHeight).toBe(256);
    expect(layoutState.panels.detail.h).toBeLessThanOrEqual(256);
  });

  it("allows overlapping page panels when the user places them intentionally", () => {
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

    expect(canPlaceIndexOnIntro).toBe(true);
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

  it("defaults panel visibility to true when older layouts omit it", () => {
    const layoutState = normalizePageLayoutState({
      value: {
        columnCount: 12,
        panels: {
          intro: { x: 1, y: 1, w: 12, h: 5 }
        }
      },
      variant: "three-pane",
      panelIds: ["intro", "index", "secondary", "detail"]
    });

    expect(layoutState.visible.intro).toBe(true);
    expect(layoutState.visible.index).toBe(true);
    expect(layoutState.visible.secondary).toBe(true);
    expect(layoutState.visible.detail).toBe(true);
  });

  it("ignores hidden panels when calculating row count", () => {
    const layoutState = updatePageLayoutPanelRect({
      layoutState: getDefaultPageLayoutState("three-pane"),
      panelIds: ["intro", "index", "secondary", "detail"],
      panelId: "detail",
      variant: "three-pane",
      nextRect: {
        x: 7,
        y: 30,
        w: 6,
        h: 10
      }
    });
    const hiddenDetailLayout = setPageLayoutPanelVisible({
      layoutState,
      panelId: "detail",
      visible: false
    });

    expect(
      getPageLayoutRowCount({
        layoutState,
        panelIds: ["intro", "index", "secondary", "detail"]
      })
    ).toBe(39);
    expect(
      getPageLayoutRowCount({
        layoutState: hiddenDetailLayout,
        panelIds: ["intro", "index", "secondary", "detail"]
      })
    ).toBeLessThan(39);
  });
});
