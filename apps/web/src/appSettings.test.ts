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
      showLayoutGrid: true
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
      showLayoutGrid: true
    });
  });
});
