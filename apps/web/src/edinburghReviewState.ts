import {
  cityBoardSchema,
  type CityBoard,
  type ContentStatus,
  type DistrictCell,
  type MapAnchor,
  type ReviewStatus
} from "@narrative-chess/content-schema";
import { getCityBoardDefinition } from "./cityBoards";
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

function cloneBoard(board: CityBoard) {
  return JSON.parse(JSON.stringify(board)) as CityBoard;
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

  return value.filter((item): item is string => typeof item === "string");
}

function readMapAnchor(value: unknown, fallback: MapAnchor | undefined) {
  if (!isRecord(value)) {
    return fallback;
  }

  const longitude = typeof value.longitude === "number" ? value.longitude : fallback?.longitude;
  const latitude = typeof value.latitude === "number" ? value.latitude : fallback?.latitude;

  if (longitude === undefined || latitude === undefined) {
    return fallback;
  }

  return { longitude, latitude };
}

function hydrateDistrictCell(candidate: unknown, fallback: DistrictCell): DistrictCell {
  if (!isRecord(candidate)) {
    return { ...fallback };
  }

  return {
    id: readString(candidate.id, fallback.id),
    square: readString(candidate.square, fallback.square) as DistrictCell["square"],
    name: readString(candidate.name, fallback.name),
    locality: readString(candidate.locality, fallback.locality),
    descriptors: readStringArray(candidate.descriptors, fallback.descriptors),
    landmarks: readStringArray(candidate.landmarks, fallback.landmarks),
    dayProfile: readString(candidate.dayProfile, fallback.dayProfile),
    nightProfile: readString(candidate.nightProfile, fallback.nightProfile),
    toneCues: readStringArray(candidate.toneCues, fallback.toneCues),
    mapAnchor: readMapAnchor(candidate.mapAnchor, fallback.mapAnchor),
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

export function hydrateCityBoardDraft(candidate: unknown, fallback: CityBoard) {
  if (!isRecord(candidate)) {
    return cloneBoard(fallback);
  }

  const candidateDistricts = Array.isArray(candidate.districts) ? candidate.districts : [];
  const candidateDistrictById = new Map(
    candidateDistricts
      .filter(isRecord)
      .map((district) => [readString(district.id, ""), district] as const)
  );
  const candidateDistrictBySquare = new Map(
    candidateDistricts
      .filter(isRecord)
      .map((district) => [readString(district.square, ""), district] as const)
  );

  return {
    id: readString(candidate.id, fallback.id),
    name: readString(candidate.name, fallback.name),
    country: readString(candidate.country, fallback.country),
    summary: readString(candidate.summary, fallback.summary),
    boardOrientation: readString(candidate.boardOrientation, fallback.boardOrientation),
    sourceUrls: readStringArray(candidate.sourceUrls, fallback.sourceUrls),
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
    lastReviewedAt: readNullableString(candidate.lastReviewedAt, fallback.lastReviewedAt),
    districts: fallback.districts.map((district) => {
      const byId = candidateDistrictById.get(district.id);
      const bySquare = candidateDistrictBySquare.get(district.square);
      return hydrateDistrictCell(byId ?? bySquare ?? null, district);
    })
  };
}

export function hydrateEdinburghBoardDraft(candidate: unknown, fallback: CityBoard = edinburghBoard) {
  return hydrateCityBoardDraft(candidate, fallback);
}

function getCityBoardDraftStorageKey(cityId: string) {
  return `narrative-chess:city-board-draft:v1:${cityId}`;
}

export function createCityBoardDraft(board: CityBoard) {
  return cityBoardSchema.parse(cloneBoard(board));
}

export function listCityBoardDraft(cityId: string, fallback: CityBoard) {
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

export function saveCityBoardDraft(board: CityBoard) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(getCityBoardDraftStorageKey(board.id), JSON.stringify(board, null, 2));
  }

  return cityBoardSchema.parse(board);
}

export function resetCityBoardDraft(cityId: string, fallback: CityBoard) {
  const nextBoard = createCityBoardDraft(fallback);

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getCityBoardDraftStorageKey(cityId));
  }

  return nextBoard;
}

export function buildCityBoardValidation(board: CityBoard) {
  const result = cityBoardSchema.safeParse(board);

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

export function getFallbackCityBoard(cityId: string) {
  return getCityBoardDefinition(cityId)?.board ?? null;
}
