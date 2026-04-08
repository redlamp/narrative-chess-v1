import { describe, expect, it } from "vitest";
import {
  createPageLayoutFileName,
  createPageLayoutFileRecord,
  forgetPageLayoutFile,
  normalizePageLayoutFileRecord,
  normalizePageLayoutName,
  rememberPageLayoutFile
} from "./pageLayoutFiles";
import { getDefaultPageLayoutState } from "./pageLayoutState";

describe("pageLayoutFiles", () => {
  it("normalizes page layout names into stable file names", () => {
    expect(normalizePageLayoutName("  Review Layout  ")).toBe("Review Layout");
    expect(
      createPageLayoutFileName({
        layoutKey: "cities-page",
        name: "  Review Layout  "
      })
    ).toBe("cities-page--review-layout.page-layout.json");
  });

  it("creates and normalizes page layout file records", () => {
    const layoutState = getDefaultPageLayoutState("three-pane");
    const layoutFile = createPageLayoutFileRecord({
      layoutKey: "cities-page",
      layoutVariant: "three-pane",
      panelIds: ["intro", "index", "secondary", "detail"],
      name: "Review layout",
      layoutState,
      savedAt: "2026-04-08T10:30:00.000Z"
    });
    const normalizedFile = normalizePageLayoutFileRecord({
      value: {
        ...layoutFile,
        layoutState: {
          ...layoutState,
          rowHeight: 999
        }
      },
      layoutKey: "cities-page",
      layoutVariant: "three-pane",
      panelIds: ["intro", "index", "secondary", "detail"]
    });

    expect(layoutFile.name).toBe("Review layout");
    expect(normalizedFile?.layoutState.rowHeight).toBe(256);
  });

  it("remembers named page layout files without duplicates", () => {
    window.localStorage.clear();

    const firstPass = rememberPageLayoutFile({
      layoutKey: "cities-page",
      name: "Review layout",
      fileName: "cities-page--review-layout.page-layout.json",
      relativePath: "content/layouts/cities-page--review-layout.page-layout.json",
      savedAt: "2026-04-08T10:00:00.000Z"
    });
    const secondPass = rememberPageLayoutFile({
      layoutKey: "cities-page",
      name: "Review layout",
      fileName: "cities-page--review-layout.page-layout.json",
      relativePath: "content/layouts/cities-page--review-layout.page-layout.json",
      savedAt: "2026-04-08T11:00:00.000Z"
    });

    expect(firstPass).toHaveLength(1);
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0]?.savedAt).toBe("2026-04-08T11:00:00.000Z");
  });

  it("forgets named page layout files by file name", () => {
    window.localStorage.clear();

    rememberPageLayoutFile({
      layoutKey: "cities-page",
      name: "Review layout",
      fileName: "cities-page--review-layout.page-layout.json",
      relativePath: "content/layouts/cities-page--review-layout.page-layout.json",
      savedAt: "2026-04-08T11:00:00.000Z"
    });

    const nextFiles = forgetPageLayoutFile(
      "cities-page--review-layout.page-layout.json",
      "cities-page"
    );

    expect(nextFiles).toHaveLength(0);
  });
});
