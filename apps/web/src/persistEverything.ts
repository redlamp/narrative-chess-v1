import type { CityBoard } from "@narrative-chess/content-schema";
import {
  cityBoardDefinitions,
  type CityBoardDefinition
} from "./cityBoards";
import { listCityBoardDraft, saveCityBoardDraft } from "./cityReviewState";
import { edinburghBoard } from "./edinburghBoard";
import {
  loadClassicGamesFromDirectory,
  loadCityDraftFromDirectory,
  loadRoleCatalogFromDirectory,
  loadWorkspaceLayoutFileFromDirectory,
  saveCityDraftToDirectory,
  saveClassicGamesDraftToDirectory,
  savePageLayoutFileToDirectory,
  savePieceStylesDraftToDirectory,
  saveRoleCatalogDraftToDirectory,
  saveWorkspaceLayoutFileToDirectory
} from "./fileSystemAccess";
import {
  allPageLayoutTargets,
  listPageLayoutState,
  savePageLayoutState
} from "./pageLayoutState";
import { getBundledPageLayout, getBundledWorkspaceLayout } from "./bundledLayouts";
import {
  listKnownWorkspaceLayoutFiles,
  type WorkspaceLayoutFileReference
} from "./layoutFiles";
import {
  listWorkspaceLayoutState,
  saveWorkspaceLayoutState,
  type WorkspaceLayoutState
} from "./layoutState";
import { listRoleCatalog, saveRoleCatalog, type RoleCatalog } from "./roleCatalog";
import { savePieceStyleSheet } from "./pieceStyles";
import {
  listReferenceGames,
  saveReferenceGames,
  type ReferenceGameLibrary
} from "./referenceGames";
import { saveAppSettings, type AppSettings } from "./appSettings";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

export type PersistEverythingDeps = {
  isSavingEverything: boolean;
  isLoadingEverything: boolean;
  isResettingEverything: boolean;
  setIsSavingEverything: (value: boolean) => void;
  setIsLoadingEverything: (value: boolean) => void;
  setIsResettingEverything: (value: boolean) => void;
  setSaveEverythingNotice: (notice: LayoutFileNotice | null) => void;
  settings: AppSettings;
  workspaceLayout: WorkspaceLayoutState;
  setWorkspaceLayout: (state: WorkspaceLayoutState) => void;
  roleCatalog: RoleCatalog;
  setRoleCatalog: (catalog: RoleCatalog) => void;
  setRoleCatalogDirectoryName: (value: string | null) => void;
  pieceStyleSheet: string;
  setPieceStyleDirectoryName: (value: string | null) => void;
  referenceGamesLibrary: ReferenceGameLibrary;
  setReferenceGamesLibrary: (games: ReferenceGameLibrary) => void;
  setSelectedReferenceGameId: (updater: (current: string) => string) => void;
  setPlayCityBoard: (board: CityBoard) => void;
  layoutFileName: string;
  setLayoutFileName: (name: string) => void;
  setKnownLayoutFiles: (files: WorkspaceLayoutFileReference[]) => void;
  setLayoutDirectoryName: (value: string | null) => void;
};

export function resetEverything(deps: PersistEverythingDeps) {
  if (deps.isSavingEverything || deps.isLoadingEverything || deps.isResettingEverything) {
    return;
  }

  deps.setIsResettingEverything(true);

  try {
    const bundledWorkspace = getBundledWorkspaceLayout("match-workspace");
    if (bundledWorkspace) {
      saveWorkspaceLayoutState(bundledWorkspace.layoutState);
      deps.setWorkspaceLayout(bundledWorkspace.layoutState);
    }

    for (const target of allPageLayoutTargets) {
      const bundledLayout = getBundledPageLayout({
        layoutKey: target.layoutKey,
        layoutVariant: target.layoutVariant,
        panelIds: target.panelIds
      });
      if (bundledLayout) {
        savePageLayoutState({
          layoutKey: target.layoutKey,
          layoutState: bundledLayout.layoutState,
          variant: target.layoutVariant,
          panelIds: target.panelIds
        });
      }
    }

    window.location.reload();
  } finally {
    deps.setIsResettingEverything(false);
  }
}

export async function saveEverything(deps: PersistEverythingDeps) {
  if (deps.isSavingEverything || deps.isLoadingEverything) {
    return;
  }

  deps.setIsSavingEverything(true);
  deps.setSaveEverythingNotice(null);

  const savedItems: string[] = [];
  const failedItems: string[] = [];
  const recordSave = async (label: string, action: () => Promise<void>) => {
    try {
      await action();
      savedItems.push(label);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      failedItems.push(`${label}: ${message}`);
    }
  };

  try {
    saveAppSettings(deps.settings);
    saveWorkspaceLayoutState(deps.workspaceLayout);
    saveRoleCatalog(deps.roleCatalog);
    savePieceStyleSheet(deps.pieceStyleSheet);
    saveReferenceGames(deps.referenceGamesLibrary);
    cityBoardDefinitions.forEach((definition: CityBoardDefinition) => {
      saveCityBoardDraft(listCityBoardDraft(definition.id, definition.board));
    });
    savedItems.push("browser state");

    await recordSave("Play layout", async () => {
      const result = await saveWorkspaceLayoutFileToDirectory({
        name: deps.layoutFileName,
        layoutState: deps.workspaceLayout
      });
      deps.setKnownLayoutFiles(result.knownFiles);
      deps.setLayoutDirectoryName(result.directoryName);
      deps.setLayoutFileName(result.layoutName);
    });

    for (const target of allPageLayoutTargets) {
      await recordSave(`${target.name} layout`, async () => {
        const layoutState = listPageLayoutState({
          layoutKey: target.layoutKey,
          variant: target.layoutVariant,
          panelIds: target.panelIds
        });
        savePageLayoutState({
          layoutKey: target.layoutKey,
          layoutState,
          variant: target.layoutVariant,
          panelIds: target.panelIds
        });
        await savePageLayoutFileToDirectory({
          layoutKey: target.layoutKey,
          layoutVariant: target.layoutVariant,
          panelIds: target.panelIds,
          name: target.name,
          layoutState
        });
      });
    }

    for (const definition of cityBoardDefinitions) {
      await recordSave(`${definition.displayLabel} city data`, async () => {
        const board = listCityBoardDraft(definition.id, definition.board);
        const result = await saveCityDraftToDirectory(board);
        saveCityBoardDraft(board);
        deps.setSaveEverythingNotice({
          tone: "neutral",
          text: `Saving ${result.relativePath}...`
        });
      });
    }

    await recordSave("Historic games", async () => {
      await saveClassicGamesDraftToDirectory(deps.referenceGamesLibrary);
    });

    await recordSave("Character roles", async () => {
      const result = await saveRoleCatalogDraftToDirectory(deps.roleCatalog);
      deps.setRoleCatalogDirectoryName(result.directoryName);
    });

    await recordSave("Piece styles", async () => {
      const result = await savePieceStylesDraftToDirectory(deps.pieceStyleSheet);
      deps.setPieceStyleDirectoryName(result.directoryName);
    });

    deps.setSaveEverythingNotice({
      tone: failedItems.length ? "error" : "success",
      text: failedItems.length
        ? `Saved ${savedItems.length} item(s). ${failedItems.length} item(s) need a connected folder: ${failedItems.join(" | ")}`
        : `Saved everything: ${savedItems.join(", ")}.`
    });
  } finally {
    deps.setIsSavingEverything(false);
  }
}

export async function loadEverything(deps: PersistEverythingDeps) {
  if (deps.isSavingEverything || deps.isLoadingEverything) {
    return;
  }

  deps.setIsLoadingEverything(true);
  deps.setSaveEverythingNotice(null);

  const loadedItems: string[] = [];
  const skippedItems: string[] = [];
  const failedItems: string[] = [];
  const recordLoad = async (
    label: string,
    action: () => Promise<boolean>
  ) => {
    try {
      const didLoad = await action();
      if (didLoad) {
        loadedItems.push(label);
      } else {
        skippedItems.push(label);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      failedItems.push(`${label}: ${message}`);
    }
  };

  try {
    const nextWorkspaceLayout = listWorkspaceLayoutState();
    const nextRoleCatalog = listRoleCatalog();
    const nextReferenceGames = listReferenceGames();

    deps.setWorkspaceLayout(nextWorkspaceLayout);
    deps.setKnownLayoutFiles(listKnownWorkspaceLayoutFiles());
    deps.setRoleCatalog(nextRoleCatalog);
    deps.setReferenceGamesLibrary(nextReferenceGames);
    deps.setSelectedReferenceGameId((currentId) =>
      nextReferenceGames.some((game) => game.id === currentId)
        ? currentId
        : nextReferenceGames[0]?.id ?? ""
    );

    cityBoardDefinitions.forEach((definition) => {
      const board = listCityBoardDraft(definition.id, definition.board);
      saveCityBoardDraft(board);
      if (definition.id === edinburghBoard.id) {
        deps.setPlayCityBoard(board);
      }
    });

    loadedItems.push("browser state");

    await recordLoad("Play layout", async () => {
      const result = await loadWorkspaceLayoutFileFromDirectory(deps.layoutFileName);
      if (!result) {
        return false;
      }

      saveWorkspaceLayoutState(result.layoutState);
      deps.setWorkspaceLayout(result.layoutState);
      deps.setKnownLayoutFiles(result.knownFiles);
      deps.setLayoutDirectoryName(result.directoryName);
      deps.setLayoutFileName(result.layoutName);
      return true;
    });

    for (const definition of cityBoardDefinitions) {
      await recordLoad(`${definition.displayLabel} city data`, async () => {
        const result = await loadCityDraftFromDirectory(definition.board);
        if (!result) {
          return false;
        }

        const nextBoard = saveCityBoardDraft(result.board);
        if (definition.id === edinburghBoard.id) {
          deps.setPlayCityBoard(nextBoard);
        }
        return true;
      });
    }

    await recordLoad("Historic games", async () => {
      const result = await loadClassicGamesFromDirectory();
      if (!result) {
        return false;
      }

      const nextGames = saveReferenceGames(result.games);
      deps.setReferenceGamesLibrary(nextGames);
      deps.setSelectedReferenceGameId((currentId) =>
        nextGames.some((game) => game.id === currentId)
          ? currentId
          : nextGames[0]?.id ?? ""
      );
      return true;
    });

    await recordLoad("Character roles", async () => {
      const result = await loadRoleCatalogFromDirectory();
      if (!result) {
        return false;
      }

      const nextCatalog = saveRoleCatalog(result.roleCatalog);
      deps.setRoleCatalog(nextCatalog);
      deps.setRoleCatalogDirectoryName(result.directoryName);
      return true;
    });

    deps.setSaveEverythingNotice({
      tone: failedItems.length ? "error" : "success",
      text: failedItems.length
        ? `Loaded ${loadedItems.length} item(s). ${failedItems.length} failed: ${failedItems.join(" | ")}`
        : skippedItems.length
          ? `Loaded ${loadedItems.join(", ")}. Skipped: ${skippedItems.join(", ")}.`
          : `Loaded ${loadedItems.join(", ")}.`
    });
  } finally {
    deps.setIsLoadingEverything(false);
  }
}
