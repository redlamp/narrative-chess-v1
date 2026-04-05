const storageKey = "narrative-chess:piece-styles:v1";

export const defaultPieceStyleSheet = `/* Add optional piece styling overrides here. */
`;

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function normalizePieceStyleSheet(value: unknown) {
  return typeof value === "string" && value.trim() ? value : defaultPieceStyleSheet;
}

export function listPieceStyleSheet() {
  const storage = getStorage();
  if (!storage) {
    return defaultPieceStyleSheet;
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return defaultPieceStyleSheet;
  }

  return normalizePieceStyleSheet(rawValue);
}

export function savePieceStyleSheet(cssText: string) {
  const nextCssText = normalizePieceStyleSheet(cssText);
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, nextCssText);
  }

  return nextCssText;
}

export function resetPieceStyleSheet() {
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, defaultPieceStyleSheet);
  }

  return defaultPieceStyleSheet;
}

export function applyPieceStyleSheet(cssText: string) {
  if (typeof document === "undefined") {
    return;
  }

  let styleElement = document.getElementById("narrative-piece-style-sheet") as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement("style");
    styleElement.id = "narrative-piece-style-sheet";
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = cssText;
}
