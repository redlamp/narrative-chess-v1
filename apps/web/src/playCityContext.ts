import type { CityBoard } from "@narrative-chess/content-schema";

export type PlayCitySource =
  | "fallback"
  | "local-draft"
  | "supabase-published"
  | "supabase-draft";

export type PlayCityPreviewMode = "published" | "draft";

export type PlayCityContext = {
  boardId: string;
  displayLabel: string;
  source: PlayCitySource;
  publishedEditionId: string | null;
  previewMode: PlayCityPreviewMode;
  board: CityBoard;
};

export type SavedMatchCityMetadata = {
  boardId: string;
  displayLabel: string;
  source: PlayCitySource;
  publishedEditionId: string | null;
  previewMode: PlayCityPreviewMode;
};

const playCitySources = new Set<PlayCitySource>([
  "fallback",
  "local-draft",
  "supabase-published",
  "supabase-draft"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getSavedMatchCityMetadata(context: PlayCityContext): SavedMatchCityMetadata {
  return {
    boardId: context.boardId,
    displayLabel: context.displayLabel,
    source: context.source,
    publishedEditionId: context.publishedEditionId,
    previewMode: context.previewMode
  };
}

export function parseSavedMatchCityMetadata(value: unknown): SavedMatchCityMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const source = value.source;
  const previewMode = value.previewMode;
  const publishedEditionId = typeof value.publishedEditionId === "string" ? value.publishedEditionId : null;
  if (
    typeof value.boardId !== "string" ||
    typeof value.displayLabel !== "string" ||
    (value.publishedEditionId !== undefined &&
      value.publishedEditionId !== null &&
      typeof value.publishedEditionId !== "string") ||
    (source !== undefined && (typeof source !== "string" || !playCitySources.has(source as PlayCitySource))) ||
    (previewMode !== undefined && previewMode !== "published" && previewMode !== "draft")
  ) {
    return null;
  }

  return {
    boardId: value.boardId,
    displayLabel: value.displayLabel,
    source: (source as PlayCitySource | undefined) ?? "fallback",
    publishedEditionId,
    previewMode: (previewMode as PlayCityPreviewMode | undefined) ?? "published"
  };
}
