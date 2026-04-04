export type AppSettings = {
  theme: "light" | "dark";
  defaultViewMode: "board" | "map";
  showBoardCoordinates: boolean;
  showDistrictLabels: boolean;
  showRecentCharacterActions: boolean;
  showLayoutGrid: boolean;
};

const storageKey = "narrative-chess:app-settings:v1";

const defaultAppSettings: AppSettings = {
  theme: "light",
  defaultViewMode: "board",
  showBoardCoordinates: true,
  showDistrictLabels: true,
  showRecentCharacterActions: true,
  showLayoutGrid: true
};

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function getDefaultAppSettings(): AppSettings {
  return { ...defaultAppSettings };
}

export function normalizeAppTheme(value: unknown): AppSettings["theme"] {
  return value === "dark" ? "dark" : "light";
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!value || typeof value !== "object") {
    return getDefaultAppSettings();
  }

  const candidate = value as Record<string, unknown>;

  return {
    theme: normalizeAppTheme(candidate.theme),
    defaultViewMode: candidate.defaultViewMode === "map" ? "map" : "board",
    showBoardCoordinates:
      typeof candidate.showBoardCoordinates === "boolean"
        ? candidate.showBoardCoordinates
        : defaultAppSettings.showBoardCoordinates,
    showDistrictLabels:
      typeof candidate.showDistrictLabels === "boolean"
        ? candidate.showDistrictLabels
        : defaultAppSettings.showDistrictLabels,
    showRecentCharacterActions:
      typeof candidate.showRecentCharacterActions === "boolean"
        ? candidate.showRecentCharacterActions
        : defaultAppSettings.showRecentCharacterActions,
    showLayoutGrid:
      typeof candidate.showLayoutGrid === "boolean"
        ? candidate.showLayoutGrid
        : defaultAppSettings.showLayoutGrid
  };
}

export function applyAppTheme(theme: AppSettings["theme"]) {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedTheme = normalizeAppTheme(theme);
  document.documentElement.classList.toggle("dark", normalizedTheme === "dark");
  document.documentElement.style.colorScheme = normalizedTheme;
}

export function listAppSettings(): AppSettings {
  const storage = getStorage();
  if (!storage) {
    return getDefaultAppSettings();
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return getDefaultAppSettings();
  }

  try {
    return normalizeAppSettings(JSON.parse(rawValue));
  } catch {
    return getDefaultAppSettings();
  }
}

export function saveAppSettings(settings: AppSettings): AppSettings {
  const nextSettings = normalizeAppSettings(settings);
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextSettings));
  }

  return nextSettings;
}

export function resetAppSettings(): AppSettings {
  const nextSettings = getDefaultAppSettings();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextSettings));
  }

  return nextSettings;
}
