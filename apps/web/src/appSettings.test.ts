import { describe, expect, it } from "vitest";
import {
  getDefaultAppSettings,
  normalizeAppSettings
} from "./appSettings";

describe("appSettings", () => {
  it("returns stable defaults", () => {
    expect(getDefaultAppSettings()).toEqual({
      theme: "light",
      defaultViewMode: "board",
      showBoardCoordinates: true,
      showDistrictLabels: true,
      showRecentCharacterActions: true,
      showLayoutGrid: true,
      highlightColor: "blue",
      customHighlightColor: "#2563eb"
    });
  });

  it("normalizes partial or invalid persisted settings", () => {
    expect(
      normalizeAppSettings({
        theme: "dark",
        defaultViewMode: "map",
        showBoardCoordinates: false,
        showLayoutGrid: "yes"
      })
    ).toEqual({
      theme: "dark",
      defaultViewMode: "map",
      showBoardCoordinates: false,
      showDistrictLabels: true,
      showRecentCharacterActions: true,
      showLayoutGrid: true,
      highlightColor: "blue",
      customHighlightColor: "#2563eb"
    });
  });

  it("normalizes a persisted custom highlight color", () => {
    expect(
      normalizeAppSettings({
        highlightColor: "custom",
        customHighlightColor: "#D946EF"
      })
    ).toMatchObject({
      highlightColor: "custom",
      customHighlightColor: "#d946ef"
    });
  });
});
