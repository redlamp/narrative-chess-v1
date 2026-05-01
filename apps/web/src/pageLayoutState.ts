import {
  clamp,
  getSnappedColumn,
  getSnappedRow,
  getStorage,
  numberOrFallback,
  roundOrFallback
} from "./layoutMath";

const pageLayoutPanelIds = [
  "intro",
  "index",
  "secondary",
  "detail",
  "tertiary",
  "quaternary"
] as const;

export type PageLayoutPanelId = string;

export type PageLayoutVariant = "two-pane" | "three-pane" | "research" | "match";

export type PageLayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PageLayoutState = {
  version: 2;
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  panels: Record<string, PageLayoutRect>;
  visible: Record<string, boolean>;
};

const pageLayoutDefaultColumnCount = 12;
const pageLayoutMinimumColumns = 1;
const pageLayoutMaximumColumns = 24;
const pageLayoutDefaultColumnGap = 16;
const pageLayoutMinimumColumnGap = 0;
const pageLayoutMaximumColumnGap = 64;
const pageLayoutMinimumRowHeight = 8;
const pageLayoutMaximumRowHeight = 256;
const pageLayoutMinimumRows = 18;

const defaultPanelsByVariant: Record<PageLayoutVariant, Record<string, PageLayoutRect>> = {
  "two-pane": {
    intro: { x: 1, y: 1, w: 12, h: 5 },
    index: { x: 1, y: 6, w: 4, h: 15 },
    secondary: { x: 5, y: 6, w: 3, h: 15 },
    detail: { x: 5, y: 6, w: 8, h: 15 },
    tertiary: { x: 5, y: 21, w: 4, h: 7 },
    quaternary: { x: 9, y: 21, w: 4, h: 7 }
  },
  "three-pane": {
    intro: { x: 1, y: 1, w: 12, h: 4 },
    index: { x: 1, y: 5, w: 3, h: 14 },
    secondary: { x: 4, y: 5, w: 3, h: 14 },
    detail: { x: 7, y: 5, w: 6, h: 14 },
    tertiary: { x: 7, y: 19, w: 3, h: 8 },
    quaternary: { x: 10, y: 19, w: 3, h: 8 }
  },
  research: {
    intro: { x: 1, y: 1, w: 12, h: 4 },
    index: { x: 1, y: 5, w: 4, h: 14 },
    secondary: { x: 5, y: 5, w: 3, h: 14 },
    detail: { x: 5, y: 5, w: 8, h: 14 },
    tertiary: { x: 5, y: 19, w: 4, h: 7 },
    quaternary: { x: 9, y: 19, w: 4, h: 7 }
  },
  match: {
    board: { x: 7, y: 1, w: 4, h: 8 },
    moves: { x: 11, y: 1, w: 2, h: 15 },
    "city-map-maplibre": { x: 7, y: 12, w: 4, h: 10 },
    "story-beat": { x: 1, y: 9, w: 6, h: 3 },
    "story-tile": { x: 1, y: 12, w: 3, h: 5 },
    "story-character": { x: 4, y: 12, w: 3, h: 5 },
    "story-tone": { x: 7, y: 9, w: 4, h: 3 },
    "recent-games": { x: 1, y: 1, w: 3, h: 8 }
  }
};

function normalizeColumnCount(value: unknown) {
  return clamp(
    roundOrFallback(value, pageLayoutDefaultColumnCount),
    pageLayoutMinimumColumns,
    pageLayoutMaximumColumns
  );
}

function normalizeColumnGap(value: unknown) {
  return clamp(
    roundOrFallback(value, pageLayoutDefaultColumnGap),
    pageLayoutMinimumColumnGap,
    pageLayoutMaximumColumnGap
  );
}

const defaultPanelRect: PageLayoutRect = { x: 1, y: 1, w: 4, h: 4 };

function getDefaultPanelRect(variant: PageLayoutVariant, panelId: string): PageLayoutRect {
  return defaultPanelsByVariant[variant]?.[panelId] ?? defaultPanelRect;
}

function normalizePanelRect(
  variant: PageLayoutVariant,
  panelId: string,
  value: unknown,
  columnCount: number
): PageLayoutRect {
  const fallback = getDefaultPanelRect(variant, panelId);
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(roundOrFallback(candidate.w, fallback.w), 1, columnCount);
  const x = clamp(roundOrFallback(candidate.x, fallback.x), 1, columnCount - width + 1);
  const height = clamp(roundOrFallback(candidate.h, fallback.h), 1, 256);
  const y = clamp(roundOrFallback(candidate.y, fallback.y), 1, 256);

  return { x, y, w: width, h: height };
}

function scalePanelRect(
  variant: PageLayoutVariant,
  panelId: string,
  panel: PageLayoutRect,
  fromColumnCount: number,
  toColumnCount: number
) {
  if (fromColumnCount === toColumnCount) {
    return normalizePanelRect(variant, panelId, panel, toColumnCount);
  }

  const scaledWidth = clamp(
    Math.round((panel.w / fromColumnCount) * toColumnCount),
    1,
    toColumnCount
  );
  const scaledX = clamp(
    Math.round(((panel.x - 1) / fromColumnCount) * toColumnCount) + 1,
    1,
    toColumnCount - scaledWidth + 1
  );

  return normalizePanelRect(variant, panelId, { ...panel, x: scaledX, w: scaledWidth }, toColumnCount);
}

function getStorageKey(layoutKey: string) {
  return `narrative-chess:page-layout:${layoutKey}:v1`;
}

export function getDefaultPageLayoutState(variant: PageLayoutVariant, panelIds?: string[]): PageLayoutState {
  const ids = panelIds ?? Object.keys(defaultPanelsByVariant[variant] ?? defaultPanelsByVariant["two-pane"]);

  return {
    version: 2,
    columnCount: pageLayoutDefaultColumnCount,
    columnGap: pageLayoutDefaultColumnGap,
    rowHeight: variant === "match" ? 64 : 44,
    panels: ids.reduce((next, panelId) => {
      next[panelId] = { ...getDefaultPanelRect(variant, panelId) };
      return next;
    }, {} as Record<string, PageLayoutRect>),
    visible: ids.reduce((next, panelId) => {
      next[panelId] = true;
      return next;
    }, {} as Record<string, boolean>)
  };
}

export function normalizePageLayoutState(input: {
  value: unknown;
  variant: PageLayoutVariant;
  panelIds: string[];
}): PageLayoutState {
  if (!input.value || typeof input.value !== "object") {
    return getDefaultPageLayoutState(input.variant, input.panelIds);
  }

  const candidate = input.value as Record<string, unknown>;
  const candidatePanels =
    candidate.panels && typeof candidate.panels === "object"
      ? (candidate.panels as Record<string, unknown>)
      : {};
  const candidateVisible =
    candidate.visible && typeof candidate.visible === "object"
      ? (candidate.visible as Record<string, unknown>)
      : {};
  const columnCount = normalizeColumnCount(candidate.columnCount);

  return {
    version: 2,
    columnCount,
    columnGap: normalizeColumnGap(candidate.columnGap),
    rowHeight: clamp(
      numberOrFallback(candidate.rowHeight, input.variant === "match" ? 64 : 44),
      pageLayoutMinimumRowHeight,
      pageLayoutMaximumRowHeight
    ),
    panels: input.panelIds.reduce((next, panelId) => {
      next[panelId] = normalizePanelRect(input.variant, panelId, candidatePanels[panelId], columnCount);
      return next;
    }, {} as Record<string, PageLayoutRect>),
    visible: input.panelIds.reduce((next, panelId) => {
      next[panelId] =
        typeof candidateVisible[panelId] === "boolean"
          ? (candidateVisible[panelId] as boolean)
          : true;
      return next;
    }, {} as Record<string, boolean>)
  };
}

export function listPageLayoutState(input: {
  layoutKey: string;
  variant: PageLayoutVariant;
  panelIds: string[];
}): PageLayoutState {
  const storage = getStorage();
  if (!storage) {
    return getDefaultPageLayoutState(input.variant, input.panelIds);
  }

  const rawValue = storage.getItem(getStorageKey(input.layoutKey));
  if (!rawValue) {
    return getDefaultPageLayoutState(input.variant, input.panelIds);
  }

  try {
    return normalizePageLayoutState({
      value: JSON.parse(rawValue),
      variant: input.variant,
      panelIds: input.panelIds
    });
  } catch {
    return getDefaultPageLayoutState(input.variant, input.panelIds);
  }
}

export function savePageLayoutState(input: {
  layoutKey: string;
  layoutState: PageLayoutState;
  variant: PageLayoutVariant;
  panelIds: string[];
}): PageLayoutState {
  const nextState = normalizePageLayoutState({
    value: input.layoutState,
    variant: input.variant,
    panelIds: input.panelIds
  });
  const storage = getStorage();

  if (storage) {
    storage.setItem(getStorageKey(input.layoutKey), JSON.stringify(nextState));
  }

  return nextState;
}

export function resetPageLayoutState(input: {
  layoutKey: string;
  variant: PageLayoutVariant;
  panelIds?: string[];
}): PageLayoutState {
  const nextState = getDefaultPageLayoutState(input.variant, input.panelIds);
  const storage = getStorage();

  if (storage) {
    storage.setItem(getStorageKey(input.layoutKey), JSON.stringify(nextState));
  }

  return nextState;
}

export function restorePageLayoutPanel(input: {
  layoutState: PageLayoutState;
  panelId: string;
  variant: PageLayoutVariant;
}): PageLayoutState {
  const restoredRect = scalePanelRect(
    input.variant,
    input.panelId,
    getDefaultPanelRect(input.variant, input.panelId),
    pageLayoutDefaultColumnCount,
    input.layoutState.columnCount
  );

  return {
    ...input.layoutState,
    panels: {
      ...input.layoutState.panels,
      [input.panelId]: restoredRect
    },
    visible: {
      ...input.layoutState.visible,
      [input.panelId]: true
    }
  };
}

export function setPageLayoutPanelVisible(input: {
  layoutState: PageLayoutState;
  panelId: string;
  visible: boolean;
}) {
  return {
    ...input.layoutState,
    visible: {
      ...input.layoutState.visible,
      [input.panelId]: input.visible
    }
  };
}

export function canPlacePageLayoutPanel(input: {
  layoutState: PageLayoutState;
  panelIds: string[];
  panelId: string;
  variant: PageLayoutVariant;
  nextRect: PageLayoutRect;
}) {
  const normalizedRect = normalizePanelRect(
    input.variant,
    input.panelId,
    input.nextRect,
    input.layoutState.columnCount
  );
  return normalizedRect.w >= 1 && normalizedRect.h >= 1;
}

export function updatePageLayoutPanelRect(input: {
  layoutState: PageLayoutState;
  panelIds: string[];
  panelId: string;
  variant: PageLayoutVariant;
  nextRect: PageLayoutRect;
}) {
  const normalizedRect = normalizePanelRect(
    input.variant,
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

export function updatePageLayoutColumnCount(input: {
  layoutState: PageLayoutState;
  panelIds: string[];
  variant: PageLayoutVariant;
  value: number;
}) {
  const nextColumnCount = normalizeColumnCount(input.value);

  if (nextColumnCount === input.layoutState.columnCount) {
    return input.layoutState;
  }

  return {
    ...input.layoutState,
    columnCount: nextColumnCount,
    panels: input.panelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = scalePanelRect(
        input.variant,
        panelId,
        input.layoutState.panels[panelId],
        input.layoutState.columnCount,
        nextColumnCount
      );
      return nextPanels;
    }, {} as Record<string, PageLayoutRect>)
  };
}

export function updatePageLayoutColumnGap(input: {
  layoutState: PageLayoutState;
  value: number;
}) {
  return {
    ...input.layoutState,
    columnGap: normalizeColumnGap(input.value)
  };
}

export function updatePageLayoutRowHeight(input: {
  layoutState: PageLayoutState;
  value: number;
}) {
  return {
    ...input.layoutState,
    rowHeight: clamp(Math.round(input.value), pageLayoutMinimumRowHeight, pageLayoutMaximumRowHeight)
  };
}

export const getSnappedPageLayoutColumn = getSnappedColumn;
export const getSnappedPageLayoutRow = getSnappedRow;

export function getPageLayoutRowCount(input: {
  layoutState: PageLayoutState;
  panelIds: string[];
  minimumRows?: number;
}) {
  const minimumRows = Math.max(1, input.minimumRows ?? pageLayoutMinimumRows);
  const maxRow = input.panelIds.reduce((currentMax, panelId) => {
    if (!input.layoutState.visible[panelId]) {
      return currentMax;
    }

    const panel = input.layoutState.panels[panelId];
    if (!panel) return currentMax;
    return Math.max(currentMax, panel.y + panel.h - 1);
  }, minimumRows);

  return Math.max(minimumRows, maxRow);
}

export type PageLayoutTarget = {
  layoutKey: string;
  layoutVariant: PageLayoutVariant;
  panelIds: string[];
  name: string;
};

export const allPageLayoutTargets: PageLayoutTarget[] = [
  {
    layoutKey: "match-workspace",
    layoutVariant: "match",
    panelIds: [
      "board", "moves", "city-map-maplibre",
      "story-beat", "story-tile", "story-character", "story-tone", "recent-games"
    ],
    name: "match"
  },
  {
    layoutKey: "cities-page",
    layoutVariant: "three-pane",
    panelIds: ["intro", "index", "secondary", "detail", "tertiary", "quaternary"],
    name: "cities"
  },
  {
    layoutKey: "classics-page",
    layoutVariant: "two-pane",
    panelIds: ["intro", "index", "detail"],
    name: "classics"
  },
  {
    layoutKey: "roles-page",
    layoutVariant: "three-pane",
    panelIds: ["intro", "index", "secondary", "detail"],
    name: "roles"
  },
  {
    layoutKey: "design-page",
    layoutVariant: "two-pane",
    panelIds: ["intro", "index", "detail"],
    name: "design"
  },
  {
    layoutKey: "research-page",
    layoutVariant: "two-pane",
    panelIds: ["intro", "index", "detail"],
    name: "research"
  }
];
