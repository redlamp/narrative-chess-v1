import type { PageLayoutState } from "./pageLayoutState";

export type PageLayoutPreset = {
  id: string;
  name: string;
  layoutState: PageLayoutState;
  hidden: boolean;
  createdAt: string;
};

export type PageLayoutPresetStore = {
  version: 1;
  activePresetId: string | null;
  presets: PageLayoutPreset[];
};

const storageKeyPrefix = "narrative-chess:page-layout-presets";

function getStorageKey(layoutKey: string): string {
  return `${storageKeyPrefix}:${layoutKey}:v1`;
}

function generatePresetId(): string {
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyStore(): PageLayoutPresetStore {
  return { version: 1, activePresetId: null, presets: [] };
}

export function listPageLayoutPresets(layoutKey: string): PageLayoutPresetStore {
  try {
    const raw = localStorage.getItem(getStorageKey(layoutKey));
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as PageLayoutPresetStore;
    if (parsed.version !== 1 || !Array.isArray(parsed.presets)) return createEmptyStore();
    return parsed;
  } catch {
    return createEmptyStore();
  }
}

function persist(layoutKey: string, store: PageLayoutPresetStore): PageLayoutPresetStore {
  localStorage.setItem(getStorageKey(layoutKey), JSON.stringify(store));
  return store;
}

export function createPageLayoutPreset(
  layoutKey: string,
  name: string,
  layoutState: PageLayoutState
): PageLayoutPresetStore {
  const store = listPageLayoutPresets(layoutKey);
  const preset: PageLayoutPreset = {
    id: generatePresetId(),
    name: name.trim() || "Untitled",
    layoutState,
    hidden: false,
    createdAt: new Date().toISOString()
  };
  return persist(layoutKey, {
    ...store,
    activePresetId: preset.id,
    presets: [...store.presets, preset]
  });
}

export function saveActivePreset(
  layoutKey: string,
  layoutState: PageLayoutState
): PageLayoutPresetStore {
  const store = listPageLayoutPresets(layoutKey);
  if (!store.activePresetId) return store;
  return persist(layoutKey, {
    ...store,
    presets: store.presets.map((p) =>
      p.id === store.activePresetId ? { ...p, layoutState } : p
    )
  });
}

export function activatePreset(
  layoutKey: string,
  presetId: string
): { store: PageLayoutPresetStore; layoutState: PageLayoutState | null } {
  const store = listPageLayoutPresets(layoutKey);
  const preset = store.presets.find((p) => p.id === presetId);
  if (!preset) return { store, layoutState: null };
  const nextStore = persist(layoutKey, { ...store, activePresetId: presetId });
  return { store: nextStore, layoutState: preset.layoutState };
}

export function deletePreset(
  layoutKey: string,
  presetId: string
): PageLayoutPresetStore {
  const store = listPageLayoutPresets(layoutKey);
  return persist(layoutKey, {
    ...store,
    activePresetId: store.activePresetId === presetId ? null : store.activePresetId,
    presets: store.presets.filter((p) => p.id !== presetId)
  });
}

export function renamePreset(
  layoutKey: string,
  presetId: string,
  name: string
): PageLayoutPresetStore {
  const store = listPageLayoutPresets(layoutKey);
  return persist(layoutKey, {
    ...store,
    presets: store.presets.map((p) =>
      p.id === presetId ? { ...p, name: name.trim() || p.name } : p
    )
  });
}

export function reorderPreset(
  layoutKey: string,
  presetId: string,
  targetId: string
): PageLayoutPresetStore {
  const store = listPageLayoutPresets(layoutKey);
  const fromIndex = store.presets.findIndex((p) => p.id === presetId);
  const toIndex = store.presets.findIndex((p) => p.id === targetId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return store;
  const next = [...store.presets];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return persist(layoutKey, { ...store, presets: next });
}
