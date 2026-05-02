import { clamp, roundOrFallback } from "./layoutMath";

const storyPanelSectionIds = [
  "beat",
  "tile",
  "character",
  "tone"
] as const;

export type StoryPanelSectionId = (typeof storyPanelSectionIds)[number];

export type StoryPanelSectionRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type StoryPanelLayoutState = {
  version: 1;
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  panels: Record<StoryPanelSectionId, StoryPanelSectionRect>;
};

const defaultColumnCount = 8;
const minimumColumns = 4;
const maximumColumns = 16;
const defaultColumnGap = 12;
const minimumColumnGap = 0;
const maximumColumnGap = 32;
const defaultRowHeight = 44;
const minimumRowHeight = 16;
const maximumRowHeight = 120;

const minimumPanelWidth: Record<StoryPanelSectionId, number> = {
  beat: 2,
  tile: 2,
  character: 2,
  tone: 2
};

const minimumPanelHeight: Record<StoryPanelSectionId, number> = {
  beat: 2,
  tile: 2,
  character: 2,
  tone: 2
};

const defaultStoryPanelLayoutState: StoryPanelLayoutState = {
  version: 1,
  columnCount: defaultColumnCount,
  columnGap: defaultColumnGap,
  rowHeight: defaultRowHeight,
  panels: {
    beat: { x: 1, y: 1, w: 8, h: 4 },
    tile: { x: 1, y: 5, w: 4, h: 4 },
    character: { x: 5, y: 5, w: 4, h: 7 },
    tone: { x: 1, y: 9, w: 4, h: 3 }
  }
};

function normalizeColumnCount(value: unknown) {
  return clamp(roundOrFallback(value, defaultColumnCount), minimumColumns, maximumColumns);
}

function normalizeColumnGap(value: unknown) {
  return clamp(roundOrFallback(value, defaultColumnGap), minimumColumnGap, maximumColumnGap);
}

function normalizeRowHeight(value: unknown) {
  return clamp(roundOrFallback(value, defaultRowHeight), minimumRowHeight, maximumRowHeight);
}

function normalizePanelRect(
  panelId: StoryPanelSectionId,
  value: unknown,
  columnCount: number
): StoryPanelSectionRect {
  const fallback = defaultStoryPanelLayoutState.panels[panelId];
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(
    roundOrFallback(candidate.w, fallback.w),
    minimumPanelWidth[panelId],
    columnCount
  );
  const x = clamp(roundOrFallback(candidate.x, fallback.x), 1, columnCount - width + 1);
  const height = clamp(roundOrFallback(candidate.h, fallback.h), minimumPanelHeight[panelId], 64);
  const y = clamp(roundOrFallback(candidate.y, fallback.y), 1, 64);

  return {
    x,
    y,
    w: width,
    h: height
  };
}

export function getDefaultStoryPanelLayoutState(): StoryPanelLayoutState {
  return {
    version: 1,
    columnCount: defaultStoryPanelLayoutState.columnCount,
    columnGap: defaultStoryPanelLayoutState.columnGap,
    rowHeight: defaultStoryPanelLayoutState.rowHeight,
    panels: storyPanelSectionIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = { ...defaultStoryPanelLayoutState.panels[panelId] };
      return nextPanels;
    }, {} as Record<StoryPanelSectionId, StoryPanelSectionRect>)
  };
}

export function normalizeStoryPanelLayoutState(value: unknown): StoryPanelLayoutState {
  if (!value || typeof value !== "object") {
    return getDefaultStoryPanelLayoutState();
  }

  const candidate = value as Record<string, unknown>;
  const candidatePanels =
    candidate.panels && typeof candidate.panels === "object"
      ? (candidate.panels as Record<string, unknown>)
      : {};
  const columnCount = normalizeColumnCount(candidate.columnCount);

  return {
    version: 1,
    columnCount,
    columnGap: normalizeColumnGap(candidate.columnGap),
    rowHeight: normalizeRowHeight(candidate.rowHeight),
    panels: storyPanelSectionIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = normalizePanelRect(panelId, candidatePanels[panelId], columnCount);
      return nextPanels;
    }, {} as Record<StoryPanelSectionId, StoryPanelSectionRect>)
  };
}

export function updateStoryPanelRect(input: {
  layoutState: StoryPanelLayoutState;
  panelId: StoryPanelSectionId;
  nextRect: StoryPanelSectionRect;
}) {
  const normalizedRect = normalizePanelRect(
    input.panelId,
    input.nextRect,
    input.layoutState.columnCount
  );

  return {
    ...input.layoutState,
    panels: {
      ...input.layoutState.panels,
      [input.panelId]: normalizedRect
    }
  };
}


