export type HighlightColor = "red" | "yellow" | "orange" | "green" | "blue" | "purple" | "grey" | "custom";

export type HighlightColorOption = {
  id: HighlightColor;
  label: string;
  hex: string;
};

export const highlightColorOptions: HighlightColorOption[] = [
  { id: "red",    label: "Red",    hex: "#dc2626" },
  { id: "yellow", label: "Yellow", hex: "#ca8a04" },
  { id: "orange", label: "Orange", hex: "#ea580c" },
  { id: "green",  label: "Green",  hex: "#16a34a" },
  { id: "blue",   label: "Blue",   hex: "#2563eb" },
  { id: "purple", label: "Purple", hex: "#7c3aed" },
  { id: "grey",   label: "Grey",   hex: "#6b7280" },
];

export type AppSettings = {
  theme: "light" | "dark";
  defaultViewMode: "board" | "map";
  showBoardCoordinates: boolean;
  showDistrictLabels: boolean;
  showRecentCharacterActions: boolean;
  showLayoutGrid: boolean;
  highlightColor: HighlightColor;
  customHighlightColor: string;
};

const storageKey = "narrative-chess:app-settings:v1";

const defaultAppSettings: AppSettings = {
  theme: "light",
  defaultViewMode: "board",
  showBoardCoordinates: true,
  showDistrictLabels: true,
  showRecentCharacterActions: true,
  showLayoutGrid: true,
  highlightColor: "blue",
  customHighlightColor: "#2563eb"
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

function normalizeAppTheme(value: unknown): AppSettings["theme"] {
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
        : defaultAppSettings.showLayoutGrid,
    highlightColor: normalizeHighlightColor(candidate.highlightColor),
    customHighlightColor: normalizeCustomHighlightColor(candidate.customHighlightColor)
  };
}

function normalizeHighlightColor(value: unknown): HighlightColor {
  const valid: HighlightColor[] = ["red", "yellow", "orange", "green", "blue", "purple", "grey", "custom"];
  return valid.includes(value as HighlightColor) ? (value as HighlightColor) : "blue";
}

function normalizeCustomHighlightColor(value: unknown) {
  if (typeof value !== "string") {
    return defaultAppSettings.customHighlightColor;
  }

  const normalized = value.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : defaultAppSettings.customHighlightColor;
}

export function applyAppTheme(theme: AppSettings["theme"]) {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedTheme = normalizeAppTheme(theme);
  document.documentElement.classList.toggle("dark", normalizedTheme === "dark");
  document.documentElement.style.colorScheme = normalizedTheme;
}

export function applyHighlightColor(color: HighlightColor, customColor?: string) {
  if (typeof document === "undefined") {
    return;
  }

  const option = highlightColorOptions.find((o) => o.id === color);
  const hex = color === "custom" ? normalizeCustomHighlightColor(customColor) : option?.hex ?? "#2563eb";
  document.documentElement.style.setProperty("--selection", hex);
  document.documentElement.style.setProperty("--ring", hex);
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

function resetAppSettings(): AppSettings {
  const nextSettings = getDefaultAppSettings();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextSettings));
  }

  return nextSettings;
}
