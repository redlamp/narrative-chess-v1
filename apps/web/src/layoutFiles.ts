import {
  normalizeWorkspaceLayoutState,
  type WorkspaceLayoutState
} from "./layoutState";

export type WorkspaceLayoutFileRecord = {
  version: 1;
  name: string;
  savedAt: string;
  layoutState: WorkspaceLayoutState;
};

export type WorkspaceLayoutFileReference = {
  name: string;
  fileName: string;
  relativePath: string;
  savedAt: string;
};

const knownWorkspaceLayoutFilesStorageKey = "narrative-chess:workspace-layout-files:v1";
const fallbackLayoutName = "match-workspace";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function normalizeSavedAt(value: unknown) {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const parsedAt = Date.parse(value);
  return Number.isNaN(parsedAt) ? new Date().toISOString() : new Date(parsedAt).toISOString();
}

export function normalizeWorkspaceLayoutName(value: string) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue || fallbackLayoutName;
}

export function createWorkspaceLayoutFileName(name: string) {
  const slug = normalizeWorkspaceLayoutName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || fallbackLayoutName}.workspace-layout.json`;
}

export function createWorkspaceLayoutFileRecord(input: {
  name: string;
  layoutState: WorkspaceLayoutState;
  savedAt?: string;
}): WorkspaceLayoutFileRecord {
  return {
    version: 1,
    name: normalizeWorkspaceLayoutName(input.name),
    savedAt: normalizeSavedAt(input.savedAt),
    layoutState: normalizeWorkspaceLayoutState(input.layoutState)
  };
}

export function normalizeWorkspaceLayoutFileRecord(
  value: unknown
): WorkspaceLayoutFileRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    version: 1,
    name: normalizeWorkspaceLayoutName(readString(value.name, fallbackLayoutName)),
    savedAt: normalizeSavedAt(value.savedAt),
    layoutState: normalizeWorkspaceLayoutState(value.layoutState)
  };
}

function normalizeWorkspaceLayoutFileReference(
  value: unknown
): WorkspaceLayoutFileReference | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = normalizeWorkspaceLayoutName(readString(value.name, fallbackLayoutName));
  const fileName = readString(value.fileName, createWorkspaceLayoutFileName(name));
  const relativePath = readString(value.relativePath, fileName);

  return {
    name,
    fileName,
    relativePath,
    savedAt: normalizeSavedAt(value.savedAt)
  };
}

function sortWorkspaceLayoutFiles(files: WorkspaceLayoutFileReference[]) {
  return [...files].sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
}

export function listKnownWorkspaceLayoutFiles() {
  const storage = getStorage();
  if (!storage) {
    return [] as WorkspaceLayoutFileReference[];
  }

  const rawValue = storage.getItem(knownWorkspaceLayoutFilesStorageKey);
  if (!rawValue) {
    return [] as WorkspaceLayoutFileReference[];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [] as WorkspaceLayoutFileReference[];
    }

    return sortWorkspaceLayoutFiles(
      parsedValue
        .map((entry) => normalizeWorkspaceLayoutFileReference(entry))
        .filter((entry): entry is WorkspaceLayoutFileReference => entry !== null)
    );
  } catch {
    return [] as WorkspaceLayoutFileReference[];
  }
}

export function rememberWorkspaceLayoutFile(reference: WorkspaceLayoutFileReference) {
  const normalizedReference = normalizeWorkspaceLayoutFileReference(reference);
  if (!normalizedReference) {
    return listKnownWorkspaceLayoutFiles();
  }

  const nextFiles = sortWorkspaceLayoutFiles([
    normalizedReference,
    ...listKnownWorkspaceLayoutFiles().filter(
      (entry) => entry.fileName !== normalizedReference.fileName
    )
  ]);
  const storage = getStorage();

  if (storage) {
    storage.setItem(knownWorkspaceLayoutFilesStorageKey, JSON.stringify(nextFiles, null, 2));
  }

  return nextFiles;
}
