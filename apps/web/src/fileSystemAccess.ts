import {
  cityBoardSchema,
  referenceGameLibrarySchema,
  type CityBoard,
  type ReferenceGame
} from "@narrative-chess/content-schema";
import { hydrateRoleCatalogDraft, type RoleCatalog } from "./roleCatalog";
import { hydrateEdinburghBoardDraft } from "./edinburghReviewState";
import {
  createWorkspaceLayoutFileName,
  createWorkspaceLayoutFileRecord,
  normalizeWorkspaceLayoutName,
  normalizeWorkspaceLayoutFileRecord,
  rememberWorkspaceLayoutFile,
  type WorkspaceLayoutFileReference
} from "./layoutFiles";
import { type WorkspaceLayoutState } from "./layoutState";
import {
  createPageLayoutFileName,
  createPageLayoutFileRecord,
  rememberPageLayoutFile
} from "./pageLayoutFiles";
import {
  type PageLayoutPanelId,
  type PageLayoutState,
  type PageLayoutVariant
} from "./pageLayoutState";
import {
  createWorkspaceLayoutBundle,
  applyWorkspaceLayoutBundle,
  normalizeWorkspaceLayoutBundle,
  type WorkspaceLayoutBundle
} from "./pageLayoutBundle";

type LocalPermissionState = "granted" | "denied" | "prompt";

type LocalFileSystemPermissionDescriptor = {
  mode?: "read" | "readwrite";
};

type LocalFileSystemHandle = {
  kind: "file" | "directory";
  name: string;
  queryPermission?: (
    descriptor?: LocalFileSystemPermissionDescriptor
  ) => Promise<LocalPermissionState>;
  requestPermission?: (
    descriptor?: LocalFileSystemPermissionDescriptor
  ) => Promise<LocalPermissionState>;
  removeEntry?: (name: string, options?: { recursive?: boolean }) => Promise<void>;
};

type LocalFileSystemWritableFileStream = {
  write(data: string | Blob | BufferSource): Promise<void>;
  close(): Promise<void>;
};

export type LocalDirectoryHandle = LocalFileSystemHandle & {
  kind: "directory";
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<LocalDirectoryHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<LocalFileHandle>;
};

type LocalFileHandle = LocalFileSystemHandle & {
  kind: "file";
  getFile(): Promise<File>;
  createWritable(options?: {
    keepExistingData?: boolean;
  }): Promise<LocalFileSystemWritableFileStream>;
};

type LocalWindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<LocalDirectoryHandle>;
};

type LocalSaveTarget = {
  directoryHandle: LocalDirectoryHandle;
  fileName: string;
  displayPath: string;
  fileExists: boolean;
};

const localClassicGamesFileName = "classic-games.local.json";
const canonicalClassicGamesFileName = "classic-games.json";
const localRoleCatalogFileName = "role-catalog.local.json";
const canonicalRoleCatalogFileName = "role-catalog.json";
const directoryDbName = "narrative-chess-local-content";
const directoryStoreName = "handles";
const cityReviewDirectoryHandleKey = "city-review-directory";
const classicGamesDirectoryHandleKey = "classic-games-directory";
const roleCatalogDirectoryHandleKey = "role-catalog-directory";
const workspaceLayoutDirectoryHandleKey = "workspace-layout-directory";
const pieceStylesDirectoryHandleKey = "piece-styles-directory";

type PersistedHandleRecord = {
  id: string;
  handle: LocalDirectoryHandle;
};

type LoadedDirectoryDraft = {
  board: CityBoard;
  relativePath: string;
  sourceKind: "draft" | "canonical";
};

type LoadedWorkspaceLayoutFile = {
  directoryName: string;
  fileName: string;
  layoutName: string;
  layoutState: WorkspaceLayoutState;
  relativePath: string;
  savedAt: string;
  knownFiles: WorkspaceLayoutFileReference[];
};

type LoadedPieceStyles = {
  directoryName: string;
  fileName: string;
  cssText: string;
  relativePath: string;
  sourceKind: "draft" | "canonical";
};

type LoadedClassicGamesLibrary = {
  directoryName: string;
  fileName: string;
  games: ReferenceGame[];
  relativePath: string;
  sourceKind: "draft" | "canonical";
};

type LoadedRoleCatalogLibrary = {
  directoryName: string;
  fileName: string;
  relativePath: string;
  roleCatalog: RoleCatalog;
  sourceKind: "draft" | "canonical";
};

function openDirectoryDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(directoryDbName, 1);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(directoryStoreName)) {
        database.createObjectStore(directoryStoreName, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open the local content handle database."));
  });
}

async function readStoredDirectoryHandle(handleKey: string) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  const database = await openDirectoryDatabase();

  return new Promise<LocalDirectoryHandle | null>((resolve, reject) => {
    const transaction = database.transaction(directoryStoreName, "readonly");
    const store = transaction.objectStore(directoryStoreName);
    const request = store.get(handleKey);

    request.onsuccess = () => {
      const result = request.result as PersistedHandleRecord | undefined;
      resolve(result?.handle ?? null);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not read the saved directory handle."));
  });
}

async function writeStoredDirectoryHandle(handleKey: string, handle: LocalDirectoryHandle) {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return;
  }

  const database = await openDirectoryDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(directoryStoreName, "readwrite");
    const store = transaction.objectStore(directoryStoreName);
    const request = store.put({
      id: handleKey,
      handle
    } satisfies PersistedHandleRecord);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error ?? new Error("Could not store the selected directory handle."));
  });
}

async function getOptionalDirectoryHandle(
  directoryHandle: LocalDirectoryHandle,
  name: string
) {
  try {
    return await directoryHandle.getDirectoryHandle(name);
  } catch {
    return null;
  }
}

async function getOrCreateDirectoryHandle(
  directoryHandle: LocalDirectoryHandle,
  name: string
) {
  return directoryHandle.getDirectoryHandle(name, { create: true });
}

async function getOptionalFileHandle(
  directoryHandle: LocalDirectoryHandle,
  name: string
) {
  try {
    return await directoryHandle.getFileHandle(name);
  } catch {
    return null;
  }
}

async function readTextFile(directoryHandle: LocalDirectoryHandle, name: string) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(name);
    const file = await fileHandle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}

function makeTarget(
  directoryHandle: LocalDirectoryHandle,
  fileName: string,
  pathPrefix: string,
  fileExists: boolean
): LocalSaveTarget {
  return {
    directoryHandle,
    fileName,
    displayPath: pathPrefix ? `${pathPrefix}/${fileName}` : fileName,
    fileExists
  };
}

async function buildTargetWithExistenceCheck(
  directoryHandle: LocalDirectoryHandle,
  fileName: string,
  pathPrefix: string
): Promise<LocalSaveTarget> {
  const existing = await getOptionalFileHandle(directoryHandle, fileName);
  return makeTarget(directoryHandle, fileName, pathPrefix, Boolean(existing));
}

type ResolveTargetOptions = {
  createInContent?: boolean;
  matchRootName?: boolean;
  matchRootNameFirst?: boolean;
  createInRoot?: boolean;
};

async function resolveSubdirSaveTarget(
  rootDirectoryHandle: LocalDirectoryHandle,
  subdir: string,
  fileName: string,
  options: ResolveTargetOptions = {}
): Promise<LocalSaveTarget> {
  const {
    createInContent = false,
    matchRootName = false,
    matchRootNameFirst = false,
    createInRoot = false
  } = options;

  if (matchRootNameFirst && rootDirectoryHandle.name.toLowerCase() === subdir) {
    return buildTargetWithExistenceCheck(rootDirectoryHandle, fileName, "");
  }

  const contentDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, "content");
  if (contentDirectory) {
    const subDirectory = createInContent
      ? await getOrCreateDirectoryHandle(contentDirectory, subdir)
      : await getOptionalDirectoryHandle(contentDirectory, subdir);
    if (subDirectory) {
      return buildTargetWithExistenceCheck(subDirectory, fileName, `content/${subdir}`);
    }
  }

  const directSubDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, subdir);
  if (directSubDirectory) {
    return buildTargetWithExistenceCheck(directSubDirectory, fileName, subdir);
  }

  if (matchRootName && rootDirectoryHandle.name.toLowerCase() === subdir) {
    return buildTargetWithExistenceCheck(rootDirectoryHandle, fileName, "");
  }

  if (createInRoot) {
    const newSubDirectory = await getOrCreateDirectoryHandle(rootDirectoryHandle, subdir);
    return buildTargetWithExistenceCheck(newSubDirectory, fileName, subdir);
  }

  return buildTargetWithExistenceCheck(rootDirectoryHandle, fileName, "");
}

async function collectExistingSubdirTargets(
  rootDirectoryHandle: LocalDirectoryHandle,
  subdir: string,
  fileName: string,
  options: {
    matchRootName?: boolean;
    matchRootNameFirst?: boolean;
    includeRootFile?: boolean;
  } = {}
): Promise<LocalSaveTarget[]> {
  const {
    matchRootName = false,
    matchRootNameFirst = false,
    includeRootFile = true
  } = options;
  const targets: LocalSaveTarget[] = [];

  if (matchRootNameFirst && rootDirectoryHandle.name.toLowerCase() === subdir) {
    const file = await getOptionalFileHandle(rootDirectoryHandle, fileName);
    if (file) {
      targets.push(makeTarget(rootDirectoryHandle, fileName, "", true));
    }
  }

  const contentDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, "content");
  if (contentDirectory) {
    const subDirectory = await getOptionalDirectoryHandle(contentDirectory, subdir);
    if (subDirectory) {
      const file = await getOptionalFileHandle(subDirectory, fileName);
      if (file) {
        targets.push(makeTarget(subDirectory, fileName, `content/${subdir}`, true));
      }
    }
  }

  const directSubDirectory = await getOptionalDirectoryHandle(rootDirectoryHandle, subdir);
  if (directSubDirectory) {
    const file = await getOptionalFileHandle(directSubDirectory, fileName);
    if (file) {
      targets.push(makeTarget(directSubDirectory, fileName, subdir, true));
    }
  }

  if (matchRootName && rootDirectoryHandle.name.toLowerCase() === subdir) {
    const file = await getOptionalFileHandle(rootDirectoryHandle, fileName);
    if (file) {
      targets.push(makeTarget(rootDirectoryHandle, fileName, "", true));
    }
  }

  if (includeRootFile) {
    const directFile = await getOptionalFileHandle(rootDirectoryHandle, fileName);
    if (directFile) {
      targets.push(makeTarget(rootDirectoryHandle, fileName, "", true));
    }
  }

  return targets;
}

async function ensureReadWritePermission(handle: LocalFileSystemHandle) {
  const descriptor = { mode: "readwrite" as const };

  if (handle.queryPermission) {
    const permission = await handle.queryPermission(descriptor);
    if (permission === "granted") {
      return;
    }
  }

  if (handle.requestPermission) {
    const permission = await handle.requestPermission(descriptor);
    if (permission === "granted") {
      return;
    }
  }

  throw new Error("Read/write permission was not granted for the selected folder.");
}

function createCityFileStem(cityId: string) {
  return normalizeWorkspaceLayoutName(cityId)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "city";
}

function createCityDraftFileName(cityId: string) {
  return `${createCityFileStem(cityId)}-board.local.json`;
}

function createCityCanonicalFileName(cityId: string) {
  return `${createCityFileStem(cityId)}-board.json`;
}

async function resolveCityBoardTarget(
  rootDirectoryHandle: LocalDirectoryHandle,
  cityId: string
): Promise<LocalSaveTarget> {
  return resolveSubdirSaveTarget(rootDirectoryHandle, "cities", createCityDraftFileName(cityId));
}

async function resolveCityBoardSearchTargets(
  rootDirectoryHandle: LocalDirectoryHandle,
  cityId: string
) {
  return collectExistingSubdirTargets(
    rootDirectoryHandle,
    "cities",
    createCityDraftFileName(cityId)
  );
}

async function resolveClassicGamesTarget(
  rootDirectoryHandle: LocalDirectoryHandle
): Promise<LocalSaveTarget> {
  return resolveSubdirSaveTarget(rootDirectoryHandle, "games", localClassicGamesFileName);
}

async function resolveClassicGamesSearchTargets(
  rootDirectoryHandle: LocalDirectoryHandle
) {
  return collectExistingSubdirTargets(rootDirectoryHandle, "games", localClassicGamesFileName);
}

async function resolveRoleCatalogTarget(
  rootDirectoryHandle: LocalDirectoryHandle
): Promise<LocalSaveTarget> {
  return resolveSubdirSaveTarget(rootDirectoryHandle, "roles", localRoleCatalogFileName, {
    createInContent: true,
    matchRootName: true,
    createInRoot: true
  });
}

async function resolveRoleCatalogSearchTargets(
  rootDirectoryHandle: LocalDirectoryHandle
) {
  return collectExistingSubdirTargets(rootDirectoryHandle, "roles", localRoleCatalogFileName, {
    matchRootName: true
  });
}

async function resolveWorkspaceLayoutTarget(
  rootDirectoryHandle: LocalDirectoryHandle,
  fileName: string
): Promise<LocalSaveTarget> {
  return resolveSubdirSaveTarget(rootDirectoryHandle, "layouts", fileName, {
    createInContent: true,
    matchRootNameFirst: true,
    createInRoot: true
  });
}

async function resolveWorkspaceLayoutSearchTargets(
  rootDirectoryHandle: LocalDirectoryHandle,
  fileName: string
) {
  return collectExistingSubdirTargets(rootDirectoryHandle, "layouts", fileName, {
    matchRootNameFirst: true
  });
}

const pieceStylesDraftFileName = "piece-styles.local.css";

async function resolvePieceStylesTarget(
  rootDirectoryHandle: LocalDirectoryHandle
): Promise<LocalSaveTarget> {
  return resolveSubdirSaveTarget(rootDirectoryHandle, "styles", pieceStylesDraftFileName, {
    createInContent: true,
    matchRootNameFirst: true,
    createInRoot: true
  });
}

async function resolvePieceStylesSearchTargets(rootDirectoryHandle: LocalDirectoryHandle) {
  return collectExistingSubdirTargets(rootDirectoryHandle, "styles", pieceStylesDraftFileName, {
    matchRootNameFirst: true
  });
}

export function supportsDirectoryWrite() {
  return (
    typeof window !== "undefined" &&
    typeof (window as LocalWindowWithDirectoryPicker).showDirectoryPicker === "function"
  );
}

export const supportsLocalContentDirectory = supportsDirectoryWrite;
export const supportsWorkspaceLayoutDirectory = supportsDirectoryWrite;

async function pickLocalDirectory() {
  const localWindow = window as LocalWindowWithDirectoryPicker;

  if (!supportsDirectoryWrite() || !localWindow.showDirectoryPicker) {
    throw new Error(
      "Directory save requires a browser that supports the File System Access API on localhost or HTTPS."
    );
  }

  return localWindow.showDirectoryPicker({
    mode: "readwrite"
  });
}

export async function connectClassicGamesDirectory() {
  const handle = await pickLocalDirectory();
  await writeStoredDirectoryHandle(classicGamesDirectoryHandleKey, handle);

  return {
    directoryName: handle.name
  };
}

export async function getConnectedClassicGamesDirectoryName() {
  const handle = await readStoredDirectoryHandle(classicGamesDirectoryHandleKey);
  return handle?.name ?? null;
}

export async function connectRoleCatalogDirectory() {
  const handle = await pickLocalDirectory();
  await writeStoredDirectoryHandle(roleCatalogDirectoryHandleKey, handle);

  return {
    directoryName: handle.name
  };
}

export async function getConnectedRoleCatalogDirectoryName() {
  const handle = await readStoredDirectoryHandle(roleCatalogDirectoryHandleKey);
  return handle?.name ?? null;
}

async function readJsonFile(
  directoryHandle: LocalDirectoryHandle,
  fileName: string
) {
  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text()) as unknown;
  } catch {
    return null;
  }
}

async function requireClassicGamesDirectoryHandle() {
  const handle = await readStoredDirectoryHandle(classicGamesDirectoryHandleKey);

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving classic games to disk.");
  }

  return handle;
}

export async function saveClassicGamesDraftToDirectory(games: ReferenceGame[]) {
  const handle = await requireClassicGamesDirectoryHandle();
  const parsedGames = referenceGameLibrarySchema.parse(games);

  await ensureReadWritePermission(handle);

  const target = await resolveClassicGamesTarget(handle);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(target.fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(parsedGames, null, 2)}\n`);
  await writable.close();

  return {
    directoryName: handle.name,
    displayPath: target.displayPath,
    mode: target.fileExists ? "updated" : "created",
    relativePath: target.displayPath
  } as const;
}

export async function loadClassicGamesFromDirectory(): Promise<LoadedClassicGamesLibrary | null> {
  const handle = await readStoredDirectoryHandle(classicGamesDirectoryHandleKey);
  if (!handle) {
    return null;
  }

  await ensureReadWritePermission(handle);

  const targets = await resolveClassicGamesSearchTargets(handle);
  for (const target of targets) {
    const rawGames = await readJsonFile(target.directoryHandle, target.fileName);
    const parsedGames = referenceGameLibrarySchema.safeParse(rawGames);

    if (!parsedGames.success) {
      continue;
    }

    return {
      directoryName: handle.name,
      fileName: target.fileName,
      games: parsedGames.data,
      relativePath: target.displayPath,
      sourceKind: target.fileName === localClassicGamesFileName ? "draft" : "canonical"
    };
  }

  const canonicalFile = await readJsonFile(handle, canonicalClassicGamesFileName);
  const parsedCanonical = referenceGameLibrarySchema.safeParse(canonicalFile);
  if (parsedCanonical.success) {
    return {
      directoryName: handle.name,
      fileName: canonicalClassicGamesFileName,
      games: parsedCanonical.data,
      relativePath: canonicalClassicGamesFileName,
      sourceKind: "canonical"
    };
  }

  return null;
}

async function requireRoleCatalogDirectoryHandle() {
  const handle = await readStoredDirectoryHandle(roleCatalogDirectoryHandleKey);

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving the role catalog to disk.");
  }

  return handle;
}

export async function saveRoleCatalogToDirectory(rootDirectoryHandle: LocalDirectoryHandle, roleCatalog: RoleCatalog) {
  const parsedRoleCatalog = hydrateRoleCatalogDraft({ roles: roleCatalog });
  await ensureReadWritePermission(rootDirectoryHandle);

  const target = await resolveRoleCatalogTarget(rootDirectoryHandle);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(target.fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify({ roles: parsedRoleCatalog }, null, 2)}\n`);
  await writable.close();

  return {
    displayPath: target.displayPath,
    mode: target.fileExists ? "updated" : "created"
  } as const;
}

export async function saveRoleCatalogDraftToDirectory(roleCatalog: RoleCatalog) {
  const handle = await requireRoleCatalogDirectoryHandle();
  const result = await saveRoleCatalogToDirectory(handle, roleCatalog);

  return {
    directoryName: handle.name,
    displayPath: result.displayPath,
    relativePath: result.displayPath,
    mode: result.mode
  };
}

async function loadRoleCatalogFromDirectoryHandle(
  rootDirectoryHandle: LocalDirectoryHandle
): Promise<LoadedRoleCatalogLibrary | null> {
  await ensureReadWritePermission(rootDirectoryHandle);

  const targets = await resolveRoleCatalogSearchTargets(rootDirectoryHandle);
  for (const target of targets) {
    const rawRoleCatalog = await readJsonFile(target.directoryHandle, target.fileName);
    if (!rawRoleCatalog) {
      continue;
    }

    return {
      directoryName: rootDirectoryHandle.name,
      fileName: target.fileName,
      roleCatalog: hydrateRoleCatalogDraft(rawRoleCatalog),
      relativePath: target.displayPath,
      sourceKind: target.fileName === localRoleCatalogFileName ? "draft" : "canonical"
    };
  }

  const canonicalFile = await readJsonFile(rootDirectoryHandle, canonicalRoleCatalogFileName);
  if (canonicalFile) {
    return {
      directoryName: rootDirectoryHandle.name,
      fileName: canonicalRoleCatalogFileName,
      roleCatalog: hydrateRoleCatalogDraft(canonicalFile),
      relativePath: canonicalRoleCatalogFileName,
      sourceKind: "canonical"
    };
  }

  return null;
}

export async function loadRoleCatalogFromDirectory(): Promise<LoadedRoleCatalogLibrary | null> {
  const handle = await readStoredDirectoryHandle(roleCatalogDirectoryHandleKey);

  if (!handle) {
    return null;
  }

  return loadRoleCatalogFromDirectoryHandle(handle);
}

async function requireCityReviewDirectoryHandle() {
  const handle = await readStoredDirectoryHandle(cityReviewDirectoryHandleKey);

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving city boards to disk.");
  }

  return handle;
}

async function saveCityBoardToDirectory(
  rootDirectoryHandle: LocalDirectoryHandle,
  board: CityBoard
) {
  const parsedBoard = cityBoardSchema.parse(board);
  await ensureReadWritePermission(rootDirectoryHandle);

  const target = await resolveCityBoardTarget(rootDirectoryHandle, parsedBoard.id);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(target.fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(parsedBoard, null, 2)}\n`);
  await writable.close();

  return {
    displayPath: target.displayPath,
    mode: target.fileExists ? "updated" : "created"
  } as const;
}

export async function saveCityDraftToDirectory(board: CityBoard) {
  const handle = await requireCityReviewDirectoryHandle();
  const result = await saveCityBoardToDirectory(handle, board);

  return {
    directoryName: handle.name,
    displayPath: result.displayPath,
    relativePath: result.displayPath,
    mode: result.mode
  };
}

export async function loadCityDraftFromDirectory(
  fallback: CityBoard
): Promise<LoadedDirectoryDraft | null> {
  const rootDirectoryHandle = await readStoredDirectoryHandle(cityReviewDirectoryHandleKey);

  if (!rootDirectoryHandle) {
    return null;
  }

  await ensureReadWritePermission(rootDirectoryHandle);

  const targets = await resolveCityBoardSearchTargets(rootDirectoryHandle, fallback.id);
  for (const target of targets) {
    const rawDraft = await readJsonFile(target.directoryHandle, target.fileName);
    if (rawDraft) {
      return {
        board: hydrateEdinburghBoardDraft(rawDraft, fallback),
        relativePath: target.displayPath,
        sourceKind: "draft"
      };
    }
  }

  const canonicalFileName = createCityCanonicalFileName(fallback.id);
  const canonicalFile = await readJsonFile(rootDirectoryHandle, canonicalFileName);
  if (canonicalFile) {
    return {
      board: hydrateEdinburghBoardDraft(canonicalFile, fallback),
      relativePath: canonicalFileName,
      sourceKind: "canonical"
    };
  }

  return null;
}

export async function connectWorkspaceLayoutDirectory() {
  const handle = await pickLocalDirectory();
  await writeStoredDirectoryHandle(workspaceLayoutDirectoryHandleKey, handle);

  return {
    directoryName: handle.name
  };
}

export async function getConnectedWorkspaceLayoutDirectoryName() {
  const handle = await readStoredDirectoryHandle(workspaceLayoutDirectoryHandleKey);
  return handle?.name ?? null;
}

async function requireWorkspaceLayoutDirectoryHandle() {
  const handle = await readStoredDirectoryHandle(workspaceLayoutDirectoryHandleKey);

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving a named layout file.");
  }

  return handle;
}

export async function saveWorkspaceLayoutFileToDirectory(input: {
  name: string;
  layoutState: WorkspaceLayoutState;
}) {
  const handle = await requireWorkspaceLayoutDirectoryHandle();
  const layoutFile = createWorkspaceLayoutFileRecord(input);
  const fileName = createWorkspaceLayoutFileName(layoutFile.name);

  await ensureReadWritePermission(handle);

  const target = await resolveWorkspaceLayoutTarget(handle, fileName);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(layoutFile, null, 2)}\n`);
  await writable.close();

  const knownFiles = rememberWorkspaceLayoutFile({
    name: layoutFile.name,
    fileName,
    relativePath: target.displayPath,
    savedAt: layoutFile.savedAt
  });

  return {
    directoryName: handle.name,
    fileName,
    knownFiles,
    layoutName: layoutFile.name,
    mode: target.fileExists ? "updated" : "created",
    relativePath: target.displayPath,
    savedAt: layoutFile.savedAt
  } as const;
}

export async function loadWorkspaceLayoutFileFromDirectory(
  name: string
): Promise<LoadedWorkspaceLayoutFile | null> {
  const handle = await requireWorkspaceLayoutDirectoryHandle();

  const normalizedName = normalizeWorkspaceLayoutName(name);
  const fileName = createWorkspaceLayoutFileName(normalizedName);

  await ensureReadWritePermission(handle);

  const targets = await resolveWorkspaceLayoutSearchTargets(handle, fileName);
  for (const target of targets) {
    const rawLayoutFile = await readJsonFile(target.directoryHandle, fileName);
    const parsedLayoutFile = normalizeWorkspaceLayoutFileRecord(rawLayoutFile);
    if (!parsedLayoutFile) {
      continue;
    }

    const knownFiles = rememberWorkspaceLayoutFile({
      name: parsedLayoutFile.name,
      fileName,
      relativePath: target.displayPath,
      savedAt: parsedLayoutFile.savedAt
    });

    return {
      directoryName: handle.name,
      fileName,
      knownFiles,
      layoutName: parsedLayoutFile.name,
      layoutState: parsedLayoutFile.layoutState,
      relativePath: target.displayPath,
      savedAt: parsedLayoutFile.savedAt
    };
  }

  return null;
}

export async function savePageLayoutFileToDirectory(input: {
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
  name: string;
  layoutState: PageLayoutState;
}) {
  const handle = await requireWorkspaceLayoutDirectoryHandle();
  const layoutFile = createPageLayoutFileRecord(input);
  const fileName = createPageLayoutFileName({
    layoutKey: input.layoutKey,
    name: layoutFile.name
  });

  await ensureReadWritePermission(handle);

  const target = await resolveWorkspaceLayoutTarget(handle, fileName);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${JSON.stringify(layoutFile, null, 2)}\n`);
  await writable.close();

  const knownFiles = rememberPageLayoutFile({
    layoutKey: layoutFile.layoutKey,
    name: layoutFile.name,
    fileName,
    relativePath: target.displayPath,
    savedAt: layoutFile.savedAt
  });

  return {
    directoryName: handle.name,
    fileName,
    knownFiles,
    layoutName: layoutFile.name,
    mode: target.fileExists ? "updated" : "created",
    relativePath: target.displayPath,
    savedAt: layoutFile.savedAt
  } as const;
}

export async function saveLayoutBundleToDirectory(input: {
  name: string;
}) {
  const handle = await requireWorkspaceLayoutDirectoryHandle();
  const bundle = createWorkspaceLayoutBundle(input.name);
  const fileName = `${toKebabCase(bundle.name || "workspace-layout")}.layout-bundle.json`;

  await ensureReadWritePermission(handle);
  const target = await resolveWorkspaceLayoutTarget(handle, fileName);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(`${JSON.stringify(bundle, null, 2)}\n`);
  await writable.close();

  return {
    directoryName: handle.name,
    fileName,
    bundleName: bundle.name,
    relativePath: target.displayPath,
    savedAt: bundle.savedAt
  } as const;
}

export async function loadLayoutBundleFromDirectory(input: {
  name: string;
}): Promise<{ directoryName: string; bundleName: string; relativePath: string; bundle: WorkspaceLayoutBundle } | null> {
  const handle = await requireWorkspaceLayoutDirectoryHandle();
  const fileName = `${toKebabCase(input.name || "workspace-layout")}.layout-bundle.json`;

  await ensureReadWritePermission(handle);
  const targets = await resolveWorkspaceLayoutSearchTargets(handle, fileName);

  for (const target of targets) {
    const raw = await readJsonFile(target.directoryHandle, fileName);
    const bundle = normalizeWorkspaceLayoutBundle(raw);
    if (!bundle) continue;

    applyWorkspaceLayoutBundle(bundle);

    return {
      directoryName: handle.name,
      bundleName: bundle.name,
      relativePath: target.displayPath,
      bundle
    };
  }

  return null;
}

function toKebabCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

async function requirePieceStylesDirectoryHandle() {
  const handle = await readStoredDirectoryHandle(pieceStylesDirectoryHandleKey);

  if (!handle) {
    throw new Error("Connect a repo root or content folder before saving piece styles to disk.");
  }

  return handle;
}

export async function connectPieceStylesDirectory() {
  const handle = await pickLocalDirectory();
  await writeStoredDirectoryHandle(pieceStylesDirectoryHandleKey, handle);

  return {
    directoryName: handle.name
  };
}

export async function getConnectedPieceStylesDirectoryName() {
  const handle = await readStoredDirectoryHandle(pieceStylesDirectoryHandleKey);
  return handle?.name ?? null;
}

async function savePieceStylesToDirectory(
  rootDirectoryHandle: LocalDirectoryHandle,
  cssText: string
) {
  await ensureReadWritePermission(rootDirectoryHandle);
  const target = await resolvePieceStylesTarget(rootDirectoryHandle);
  await ensureReadWritePermission(target.directoryHandle);

  const fileHandle = await target.directoryHandle.getFileHandle(target.fileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();

  await writable.write(`${cssText.trimEnd()}\n`);
  await writable.close();

  return {
    displayPath: target.displayPath,
    mode: target.fileExists ? "updated" : "created"
  } as const;
}

export async function savePieceStylesDraftToDirectory(cssText: string) {
  const handle = await requirePieceStylesDirectoryHandle();
  const result = await savePieceStylesToDirectory(handle, cssText);

  return {
    directoryName: handle.name,
    displayPath: result.displayPath,
    relativePath: result.displayPath,
    mode: result.mode
  };
}

export async function loadPieceStylesFromDirectory(): Promise<LoadedPieceStyles | null> {
  const handle = await readStoredDirectoryHandle(pieceStylesDirectoryHandleKey);

  if (!handle) {
    return null;
  }

  await ensureReadWritePermission(handle);

  const targets = await resolvePieceStylesSearchTargets(handle);
  for (const target of targets) {
    const cssText = await readTextFile(target.directoryHandle, target.fileName);
    if (cssText === null) {
      continue;
    }

    return {
      directoryName: handle.name,
      fileName: target.fileName,
      cssText,
      relativePath: target.displayPath,
      sourceKind: target.fileName === pieceStylesDraftFileName ? "draft" : "canonical"
    };
  }

  const canonicalText = await readTextFile(handle, "piece-styles.css");
  if (canonicalText !== null) {
    return {
      directoryName: handle.name,
      fileName: "piece-styles.css",
      cssText: canonicalText,
      relativePath: "piece-styles.css",
      sourceKind: "canonical"
    };
  }

  return null;
}
