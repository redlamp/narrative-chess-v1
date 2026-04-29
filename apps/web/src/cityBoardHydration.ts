import {
  cityBoardSchema,
  type CityBoard,
  type DistrictCell
} from "@narrative-chess/content-schema";
import {
  isRecord,
  readMapAnchor,
  readNullableString,
  readRadiusMeters,
  readString,
  readStringArray
} from "./parsers";

export function cloneBoard(board: CityBoard) {
  return JSON.parse(JSON.stringify(board)) as CityBoard;
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
    radiusMeters: readRadiusMeters(candidate.radiusMeters, fallback.radiusMeters),
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
