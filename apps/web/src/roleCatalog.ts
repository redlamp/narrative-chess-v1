import narrativeData from "../../../content/templates/narrative-data.json";
import type { PieceKind } from "@narrative-chess/content-schema";

export const pieceKinds: PieceKind[] = [
  "pawn",
  "rook",
  "knight",
  "bishop",
  "queen",
  "king"
];

export type RoleCatalog = Record<PieceKind, string[]>;

const storageKey = "narrative-chess:role-catalog";
const defaultRoleCatalog = pieceKinds.reduce((catalog, pieceKind) => {
  const defaultRoles = narrativeData.roster.rolePools[pieceKind] ?? [pieceKind];
  catalog[pieceKind] = defaultRoles.slice();
  return catalog;
}, {} as RoleCatalog);

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function sanitizeRoleList(values: string[]) {
  const nextValues: string[] = [];

  for (const value of values) {
    const normalizedValue = value.trim();
    if (normalizedValue && !nextValues.includes(normalizedValue)) {
      nextValues.push(normalizedValue);
    }
  }

  return nextValues;
}

function normalizeRoleCatalog(value: unknown): RoleCatalog {
  if (!value || typeof value !== "object") {
    return getDefaultRoleCatalog();
  }

  const candidate = value as Record<string, unknown>;
  const nextCatalog = {} as RoleCatalog;

  for (const pieceKind of pieceKinds) {
    const rawValue = candidate[pieceKind];
    const nextValues = Array.isArray(rawValue)
      ? sanitizeRoleList(rawValue.filter((entry): entry is string => typeof entry === "string"))
      : [];
    nextCatalog[pieceKind] =
      nextValues.length > 0 ? nextValues : defaultRoleCatalog[pieceKind].slice();
  }

  return nextCatalog;
}

export function getDefaultRoleCatalog(): RoleCatalog {
  return pieceKinds.reduce((catalog, pieceKind) => {
    catalog[pieceKind] = defaultRoleCatalog[pieceKind].slice();
    return catalog;
  }, {} as RoleCatalog);
}

export function listRoleCatalog(): RoleCatalog {
  const storage = getStorage();
  if (!storage) {
    return getDefaultRoleCatalog();
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return getDefaultRoleCatalog();
  }

  try {
    return normalizeRoleCatalog(JSON.parse(rawValue));
  } catch {
    return getDefaultRoleCatalog();
  }
}

export function saveRoleCatalog(roleCatalog: RoleCatalog): RoleCatalog {
  const storage = getStorage();
  const nextCatalog = normalizeRoleCatalog(roleCatalog);

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextCatalog));
  }

  return nextCatalog;
}

export function resetRoleCatalog(): RoleCatalog {
  const nextCatalog = getDefaultRoleCatalog();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextCatalog));
  }

  return nextCatalog;
}

export function updateRoleCatalogEntry(input: {
  roleCatalog: RoleCatalog;
  pieceKind: PieceKind;
  value: string;
}): RoleCatalog {
  const nextRoles = sanitizeRoleList(
    input.value
      .split(/\r?\n|,/g)
      .map((entry) => entry.trim())
  );

  return {
    ...input.roleCatalog,
    [input.pieceKind]:
      nextRoles.length > 0 ? nextRoles : defaultRoleCatalog[input.pieceKind].slice()
  };
}

export function formatRoleCatalogEntry(roleCatalog: RoleCatalog, pieceKind: PieceKind) {
  return roleCatalog[pieceKind].join("\n");
}
