import classicGamesData from "../../../content/games/classic-games.json";
import {
  referenceGameLibrarySchema,
  type ContentStatus,
  type ReferenceGame,
  type ReferenceLink,
  type ReviewStatus
} from "@narrative-chess/content-schema";

const storageKey = "narrative-chess:reference-games";
const legacyStorageKey = "narrative-chess:classic-games";
const defaultReferenceGames = referenceGameLibrarySchema.parse(classicGamesData);

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

function readNullableString(value: unknown, fallback: string | null) {
  return value === null || typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readYear(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number.parseInt(value, 10);
    if (Number.isInteger(parsedValue)) {
      return parsedValue;
    }
  }

  return fallback;
}

function readReferenceLinks(value: unknown, fallback: ReferenceLink[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const nextLinks: ReferenceLink[] = [];

  value.forEach((candidate) => {
    if (!isRecord(candidate)) {
      return;
    }

    const label = readString(candidate.label, "").trim();
    const url = readString(candidate.url, "").trim();
    if (!label || !url) {
      return;
    }

    nextLinks.push({ label, url });
  });

  return nextLinks;
}

function cloneReferenceGame(game: ReferenceGame): ReferenceGame {
  return {
    ...game,
    teachingFocus: game.teachingFocus.slice(),
    detailLinks: game.detailLinks.map((link) => ({ ...link }))
  };
}

function createReferenceGameId(title: string, index: number) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `${slug}-${index + 1}` : `reference-game-${index + 1}`;
}

export type ReferenceGameLibrary = ReferenceGame[];

export function createReferenceGameTemplate(index = 0): ReferenceGame {
  const currentYear = new Date().getFullYear();

  return {
    id: `reference-game-${index + 1}`,
    title: `New classic game ${index + 1}`,
    white: "White",
    black: "Black",
    event: "Curated study draft",
    site: "Unassigned",
    year: currentYear,
    opening: "Unknown opening",
    result: "1-0",
    summary: "Summarize the instructive ideas in this game.",
    historicalSignificance: "Explain why this game matters in chess history.",
    teachingFocus: ["study theme"],
    sourceUrl: null,
    detailLinks: [],
    pgn:
      '[Event "Reference game"]\n[Site "?"]\n[Date "????.??.??"]\n[Round "?"]\n[White "White"]\n[Black "Black"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0',
    generationSource: "editable study draft",
    generationModel: null,
    contentStatus: "authored",
    reviewStatus: "needs review",
    reviewNotes: null,
    lastReviewedAt: null
  };
}

function normalizeReferenceGame(candidate: unknown, index: number): ReferenceGame {
  const fallback = defaultReferenceGames[index] ?? createReferenceGameTemplate(index);

  if (!isRecord(candidate)) {
    return cloneReferenceGame(fallback);
  }

  return {
    id: readString(candidate.id, createReferenceGameId(readString(candidate.title, fallback.title), index)),
    title: readString(candidate.title, fallback.title),
    white: readString(candidate.white, fallback.white),
    black: readString(candidate.black, fallback.black),
    event: readString(candidate.event, fallback.event),
    site: readString(candidate.site, fallback.site),
    year: readYear(candidate.year, fallback.year),
    opening: readString(candidate.opening, fallback.opening),
    result: readString(candidate.result, fallback.result),
    summary: readString(candidate.summary, fallback.summary),
    historicalSignificance: readString(
      candidate.historicalSignificance,
      fallback.historicalSignificance
    ),
    teachingFocus: readStringArray(candidate.teachingFocus, fallback.teachingFocus),
    sourceUrl: readNullableString(candidate.sourceUrl, fallback.sourceUrl),
    detailLinks: readReferenceLinks(candidate.detailLinks, fallback.detailLinks),
    pgn: readString(candidate.pgn, fallback.pgn),
    generationSource: readString(candidate.generationSource, fallback.generationSource),
    generationModel: readNullableString(candidate.generationModel, fallback.generationModel),
    contentStatus:
      candidate.contentStatus === "empty" ||
      candidate.contentStatus === "procedural" ||
      candidate.contentStatus === "authored"
        ? candidate.contentStatus
        : fallback.contentStatus,
    reviewStatus:
      candidate.reviewStatus === "empty" ||
      candidate.reviewStatus === "needs review" ||
      candidate.reviewStatus === "reviewed" ||
      candidate.reviewStatus === "approved"
        ? candidate.reviewStatus
        : fallback.reviewStatus,
    reviewNotes: readNullableString(candidate.reviewNotes, fallback.reviewNotes),
    lastReviewedAt: readNullableString(candidate.lastReviewedAt, fallback.lastReviewedAt)
  };
}

export function normalizeReferenceGameLibrary(value: unknown): ReferenceGame[] {
  if (Array.isArray(value)) {
    const nextGames = value.map((game, index) => normalizeReferenceGame(game, index));
    const parsedGames = referenceGameLibrarySchema.safeParse(nextGames);
    return parsedGames.success ? parsedGames.data.map(cloneReferenceGame) : getDefaultReferenceGames();
  }

  if (isRecord(value) && Array.isArray(value.games)) {
    return normalizeReferenceGameLibrary(value.games);
  }

  return getDefaultReferenceGames();
}

export function getDefaultReferenceGames() {
  return defaultReferenceGames.map(cloneReferenceGame);
}

export function listReferenceGames() {
  const storage = getStorage();
  if (!storage) {
    return getDefaultReferenceGames();
  }

  const rawValue = storage.getItem(storageKey) ?? storage.getItem(legacyStorageKey);
  if (!rawValue) {
    return getDefaultReferenceGames();
  }

  try {
    return normalizeReferenceGameLibrary(JSON.parse(rawValue));
  } catch {
    return getDefaultReferenceGames();
  }
}

export function saveReferenceGames(games: ReferenceGameLibrary) {
  const storage = getStorage();
  const nextGames = normalizeReferenceGameLibrary(games);

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextGames, null, 2));
  }

  return nextGames;
}

export function resetReferenceGames() {
  const nextGames = getDefaultReferenceGames();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextGames, null, 2));
  }

  return nextGames;
}

export function buildReferenceGameLibraryValidation(games: ReferenceGameLibrary) {
  const result = referenceGameLibrarySchema.safeParse(games);

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

export function createReferenceGameFromSource(source: ReferenceGame, index: number): ReferenceGame {
  const duplicatedGame = cloneReferenceGame(source);
  duplicatedGame.id = createReferenceGameId(`${source.title} copy`, index);
  duplicatedGame.title = `${source.title} copy`;
  duplicatedGame.reviewStatus = "needs review";
  duplicatedGame.reviewNotes = null;
  duplicatedGame.lastReviewedAt = null;
  return duplicatedGame;
}

export function findReferenceGame(games: ReferenceGameLibrary, referenceGameId: string) {
  return games.find((game) => game.id === referenceGameId) ?? null;
}

export function addReferenceGame(games: ReferenceGameLibrary) {
  return [...games.map(cloneReferenceGame), createReferenceGameTemplate(games.length)];
}

export function duplicateReferenceGame(input: {
  games: ReferenceGameLibrary;
  referenceGameId: string;
}) {
  const source = findReferenceGame(input.games, input.referenceGameId);
  if (!source) {
    return input.games.map(cloneReferenceGame);
  }

  return [
    ...input.games.map(cloneReferenceGame),
    createReferenceGameFromSource(source, input.games.length)
  ];
}

export function removeReferenceGame(input: {
  games: ReferenceGameLibrary;
  referenceGameId: string;
}) {
  const nextGames = input.games.filter((game) => game.id !== input.referenceGameId).map(cloneReferenceGame);
  return nextGames.length > 0 ? nextGames : getDefaultReferenceGames();
}

export function updateReferenceGame(input: {
  games: ReferenceGameLibrary;
  referenceGameId: string;
  field:
    | "title"
    | "white"
    | "black"
    | "event"
    | "site"
    | "year"
    | "opening"
    | "result"
    | "summary"
    | "historicalSignificance"
    | "teachingFocus"
    | "sourceUrl"
    | "detailLinks"
    | "pgn"
    | "contentStatus"
    | "reviewStatus"
    | "reviewNotes"
    | "lastReviewedAt";
  value:
    | string
    | number
    | string[]
    | ReferenceLink[]
    | null
    | ContentStatus
    | ReviewStatus;
}) {
  const nextGames = input.games.map((game, index) => {
    if (game.id !== input.referenceGameId) {
      return cloneReferenceGame(game);
    }

    const nextGame: ReferenceGame = cloneReferenceGame(game);
    if (input.field === "teachingFocus" && Array.isArray(input.value)) {
      nextGame.teachingFocus = (input.value as string[])
        .map((entry) => entry.trim())
        .filter(Boolean);
      return normalizeReferenceGame(nextGame, index);
    }

    if (input.field === "detailLinks" && Array.isArray(input.value)) {
      nextGame.detailLinks = (input.value as ReferenceLink[])
        .map((link) => ({
          label: link.label.trim(),
          url: link.url.trim()
        }))
        .filter((link) => link.label && link.url);
      return normalizeReferenceGame(nextGame, index);
    }

    if (input.field === "year" && typeof input.value === "number") {
      nextGame.year = input.value;
      return normalizeReferenceGame(nextGame, index);
    }

    if (input.field === "sourceUrl") {
      nextGame.sourceUrl = typeof input.value === "string" && input.value.trim() ? input.value : null;
      return normalizeReferenceGame(nextGame, index);
    }

    if (input.field === "reviewNotes") {
      nextGame.reviewNotes =
        typeof input.value === "string" && input.value.trim() ? input.value : null;
      return normalizeReferenceGame(nextGame, index);
    }

    if (input.field === "lastReviewedAt") {
      nextGame.lastReviewedAt =
        typeof input.value === "string" && input.value.trim() ? input.value : null;
      return normalizeReferenceGame(nextGame, index);
    }

    if (
      input.field === "contentStatus" ||
      input.field === "reviewStatus" ||
      input.field === "title" ||
      input.field === "white" ||
      input.field === "black" ||
      input.field === "event" ||
      input.field === "site" ||
      input.field === "opening" ||
      input.field === "result" ||
      input.field === "summary" ||
      input.field === "historicalSignificance" ||
      input.field === "pgn"
    ) {
      nextGame[input.field] = input.value as never;
    }

    return normalizeReferenceGame(nextGame, index);
  });

  return nextGames;
}

export const referenceGames = getDefaultReferenceGames();
