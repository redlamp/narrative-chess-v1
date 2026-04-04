import {
  gameSnapshotSchema,
  type GameSnapshot
} from "@narrative-chess/content-schema";

const storageKey = "narrative-chess:saved-matches";
const maxSavedMatches = 12;

export type SavedMatchRecord = {
  id: string;
  name: string;
  savedAt: string;
  moveCount: number;
  snapshot: GameSnapshot;
};

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function buildDefaultName(savedAt: string, moveCount: number) {
  const timestamp = savedAt.slice(0, 16).replace("T", " ");
  return `Edinburgh match ${timestamp} (${moveCount} moves)`;
}

function parseSavedMatches(value: unknown): SavedMatchRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const records: SavedMatchRecord[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string" ||
      typeof candidate.savedAt !== "string" ||
      typeof candidate.moveCount !== "number"
    ) {
      continue;
    }

    try {
      records.push({
        id: candidate.id,
        name: candidate.name,
        savedAt: candidate.savedAt,
        moveCount: candidate.moveCount,
        snapshot: gameSnapshotSchema.parse(candidate.snapshot)
      });
    } catch {
      continue;
    }
  }

  return records;
}

function readSavedMatches(): SavedMatchRecord[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return [];
  }

  try {
    return parseSavedMatches(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

function writeSavedMatches(records: SavedMatchRecord[]) {
  const storage = getStorage();
  if (!storage) {
    return records;
  }

  storage.setItem(storageKey, JSON.stringify(records));
  return records;
}

export function listSavedMatches(): SavedMatchRecord[] {
  return readSavedMatches();
}

export function saveMatch(snapshot: GameSnapshot, name?: string): SavedMatchRecord[] {
  const savedAt = new Date().toISOString();
  const validatedSnapshot = gameSnapshotSchema.parse(snapshot);
  const nextRecord: SavedMatchRecord = {
    id: `save-${savedAt}-${validatedSnapshot.moveHistory.length}`,
    name: name?.trim() || buildDefaultName(savedAt, validatedSnapshot.moveHistory.length),
    savedAt,
    moveCount: validatedSnapshot.moveHistory.length,
    snapshot: validatedSnapshot
  };
  const nextRecords = [nextRecord, ...readSavedMatches()].slice(0, maxSavedMatches);

  return writeSavedMatches(nextRecords);
}

export function getSavedMatch(id: string): SavedMatchRecord | null {
  return readSavedMatches().find((record) => record.id === id) ?? null;
}

export function deleteSavedMatch(id: string): SavedMatchRecord[] {
  return writeSavedMatches(readSavedMatches().filter((record) => record.id !== id));
}
