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
    .map((row) => {
      const edition = Array.isArray(row.city_editions) ? row.city_editions[0] ?? null : row.city_editions;
      if (!edition) {
        return null;
      }

      const definition = getCityBoardDefinition(edition.city_id);
      if (!definition) {
        return null;
      }

      return {
        id: row.city_edition_id,
        boardId: definition.id,
        displayLabel: edition.label,
        boardFileStem: definition.boardFileStem,
        publishedEditionId: row.city_edition_id,
        catalogSource: "supabase" as const,
        isDefault: edition.is_default
      };
    })
    .filter((option): option is PlayableCityOption => option !== null);

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
