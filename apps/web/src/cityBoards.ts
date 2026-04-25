import { cityBoardSchema, type CityBoard } from "@narrative-chess/content-schema";
import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import londonBoardData from "../../../content/cities/london-board.json";
import { getSupabaseClient, hasSupabaseConfig } from "./lib/supabase";

export type CityBoardDefinition = {
  id: string;
  board: CityBoard;
  boardFileStem: string;
  displayLabel: string;
  publishedEditionId: string | null;
};

function parseCityBoard(value: unknown) {
  return cityBoardSchema.parse(value);
}

function boardsMatch(left: CityBoard, right: CityBoard) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function isSupabasePublishedCitiesEnabled() {
  return import.meta.env.VITE_ENABLE_SUPABASE_PUBLISHED_CITIES === "true";
}

export type PublishedCityBoardLoadResult = {
  board: CityBoard;
  source: "fallback" | "supabase";
  publishedEditionId: string | null;
  matchesFallback: boolean | null;
};

export type RemoteCityBoardDraftLoadResult = {
  board: CityBoard;
  cityEditionId: string;
  versionId: string;
  versionNumber: number;
};

export type RemoteCityBoardDraftSaveResult = {
  cityEditionId: string;
  versionId: string;
  versionNumber: number;
};

export type PublishedCityBoardSaveResult = {
  cityEditionId: string;
  versionId: string;
  versionNumber: number;
};

export type PlayableCityOption = {
  id: string;
  boardId: string;
  displayLabel: string;
  boardFileStem: string;
  publishedEditionId: string | null;
  catalogSource: "fallback" | "supabase";
  isDefault: boolean;
};

export const cityBoardDefinitions: CityBoardDefinition[] = [
  {
    id: "edinburgh",
    board: parseCityBoard(edinburghBoardData),
    boardFileStem: "edinburgh-board",
    displayLabel: "Edinburgh",
    publishedEditionId: "edinburgh-modern"
  },
  {
    id: "london",
    board: parseCityBoard(londonBoardData),
    boardFileStem: "london-board",
    displayLabel: "London",
    publishedEditionId: null
  }
];

export function getCityBoardDefinition(cityId: string) {
  return cityBoardDefinitions.find((definition) => definition.id === cityId) ?? null;
}

export async function loadLatestDraftCityBoard(
  definition: CityBoardDefinition
): Promise<RemoteCityBoardDraftLoadResult | null> {
  if (!definition.publishedEditionId || !hasSupabaseConfig) {
    return null;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("city_versions")
    .select("id, city_edition_id, version_number, payload")
    .eq("city_edition_id", definition.publishedEditionId)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) {
    return null;
  }

  return {
    board: parseCityBoard(data.payload),
    cityEditionId: data.city_edition_id,
    versionId: data.id,
    versionNumber: data.version_number
  };
}

export async function saveCityBoardDraftToSupabase(
  definition: CityBoardDefinition,
  board: CityBoard
): Promise<RemoteCityBoardDraftSaveResult> {
  if (!definition.publishedEditionId || !hasSupabaseConfig) {
    throw new Error(`Remote drafts are not configured for ${definition.displayLabel}.`);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.rpc("save_city_draft_version", {
    p_city_edition_id: definition.publishedEditionId,
    p_payload: board,
    p_content_status: board.contentStatus,
    p_review_status: board.reviewStatus,
    p_review_notes: board.reviewNotes,
    p_last_reviewed_at: board.lastReviewedAt,
    p_notes: `Draft saved from ${definition.displayLabel} editor`
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    throw error ?? new Error("Could not save the remote city draft.");
  }

  return {
    cityEditionId: row.city_edition_id,
    versionId: row.version_id,
    versionNumber: row.version_number
  };
}

export async function publishCityBoardToSupabase(
  definition: CityBoardDefinition,
  board: CityBoard
): Promise<PublishedCityBoardSaveResult> {
  if (!definition.publishedEditionId || !hasSupabaseConfig) {
    throw new Error(`Remote publishing is not configured for ${definition.displayLabel}.`);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.rpc("publish_city_version", {
    p_city_edition_id: definition.publishedEditionId,
    p_payload: board,
    p_content_status: board.contentStatus,
    p_review_status: board.reviewStatus,
    p_review_notes: board.reviewNotes,
    p_last_reviewed_at: board.lastReviewedAt,
    p_notes: `Published from ${definition.displayLabel} editor`
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    throw error ?? new Error("Could not publish the remote city version.");
  }

  return {
    cityEditionId: row.city_edition_id,
    versionId: row.version_id,
    versionNumber: row.version_number
  };
}

export function listFallbackPlayableCityOptions(): PlayableCityOption[] {
  return cityBoardDefinitions.map((definition, index) => ({
    id: definition.publishedEditionId ?? definition.id,
    boardId: definition.id,
    displayLabel: definition.displayLabel,
    boardFileStem: definition.boardFileStem,
    publishedEditionId: definition.publishedEditionId,
    catalogSource: "fallback",
    isDefault: index === 0
  }));
}

type RawPublishedEditionRow = {
  city_edition_id: string;
  city_editions:
    | {
        id: string;
        city_id: string;
        label: string;
        is_default: boolean;
      }
    | Array<{
        id: string;
        city_id: string;
        label: string;
        is_default: boolean;
      }>;
};

export async function listPlayableCityOptions(): Promise<PlayableCityOption[]> {
  const fallbackOptions = listFallbackPlayableCityOptions();

  if (!isSupabasePublishedCitiesEnabled() || !hasSupabaseConfig) {
    return fallbackOptions;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return fallbackOptions;
  }

  const { data, error } = await supabase
    .from("city_versions")
    .select("city_edition_id, city_editions!inner(id, city_id, label, is_default)")
    .eq("status", "published")
    .order("is_default", { referencedTable: "city_editions", ascending: false })
    .order("label", { referencedTable: "city_editions", ascending: true });

  if (error || !data) {
    return fallbackOptions;
  }

  const mappedOptions = (data as RawPublishedEditionRow[])
    .flatMap((row): PlayableCityOption[] => {
      const edition = Array.isArray(row.city_editions) ? row.city_editions[0] ?? null : row.city_editions;
      if (!edition) {
        return [];
      }

      const definition = getCityBoardDefinition(edition.city_id);
      if (!definition) {
        return [];
      }

      return [{
        id: row.city_edition_id,
        boardId: definition.id,
        displayLabel: edition.label,
        boardFileStem: definition.boardFileStem,
        publishedEditionId: row.city_edition_id,
        catalogSource: "supabase" as const,
        isDefault: edition.is_default
      }];
    });

  if (mappedOptions.length === 0) {
    return fallbackOptions;
  }

  const mappedBoardIds = new Set(mappedOptions.map((option) => option.boardId));
  const missingFallbacks = fallbackOptions.filter((option) => !mappedBoardIds.has(option.boardId));

  return [...mappedOptions, ...missingFallbacks];
}

export async function loadPublishedCityBoard(
  definition: CityBoardDefinition,
  publishedEditionId = definition.publishedEditionId
): Promise<PublishedCityBoardLoadResult> {
  if (!isSupabasePublishedCitiesEnabled() || !publishedEditionId || !hasSupabaseConfig) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId,
      matchesFallback: null
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId,
      matchesFallback: null
    };
  }

  const { data, error } = await supabase
    .from("city_versions")
    .select("payload")
    .eq("city_edition_id", publishedEditionId)
    .eq("status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.payload) {
    return {
      board: definition.board,
      source: "fallback",
      publishedEditionId,
      matchesFallback: null
    };
  }

  const board = parseCityBoard(data.payload);

  return {
    board,
    source: "supabase",
    publishedEditionId,
    matchesFallback: boardsMatch(board, definition.board)
  };
}
