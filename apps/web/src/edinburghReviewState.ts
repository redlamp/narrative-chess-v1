import {
  cityBoardSchema,
  type CityBoard,
  type ContentStatus,
  type DistrictCell,
  type ReviewStatus
} from "@narrative-chess/content-schema";
import {
  buildCityBoardValidation,
  cloneBoard,
  hydrateCityBoardDraft
} from "./cityBoardHydration";
import { edinburghBoard } from "./edinburghBoard";

type CityBoardMetaUpdate = Pick<
  CityBoard,
  | "summary"
  | "boardOrientation"
  | "sourceUrls"
  | "generationSource"
  | "contentStatus"
  | "reviewStatus"
  | "reviewNotes"
  | "lastReviewedAt"
>;

export function hydrateEdinburghBoardDraft(candidate: unknown, fallback: CityBoard = edinburghBoard) {
  return hydrateCityBoardDraft(candidate, fallback);
}

function getCityBoardDraftStorageKey(cityId: string) {
  return `narrative-chess:city-board-draft:v1:${cityId}`;
}

function createCityBoardDraft(board: CityBoard) {
  return cityBoardSchema.parse(cloneBoard(board));
}

function listCityBoardDraft(cityId: string, fallback: CityBoard) {
  if (typeof window === "undefined") {
    return createCityBoardDraft(fallback);
  }

  const storedValue = window.localStorage.getItem(getCityBoardDraftStorageKey(cityId));
  if (!storedValue) {
    return createCityBoardDraft(fallback);
  }

  try {
    return hydrateCityBoardDraft(JSON.parse(storedValue) as unknown, fallback);
  } catch {
    return createCityBoardDraft(fallback);
  }
}

function saveCityBoardDraft(board: CityBoard) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getCityBoardDraftStorageKey(board.id), JSON.stringify(board, null, 2));
  }

  return cityBoardSchema.parse(board);
}

function resetCityBoardDraft(cityId: string, fallback: CityBoard) {
  const nextBoard = createCityBoardDraft(fallback);

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getCityBoardDraftStorageKey(cityId));
  }

  return nextBoard;
}

export function createEdinburghBoardDraft() {
  return createCityBoardDraft(edinburghBoard);
}

export function listEdinburghBoardDraft() {
  return listCityBoardDraft(edinburghBoard.id, edinburghBoard);
}

export function saveEdinburghBoardDraft(board: CityBoard) {
  return saveCityBoardDraft(board);
}

export function resetEdinburghBoardDraft() {
  return resetCityBoardDraft(edinburghBoard.id, edinburghBoard);
}

export function formatMultilineList(values: string[]) {
  return values.join("\n");
}

export function parseMultilineList(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function updateEdinburghBoardMeta(
  board: CityBoard,
  field: keyof CityBoardMetaUpdate,
  value: string | string[] | ContentStatus | ReviewStatus | null
) {
  return {
    ...board,
    [field]: value
  };
}

export function updateEdinburghDistrictField(
  board: CityBoard,
  districtId: string,
  field: keyof DistrictCell,
  value: string | string[] | ContentStatus | ReviewStatus | null
) {
  return {
    ...board,
    districts: board.districts.map((district) =>
      district.id === districtId
        ? {
            ...district,
            [field]: value
          }
        : district
    )
  };
}

export function buildEdinburghBoardValidation(board: CityBoard) {
  return buildCityBoardValidation(board);
}
