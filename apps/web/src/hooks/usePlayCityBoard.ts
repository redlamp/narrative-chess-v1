import { useEffect, useMemo, useState } from "react";
import type { CityBoard } from "@narrative-chess/content-schema";
import { edinburghBoard } from "../edinburghBoard";
import {
  getCityBoardDefinition,
  isSupabasePublishedCitiesEnabled,
  listFallbackPlayableCityOptions,
  listPlayableCityOptions,
  loadLatestDraftCityBoard,
  loadPublishedCityBoard,
  type PlayableCityOption
} from "../cityBoards";
import { getCityBoardDraftStatus, listCityBoardDraft } from "../cityReviewState";
import type {
  PlayCityContext,
  PlayCityPreviewMode,
  PlayCitySource
} from "../playCityContext";

type PlayCityBoardLoadResult = {
  board: CityBoard;
  source: PlayCitySource;
  publishedEditionId: string | null;
  matchesFallback: boolean | null;
};

function getLocalPlayCitySource(cityId: string): PlayCitySource {
  return getCityBoardDraftStatus(cityId) === "published" ? "fallback" : "local-draft";
}

export type PlayCityBoardController = {
  useSupabasePublishedCities: boolean;
  playCityOptions: PlayableCityOption[];
  setPlayCityOptions: (options: PlayableCityOption[]) => void;
  playCityOptionId: string;
  setPlayCityOptionId: (id: string) => void;
  playCityBoard: CityBoard;
  setPlayCityBoard: (board: CityBoard) => void;
  playCitySource: PlayCitySource;
  setPlayCitySource: (source: PlayCitySource) => void;
  playCityPreviewMode: PlayCityPreviewMode;
  setPlayCityPreviewMode: (mode: PlayCityPreviewMode) => void;
  playCityPublishedEditionId: string | null;
  setPlayCityPublishedEditionId: (id: string | null) => void;
  playCityMatchesFallback: boolean | null;
  setPlayCityMatchesFallback: (value: boolean | null) => void;
  selectedPlayCityOption: PlayableCityOption | null;
  multiplayerCityOptions: Array<{ id: string; label: string }>;
  canPreviewDraftPlayCity: boolean;
  effectivePlayCityPreviewMode: PlayCityPreviewMode;
  actualPlayCityPreviewMode: PlayCityPreviewMode;
  playCitySourceLabel: string;
  playCityContext: PlayCityContext;
  getLocalPlayCitySource: (cityId: string) => PlayCitySource;
};

export function usePlayCityBoard(canAccessDraftCities: boolean): PlayCityBoardController {
  const useSupabasePublishedCities = isSupabasePublishedCitiesEnabled();
  const [playCityOptions, setPlayCityOptions] = useState<PlayableCityOption[]>(() =>
    listFallbackPlayableCityOptions()
  );
  const [playCityOptionId, setPlayCityOptionId] = useState<string>(() =>
    listFallbackPlayableCityOptions()[0]?.id ?? edinburghBoard.id
  );
  const [playCityBoard, setPlayCityBoard] = useState<CityBoard>(() =>
    useSupabasePublishedCities ? edinburghBoard : listCityBoardDraft(edinburghBoard.id, edinburghBoard)
  );
  const [playCitySource, setPlayCitySource] = useState<PlayCitySource>(
    useSupabasePublishedCities ? "fallback" : getLocalPlayCitySource(edinburghBoard.id)
  );
  const [playCityPreviewMode, setPlayCityPreviewMode] = useState<PlayCityPreviewMode>("published");
  const [playCityPublishedEditionId, setPlayCityPublishedEditionId] = useState<string | null>(
    listFallbackPlayableCityOptions()[0]?.publishedEditionId ?? null
  );
  const [playCityMatchesFallback, setPlayCityMatchesFallback] = useState<boolean | null>(null);

  const selectedPlayCityOption = useMemo(
    () => playCityOptions.find((option) => option.id === playCityOptionId) ?? playCityOptions[0] ?? null,
    [playCityOptionId, playCityOptions]
  );

  const multiplayerCityOptions = useMemo(() => {
    const seen = new Set<string>();

    return playCityOptions
      .filter((option) => option.publishedEditionId)
      .map((option) => ({
        id: option.publishedEditionId ?? option.id,
        label: option.displayLabel
      }))
      .filter((option) => {
        if (seen.has(option.id)) {
          return false;
        }

        seen.add(option.id);
        return true;
      });
  }, [playCityOptions]);

  const canPreviewDraftPlayCity =
    canAccessDraftCities &&
    useSupabasePublishedCities &&
    Boolean(selectedPlayCityOption?.publishedEditionId);
  const effectivePlayCityPreviewMode: PlayCityPreviewMode =
    canPreviewDraftPlayCity && playCityPreviewMode === "draft" ? "draft" : "published";
  const playCitySourceLabel =
    playCitySource === "supabase-draft"
      ? "Supabase draft"
      : playCitySource === "supabase-published"
        ? "Supabase published"
        : playCitySource === "local-draft"
          ? "Local draft"
          : "Bundled fallback";
  const actualPlayCityPreviewMode: PlayCityPreviewMode =
    playCitySource === "supabase-draft" || playCitySource === "local-draft" ? "draft" : "published";

  const playCityContext = useMemo<PlayCityContext>(() => ({
    boardId: selectedPlayCityOption?.boardId ?? playCityBoard.id,
    displayLabel: selectedPlayCityOption?.displayLabel ?? playCityBoard.name,
    source: playCitySource,
    publishedEditionId: playCityPublishedEditionId,
    previewMode: actualPlayCityPreviewMode,
    board: playCityBoard
  }), [
    actualPlayCityPreviewMode,
    playCityBoard,
    playCityPublishedEditionId,
    playCitySource,
    selectedPlayCityOption
  ]);

  useEffect(() => {
    let cancelled = false;

    void listPlayableCityOptions()
      .then((options) => {
        if (!cancelled) {
          setPlayCityOptions(options);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("[supabase] Could not load playable city options.", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (canPreviewDraftPlayCity) {
      return;
    }

    setPlayCityPreviewMode("published");
  }, [canPreviewDraftPlayCity]);

  useEffect(() => {
    if (!selectedPlayCityOption) {
      return;
    }

    if (playCityOptions.some((option) => option.id === playCityOptionId)) {
      return;
    }

    setPlayCityOptionId(selectedPlayCityOption.id);
  }, [playCityOptionId, playCityOptions, selectedPlayCityOption]);

  useEffect(() => {
    if (!selectedPlayCityOption) {
      return;
    }

    const definition = getCityBoardDefinition(selectedPlayCityOption.boardId);
    if (!definition) {
      return;
    }

    let cancelled = false;

    if (!useSupabasePublishedCities) {
      const nextBoard = listCityBoardDraft(definition.id, definition.board);
      setPlayCityBoard(nextBoard);
      setPlayCitySource(getLocalPlayCitySource(definition.id));
      setPlayCityPublishedEditionId(selectedPlayCityOption.publishedEditionId);
      setPlayCityMatchesFallback(null);
      return;
    }

    const loadRemoteBoard = async (): Promise<PlayCityBoardLoadResult> => {
      if (effectivePlayCityPreviewMode === "draft") {
        const draftResult = await loadLatestDraftCityBoard(definition);
        if (draftResult) {
          return {
            board: draftResult.board,
            source: "supabase-draft",
            publishedEditionId: draftResult.cityEditionId,
            matchesFallback: null
          };
        }
      }

      const result = await loadPublishedCityBoard(definition, selectedPlayCityOption.publishedEditionId);
      return {
        ...result,
        source: result.source === "supabase" ? "supabase-published" : "fallback"
      };
    };

    void loadRemoteBoard()
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.source === "supabase-published" && result.matchesFallback === false) {
          console.warn(
            `[supabase] Published city board for ${selectedPlayCityOption.id} differs from bundled fallback ${definition.boardFileStem}.`
          );
        }

        setPlayCityBoard(result.board);
        setPlayCitySource(result.source);
        setPlayCityPublishedEditionId(result.publishedEditionId);
        setPlayCityMatchesFallback(result.matchesFallback);
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn(`[supabase] Could not load published city board for ${selectedPlayCityOption.id}.`, error);
          setPlayCityBoard(definition.board);
          setPlayCitySource("fallback");
          setPlayCityPublishedEditionId(selectedPlayCityOption.publishedEditionId);
          setPlayCityMatchesFallback(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [effectivePlayCityPreviewMode, selectedPlayCityOption, useSupabasePublishedCities]);

  return {
    useSupabasePublishedCities,
    playCityOptions,
    setPlayCityOptions,
    playCityOptionId,
    setPlayCityOptionId,
    playCityBoard,
    setPlayCityBoard,
    playCitySource,
    setPlayCitySource,
    playCityPreviewMode,
    setPlayCityPreviewMode,
    playCityPublishedEditionId,
    setPlayCityPublishedEditionId,
    playCityMatchesFallback,
    setPlayCityMatchesFallback,
    selectedPlayCityOption,
    multiplayerCityOptions,
    canPreviewDraftPlayCity,
    effectivePlayCityPreviewMode,
    actualPlayCityPreviewMode,
    playCitySourceLabel,
    playCityContext,
    getLocalPlayCitySource
  };
}
