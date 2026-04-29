import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";
import { getCityBoardDefinition } from "./cityBoards";
import {
  buildCityBoardValidation,
  cloneBoard,
  hydrateCityBoardDraft
} from "./cityBoardHydration";

export { hydrateCityBoardDraft, buildCityBoardValidation };

function getStorageKey(cityId: string) {
  return `narrative-chess:city-board-draft:v1:${cityId}`;
}

function getSavedBaselineStorageKey(cityId: string) {
  return `narrative-chess:city-board-saved-baseline:v1:${cityId}`;
}

export function listCityBoardDraft(cityId: string, fallback = getCityBoardDefinition(cityId)?.board) {
  if (!fallback) {
    throw new Error(`Unknown city board: ${cityId}`);
  }

  if (typeof window === "undefined") {
    return cloneBoard(fallback);
  }

  const storedValue = window.localStorage.getItem(getStorageKey(cityId));
  if (!storedValue) {
    return cloneBoard(fallback);
  }

  try {
    return hydrateCityBoardDraft(JSON.parse(storedValue) as unknown, fallback);
  } catch {
    return cloneBoard(fallback);
  }
}

export function listCityBoardSavedBaseline(cityId: string, fallback = getCityBoardDefinition(cityId)?.board) {
  if (!fallback) {
    throw new Error(`Unknown city board: ${cityId}`);
  }

  if (typeof window === "undefined") {
    return cloneBoard(fallback);
  }

  const storedValue = window.localStorage.getItem(getSavedBaselineStorageKey(cityId));
  if (!storedValue) {
    return listCityBoardDraft(cityId, fallback);
  }

  try {
    return hydrateCityBoardDraft(JSON.parse(storedValue) as unknown, fallback);
  } catch {
    return listCityBoardDraft(cityId, fallback);
  }
}

export function saveCityBoardDraft(board: CityBoard) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getStorageKey(board.id), JSON.stringify(board, null, 2));
  }

  return cityBoardSchema.parse(board);
}

export function saveCityBoardSavedBaseline(board: CityBoard) {
  const parsedBoard = cityBoardSchema.parse(board);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(getSavedBaselineStorageKey(parsedBoard.id), JSON.stringify(parsedBoard, null, 2));
  }

  return parsedBoard;
}

export function resetCityBoardDraft(cityId: string, fallback = getCityBoardDefinition(cityId)?.board) {
  if (!fallback) {
    throw new Error(`Unknown city board: ${cityId}`);
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getStorageKey(cityId));
    window.localStorage.removeItem(getSavedBaselineStorageKey(cityId));
  }

  return cloneBoard(fallback);
}

export type CityBoardDraftStatus = "published" | "saved" | "draft";

/**
 * Load priority for city board data:
 *   1. localStorage draft  (key: narrative-chess:city-board-draft:v1:<cityId>)
 *   2. Bundled canonical JSON from content/cities/<city>-board.json (compiled at build time)
 *
 * Status meanings:
 *   "published" — no localStorage key; showing bundled data as deployed.
 *   "saved"     — savedBaseline key exists; was saved to filesystem via File System Access API.
 *   "draft"     — draft key exists, no savedBaseline; browser edits not yet saved to file.
 *
 * When moving to a database backend, this function should check the DB sync state instead.
 */
export function getCityBoardDraftStatus(cityId: string): CityBoardDraftStatus {
  if (typeof window === "undefined") return "published";
  const hasDraft = window.localStorage.getItem(getStorageKey(cityId)) !== null;
  if (!hasDraft) return "published";
  const hasSaved = window.localStorage.getItem(getSavedBaselineStorageKey(cityId)) !== null;
  return hasSaved ? "saved" : "draft";
}
