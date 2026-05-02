import classicGamesData from "../../../content/games/classic-games.json";
import {
  referenceGameLibrarySchema,
  type ReferenceGame
} from "@narrative-chess/content-schema";
import { getStorage } from "./layoutMath";
import {
  isRecord,
  readNullableString,
  readReferenceLinks,
  readString,
  readTrimmedStringArray,
  readYear
} from "./parsers";

const storageKey = "narrative-chess:reference-games";
const legacyStorageKey = "narrative-chess:classic-games";
const defaultReferenceGames = referenceGameLibrarySchema.parse(classicGamesData);

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
    teachingFocus: readTrimmedStringArray(candidate.teachingFocus, fallback.teachingFocus),
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

