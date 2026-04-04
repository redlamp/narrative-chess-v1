import narrativeData from "../../../content/templates/narrative-data.json";
import {
  roleCatalogSchema,
  type PieceKind,
  type RoleDefinition
} from "@narrative-chess/content-schema";

type NarrativeRosterConfig = {
  rolePools: Record<PieceKind, string[]>;
  pieceTraitBiases: Record<PieceKind, string[]>;
  pieceVerbBiases: Record<PieceKind, string[]>;
};

export const pieceKinds: PieceKind[] = [
  "pawn",
  "rook",
  "knight",
  "bishop",
  "queen",
  "king"
];

export type RoleCatalogEntry = RoleDefinition;
export type RoleCatalog = RoleCatalogEntry[];

const rosterConfig = narrativeData.roster as NarrativeRosterConfig;
const storageKey = "narrative-chess:role-catalog";

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function toTitleCase(value: string) {
  return value
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function createRoleId(pieceKind: PieceKind, roleName: string, index: number) {
  const roleSlug = roleName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${pieceKind}-${roleSlug || "role"}-${index + 1}`;
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

function cloneRoleEntry(role: RoleCatalogEntry): RoleCatalogEntry {
  return {
    ...role,
    traits: role.traits.slice(),
    verbs: role.verbs.slice()
  };
}

function sortRoleCatalog(roleCatalog: RoleCatalog) {
  const pieceIndex = new Map(pieceKinds.map((pieceKind, index) => [pieceKind, index] as const));

  return [...roleCatalog].sort((left, right) => {
    return (
      (pieceIndex.get(left.pieceKind) ?? pieceKinds.length) -
      (pieceIndex.get(right.pieceKind) ?? pieceKinds.length)
    );
  });
}

function createRoleEntry(input: {
  pieceKind: PieceKind;
  name: string;
  index: number;
  source?: Partial<RoleCatalogEntry>;
}): RoleCatalogEntry {
  const pieceKindTitle = toTitleCase(input.pieceKind);
  const traits = sanitizeRoleList(
    input.source?.traits ?? rosterConfig.pieceTraitBiases[input.pieceKind]?.slice(0, 3) ?? []
  );
  const verbs = sanitizeRoleList(
    input.source?.verbs ?? rosterConfig.pieceVerbBiases[input.pieceKind]?.slice(0, 3) ?? []
  );

  return {
    id: input.source?.id ?? createRoleId(input.pieceKind, input.name, input.index),
    pieceKind: input.pieceKind,
    name: input.name,
    summary:
      input.source?.summary ??
      `${toTitleCase(input.name)} is a default ${pieceKindTitle.toLowerCase()} role used in the lightweight opening roster.`,
    traits,
    verbs,
    notes: input.source?.notes ?? null,
    generationSource: input.source?.generationSource ?? "editable template defaults",
    generationModel: input.source?.generationModel ?? null,
    contentStatus: input.source?.contentStatus ?? "authored",
    reviewStatus: input.source?.reviewStatus ?? "reviewed",
    reviewNotes: input.source?.reviewNotes ?? null,
    lastReviewedAt: input.source?.lastReviewedAt ?? null
  };
}

function createDefaultRoleCatalog() {
  const nextCatalog: RoleCatalog = [];

  pieceKinds.forEach((pieceKind) => {
    const defaultRoles = rosterConfig.rolePools[pieceKind] ?? [pieceKind];
    defaultRoles.forEach((roleName, index) => {
      nextCatalog.push(
        createRoleEntry({
          pieceKind,
          name: roleName,
          index
        })
      );
    });
  });

  return sortRoleCatalog(nextCatalog);
}

const defaultRoleCatalog = createDefaultRoleCatalog();

function normalizeRoleCatalogEntry(
  candidate: unknown,
  index: number,
  fallbackPieceKind: PieceKind = "pawn"
): RoleCatalogEntry | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const record = candidate as Record<string, unknown>;
  const pieceKind = pieceKinds.includes(record.pieceKind as PieceKind)
    ? (record.pieceKind as PieceKind)
    : fallbackPieceKind;
  const roleName = typeof record.name === "string" ? record.name.trim() : "";
  if (!roleName) {
    return null;
  }

  return createRoleEntry({
    pieceKind,
    name: roleName,
    index,
    source: {
      id: typeof record.id === "string" ? record.id : undefined,
      summary: typeof record.summary === "string" ? record.summary : undefined,
      traits: Array.isArray(record.traits)
        ? sanitizeRoleList(record.traits.filter((entry): entry is string => typeof entry === "string"))
        : undefined,
      verbs: Array.isArray(record.verbs)
        ? sanitizeRoleList(record.verbs.filter((entry): entry is string => typeof entry === "string"))
        : undefined,
      notes: record.notes === null || typeof record.notes === "string" ? record.notes : undefined,
      generationSource:
        typeof record.generationSource === "string" ? record.generationSource : undefined,
      generationModel:
        record.generationModel === null || typeof record.generationModel === "string"
          ? record.generationModel
          : undefined,
      contentStatus:
        record.contentStatus === "empty" ||
        record.contentStatus === "procedural" ||
        record.contentStatus === "authored"
          ? record.contentStatus
          : undefined,
      reviewStatus:
        record.reviewStatus === "empty" ||
        record.reviewStatus === "needs review" ||
        record.reviewStatus === "reviewed" ||
        record.reviewStatus === "approved"
          ? record.reviewStatus
          : undefined,
      reviewNotes:
        record.reviewNotes === null || typeof record.reviewNotes === "string"
          ? record.reviewNotes
          : undefined,
      lastReviewedAt:
        record.lastReviewedAt === null || typeof record.lastReviewedAt === "string"
          ? record.lastReviewedAt
          : undefined
    }
  });
}

function normalizeLegacyRoleCatalog(candidate: Record<string, unknown>) {
  const roles: RoleCatalog = [];

  pieceKinds.forEach((pieceKind) => {
    const rawValue = candidate[pieceKind];
    const roleNames = Array.isArray(rawValue)
      ? sanitizeRoleList(rawValue.filter((entry): entry is string => typeof entry === "string"))
      : [];

    const nextRoleNames = roleNames.length > 0 ? roleNames : rosterConfig.rolePools[pieceKind] ?? [pieceKind];
    nextRoleNames.forEach((roleName, index) => {
      roles.push(
        createRoleEntry({
          pieceKind,
          name: roleName,
          index
        })
      );
    });
  });

  return sortRoleCatalog(roles);
}

function normalizeRoleCatalog(value: unknown): RoleCatalog {
  if (!value || typeof value !== "object") {
    return getDefaultRoleCatalog();
  }

  const candidate = value as Record<string, unknown>;
  if (Array.isArray(candidate.roles)) {
    const normalizedRoles = candidate.roles
      .map((role, index) => normalizeRoleCatalogEntry(role, index))
      .filter((role): role is RoleCatalogEntry => role !== null);

    const parsedCatalog = roleCatalogSchema.safeParse({
      roles: normalizedRoles.length > 0 ? normalizedRoles : defaultRoleCatalog
    });

    return parsedCatalog.success
      ? sortRoleCatalog(parsedCatalog.data.roles.map(cloneRoleEntry))
      : getDefaultRoleCatalog();
  }

  return normalizeLegacyRoleCatalog(candidate);
}

export function hydrateRoleCatalogDraft(candidate: unknown) {
  return normalizeRoleCatalog(candidate);
}

export function getDefaultRoleCatalog() {
  return defaultRoleCatalog.map(cloneRoleEntry);
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
  const nextCatalog = normalizeRoleCatalog({
    roles: roleCatalog
  });

  if (storage) {
    storage.setItem(storageKey, JSON.stringify({ roles: nextCatalog }, null, 2));
  }

  return nextCatalog;
}

export function buildRoleCatalogValidation(roleCatalog: RoleCatalog) {
  const result = roleCatalogSchema.safeParse({
    roles: roleCatalog
  });

  if (result.success) {
    return {
      isValid: true,
      issues: [] as string[]
    };
  }

  return {
    isValid: false,
    issues: result.error.issues.map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "root";
      return `${path}: ${issue.message}`;
    })
  };
}

export function resetRoleCatalog(): RoleCatalog {
  const nextCatalog = getDefaultRoleCatalog();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify({ roles: nextCatalog }, null, 2));
  }

  return nextCatalog;
}

export function groupRoleCatalogByPieceKind(roleCatalog: RoleCatalog) {
  return pieceKinds.reduce(
    (catalog, pieceKind) => {
      catalog[pieceKind] = roleCatalog.filter((role) => role.pieceKind === pieceKind);
      return catalog;
    },
    {} as Record<PieceKind, RoleCatalogEntry[]>
  );
}

export function getRolePoolsOverride(roleCatalog: RoleCatalog) {
  const groupedRoles = groupRoleCatalogByPieceKind(roleCatalog);

  return pieceKinds.reduce(
    (catalog, pieceKind) => {
      const roleNames = sanitizeRoleList(groupedRoles[pieceKind].map((role) => role.name));
      catalog[pieceKind] =
        roleNames.length > 0 ? roleNames : rosterConfig.rolePools[pieceKind] ?? [pieceKind];
      return catalog;
    },
    {} as Record<PieceKind, string[]>
  );
}

export function createRoleCatalogEntry(pieceKind: PieceKind = "pawn", index = 0): RoleCatalogEntry {
  return createRoleEntry({
    pieceKind,
    name: "new role",
    index
  });
}

export function addRoleCatalogEntry(input: {
  roleCatalog: RoleCatalog;
  pieceKind?: PieceKind;
}) {
  const pieceKind = input.pieceKind ?? "pawn";
  const nextEntry = createRoleCatalogEntry(
    pieceKind,
    input.roleCatalog.filter((role) => role.pieceKind === pieceKind).length
  );
  return sortRoleCatalog([...input.roleCatalog, nextEntry]);
}

export function removeRoleCatalogEntry(input: {
  roleCatalog: RoleCatalog;
  roleId: string;
}) {
  const filteredCatalog = input.roleCatalog.filter((role) => role.id !== input.roleId);
  return filteredCatalog.length > 0 ? sortRoleCatalog(filteredCatalog) : getDefaultRoleCatalog();
}

export function updateRoleCatalogEntry(input: {
  roleCatalog: RoleCatalog;
  roleId: string;
  field:
    | "pieceKind"
    | "name"
    | "summary"
    | "traits"
    | "verbs"
    | "notes"
    | "contentStatus"
    | "reviewStatus"
    | "reviewNotes"
    | "lastReviewedAt";
  value:
    | PieceKind
    | string
    | string[]
    | null
    | "empty"
    | "procedural"
    | "authored"
    | "needs review"
    | "reviewed"
    | "approved";
}) {
  return sortRoleCatalog(
    input.roleCatalog.map((role) => {
      if (role.id !== input.roleId) {
        return role;
      }

      return {
        ...role,
        [input.field]:
          input.field === "traits" || input.field === "verbs"
            ? sanitizeRoleList((input.value as string[]).slice())
            : input.field === "name"
              ? String(input.value).trim() || role.name
              : input.value
      };
    })
  );
}

export function duplicateRoleCatalogEntry(input: {
  roleCatalog: RoleCatalog;
  roleId: string;
}) {
  const sourceEntry = input.roleCatalog.find((role) => role.id === input.roleId);
  if (!sourceEntry) {
    return sortRoleCatalog(input.roleCatalog);
  }

  const duplicatedEntry = createRoleEntry({
    pieceKind: sourceEntry.pieceKind,
    name: `${sourceEntry.name} copy`,
    index: input.roleCatalog.filter((role) => role.pieceKind === sourceEntry.pieceKind).length,
    source: {
      ...cloneRoleEntry(sourceEntry),
      id: undefined
    }
  });

  return sortRoleCatalog([...input.roleCatalog, duplicatedEntry]);
}

export function findRoleCatalogEntry(roleCatalog: RoleCatalog, roleId: string) {
  return roleCatalog.find((role) => role.id === roleId) ?? null;
}
