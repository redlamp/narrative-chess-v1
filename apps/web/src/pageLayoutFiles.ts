import {
  normalizePageLayoutState,
  type PageLayoutPanelId,
  type PageLayoutState,
  type PageLayoutVariant
} from "./pageLayoutState";

export type PageLayoutFileRecord = {
  version: 1;
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  name: string;
  savedAt: string;
  layoutState: PageLayoutState;
};

export type PageLayoutFileReference = {
  layoutKey: string;
  name: string;
  fileName: string;
  relativePath: string;
  savedAt: string;
};

const knownPageLayoutFilesStorageKey = "narrative-chess:page-layout-files:v1";
const fallbackLayoutName = "page-layout";

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

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePageLayoutName(value: string) {
  const normalizedValue = value.trim().replace(/\s+/g, " ");
  return normalizedValue || fallbackLayoutName;
}

export function createPageLayoutFileName(input: {
  layoutKey: string;
  name: string;
}) {
  const layoutKeySlug = slugify(input.layoutKey) || "page";
  const nameSlug = slugify(normalizePageLayoutName(input.name)) || fallbackLayoutName;

  return `${layoutKeySlug}--${nameSlug}.page-layout.json`;
}

export function createPageLayoutFileRecord(input: {
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
  name: string;
  layoutState: PageLayoutState;
  savedAt?: string;
}): PageLayoutFileRecord {
  return {
    version: 1,
    layoutKey: input.layoutKey,
    layoutVariant: input.layoutVariant,
    name: normalizePageLayoutName(input.name),
    savedAt: normalizeSavedAt(input.savedAt),
    layoutState: normalizePageLayoutState({
      value: input.layoutState,
      variant: input.layoutVariant,
      panelIds: input.panelIds
    })
  };
}

export function normalizePageLayoutFileRecord(input: {
  value: unknown;
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
}): PageLayoutFileRecord | null {
  if (!isRecord(input.value)) {
    return null;
  }

  const fileLayoutKey = readString(input.value.layoutKey, input.layoutKey);
  if (fileLayoutKey !== input.layoutKey) {
    return null;
  }

  const candidateVariant = readString(input.value.layoutVariant, input.layoutVariant);
  const layoutVariant: PageLayoutVariant =
    candidateVariant === "two-pane" || candidateVariant === "three-pane" || candidateVariant === "research"
      ? candidateVariant
      : input.layoutVariant;

  return {
    version: 1,
    layoutKey: fileLayoutKey,
    layoutVariant,
    name: normalizePageLayoutName(readString(input.value.name, fallbackLayoutName)),
    savedAt: normalizeSavedAt(input.value.savedAt),
    layoutState: normalizePageLayoutState({
      value: input.value.layoutState,
      variant: input.layoutVariant,
      panelIds: input.panelIds
    })
  };
}

function normalizePageLayoutFileReference(value: unknown): PageLayoutFileReference | null {
  if (!isRecord(value)) {
    return null;
  }

  const layoutKey = readString(value.layoutKey, "");
  if (!layoutKey) {
    return null;
  }

  const name = normalizePageLayoutName(readString(value.name, fallbackLayoutName));
  const fileName = readString(
    value.fileName,
    createPageLayoutFileName({
      layoutKey,
      name
    })
  );
  const relativePath = readString(value.relativePath, fileName);

  return {
    layoutKey,
    name,
    fileName,
    relativePath,
    savedAt: normalizeSavedAt(value.savedAt)
  };
}

function sortPageLayoutFiles(files: PageLayoutFileReference[]) {
  return [...files].sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
}

export function listKnownPageLayoutFiles(layoutKey?: string) {
  const storage = getStorage();
  if (!storage) {
    return [] as PageLayoutFileReference[];
  }

  const rawValue = storage.getItem(knownPageLayoutFilesStorageKey);
  if (!rawValue) {
    return [] as PageLayoutFileReference[];
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsedValue)) {
      return [] as PageLayoutFileReference[];
    }

    const files = sortPageLayoutFiles(
      parsedValue
        .map((entry) => normalizePageLayoutFileReference(entry))
        .filter((entry): entry is PageLayoutFileReference => entry !== null)
    );

    return layoutKey ? files.filter((entry) => entry.layoutKey === layoutKey) : files;
  } catch {
    return [] as PageLayoutFileReference[];
  }
}

export function rememberPageLayoutFile(reference: PageLayoutFileReference) {
  const normalizedReference = normalizePageLayoutFileReference(reference);
  if (!normalizedReference) {
    return listKnownPageLayoutFiles(reference.layoutKey);
  }

  const nextFiles = sortPageLayoutFiles([
    normalizedReference,
    ...listKnownPageLayoutFiles().filter((entry) => entry.fileName !== normalizedReference.fileName)
  ]);
  const storage = getStorage();

  if (storage) {
    storage.setItem(knownPageLayoutFilesStorageKey, JSON.stringify(nextFiles, null, 2));
  }

  return nextFiles.filter((entry) => entry.layoutKey === normalizedReference.layoutKey);
}

export function forgetPageLayoutFile(fileName: string, layoutKey?: string) {
  const nextFiles = listKnownPageLayoutFiles().filter((entry) => entry.fileName !== fileName);
  const storage = getStorage();

  if (storage) {
    storage.setItem(knownPageLayoutFilesStorageKey, JSON.stringify(nextFiles, null, 2));
  }

  return layoutKey ? nextFiles.filter((entry) => entry.layoutKey === layoutKey) : nextFiles;
}
