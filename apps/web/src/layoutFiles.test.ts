import { describe, expect, it } from "vitest";
import {
  createWorkspaceLayoutFileName,
  createWorkspaceLayoutFileRecord,
  normalizeWorkspaceLayoutFileRecord,
  normalizeWorkspaceLayoutName,
  rememberWorkspaceLayoutFile
} from "./layoutFiles";
import { getDefaultWorkspaceLayoutState } from "./layoutState";

describe("layoutFiles", () => {
  it("normalizes layout names into stable file names", () => {
    expect(normalizeWorkspaceLayoutName("  Analysis Layout  ")).toBe("Analysis Layout");
    expect(createWorkspaceLayoutFileName("  Analysis Layout  ")).toBe(
      "analysis-layout.workspace-layout.json"
    );
  });

  it("creates and normalizes layout file records", () => {
    const layoutState = getDefaultWorkspaceLayoutState();
    const layoutFile = createWorkspaceLayoutFileRecord({
      name: "Review layout",
      layoutState,
      savedAt: "2026-04-04T10:30:00.000Z"
    });
    const normalizedFile = normalizeWorkspaceLayoutFileRecord({
      ...layoutFile,
      layoutState: {
        ...layoutState,
        rowHeight: 999
      }
    });

    expect(layoutFile.name).toBe("Review layout");
    expect(normalizedFile?.layoutState.rowHeight).toBe(80);
  });

  it("remembers the latest named layout file without duplicates", () => {
    window.localStorage.clear();

    const firstPass = rememberWorkspaceLayoutFile({
      name: "Analysis layout",
      fileName: "analysis-layout.workspace-layout.json",
      relativePath: "content/layouts/analysis-layout.workspace-layout.json",
      savedAt: "2026-04-04T10:00:00.000Z"
    });
    const secondPass = rememberWorkspaceLayoutFile({
      name: "Analysis layout",
      fileName: "analysis-layout.workspace-layout.json",
      relativePath: "content/layouts/analysis-layout.workspace-layout.json",
      savedAt: "2026-04-04T11:00:00.000Z"
    });

    expect(firstPass).toHaveLength(1);
    expect(secondPass).toHaveLength(1);
    expect(secondPass[0]?.savedAt).toBe("2026-04-04T11:00:00.000Z");
  });
});
