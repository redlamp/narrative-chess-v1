export const pageLayoutPanelIds = [
  "intro",
  "index",
  "secondary",
  "detail",
  "tertiary",
  "quaternary"
] as const;

export type PageLayoutPanelId = (typeof pageLayoutPanelIds)[number];

export type PageLayoutVariant = "two-pane" | "three-pane" | "research";

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
  panels: Record<PageLayoutPanelId, PageLayoutRect>;
  visible: Record<PageLayoutPanelId, boolean>;
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

const minimumPanelWidth: Record<PageLayoutPanelId, number> = {
  intro: 1,
  index: 1,
  secondary: 1,
  detail: 1,
  tertiary: 1,
  quaternary: 1
};

const minimumPanelHeight: Record<PageLayoutPanelId, number> = {
  intro: 1,
  index: 1,
  secondary: 1,
  detail: 1,
  tertiary: 1,
  quaternary: 1
};

const defaultPanelsByVariant: Record<PageLayoutVariant, Record<PageLayoutPanelId, PageLayoutRect>> = {
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
  }
};

function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

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

function normalizePanelRect(
  variant: PageLayoutVariant,
  panelId: PageLayoutPanelId,
  value: unknown,
  columnCount: number
): PageLayoutRect {
  const fallback = defaultPanelsByVariant[variant][panelId];
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(
    roundOrFallback(candidate.w, fallback.w),
    minimumPanelWidth[panelId],
    columnCount
  );
  const x = clamp(roundOrFallback(candidate.x, fallback.x), 1, columnCount - width + 1);
  const height = clamp(roundOrFallback(candidate.h, fallback.h), minimumPanelHeight[panelId], 256);
  const y = clamp(roundOrFallback(candidate.y, fallback.y), 1, 256);

  return {
    x,
    y,
    w: width,
    h: height
  };
}

function scalePanelRect(
  variant: PageLayoutVariant,
  panelId: PageLayoutPanelId,
  panel: PageLayoutRect,
  fromColumnCount: number,
  toColumnCount: number
) {
  if (fromColumnCount === toColumnCount) {
    return normalizePanelRect(variant, panelId, panel, toColumnCount);
  }

  const scaledWidth = clamp(
    Math.round((panel.w / fromColumnCount) * toColumnCount),
    minimumPanelWidth[panelId],
    toColumnCount
  );
  const scaledX = clamp(
    Math.round(((panel.x - 1) / fromColumnCount) * toColumnCount) + 1,
    1,
    toColumnCount - scaledWidth + 1
  );

  return normalizePanelRect(
    variant,
    panelId,
    {
      ...panel,
      x: scaledX,
      w: scaledWidth
    },
    toColumnCount
  );
}

function getStorageKey(layoutKey: string) {
  return `narrative-chess:page-layout:${layoutKey}:v1`;
}

export function getDefaultPageLayoutState(variant: PageLayoutVariant): PageLayoutState {
  return {
    version: 2,
    columnCount: pageLayoutDefaultColumnCount,
    columnGap: pageLayoutDefaultColumnGap,
    rowHeight: 44,
    panels: pageLayoutPanelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = { ...defaultPanelsByVariant[variant][panelId] };
      return nextPanels;
    }, {} as Record<PageLayoutPanelId, PageLayoutRect>),
    visible: pageLayoutPanelIds.reduce((nextVisible, panelId) => {
      nextVisible[panelId] = true;
      return nextVisible;
    }, {} as Record<PageLayoutPanelId, boolean>)
  };
}

export function normalizePageLayoutState(input: {
  value: unknown;
  variant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
}): PageLayoutState {
  if (!input.value || typeof input.value !== "object") {
    return getDefaultPageLayoutState(input.variant);
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
  const normalizedPanels = pageLayoutPanelIds.reduce((nextPanels, panelId) => {
    nextPanels[panelId] = normalizePanelRect(
      input.variant,
      panelId,
      candidatePanels[panelId],
      columnCount
    );
    return nextPanels;
  }, {} as Record<PageLayoutPanelId, PageLayoutRect>);

  return {
    version: 2,
    columnCount,
    columnGap: normalizeColumnGap(candidate.columnGap),
    rowHeight: clamp(
      numberOrFallback(candidate.rowHeight, 44),
      pageLayoutMinimumRowHeight,
      pageLayoutMaximumRowHeight
    ),
    panels: normalizedPanels,
    visible: pageLayoutPanelIds.reduce((nextVisible, panelId) => {
      nextVisible[panelId] =
        typeof candidateVisible[panelId] === "boolean"
          ? (candidateVisible[panelId] as boolean)
          : true;
      return nextVisible;
    }, {} as Record<PageLayoutPanelId, boolean>)
  };
}

export function listPageLayoutState(input: {
  layoutKey: string;
  variant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
}): PageLayoutState {
  const storage = getStorage();
  if (!storage) {
    return getDefaultPageLayoutState(input.variant);
  }

  const rawValue = storage.getItem(getStorageKey(input.layoutKey));
  if (!rawValue) {
    return getDefaultPageLayoutState(input.variant);
  }

  try {
    return normalizePageLayoutState({
      value: JSON.parse(rawValue),
      variant: input.variant,
      panelIds: input.panelIds
    });
  } catch {
    return getDefaultPageLayoutState(input.variant);
  }
}

export function savePageLayoutState(input: {
  layoutKey: string;
  layoutState: PageLayoutState;
  variant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
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
}): PageLayoutState {
  const nextState = getDefaultPageLayoutState(input.variant);
  const storage = getStorage();

  if (storage) {
    storage.setItem(getStorageKey(input.layoutKey), JSON.stringify(nextState));
  }

  return nextState;
}

export function restorePageLayoutPanel(input: {
  layoutState: PageLayoutState;
  panelId: PageLayoutPanelId;
  variant: PageLayoutVariant;
}): PageLayoutState {
  const restoredRect = scalePanelRect(
    input.variant,
    input.panelId,
    defaultPanelsByVariant[input.variant][input.panelId],
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
  panelId: PageLayoutPanelId;
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
  panelIds: PageLayoutPanelId[];
  panelId: PageLayoutPanelId;
  variant: PageLayoutVariant;
  nextRect: PageLayoutRect;
}) {
  const normalizedRect = normalizePanelRect(
    input.variant,
    input.panelId,
    input.nextRect,
    input.layoutState.columnCount
  );
  return normalizedRect.w >= minimumPanelWidth[input.panelId] && normalizedRect.h >= minimumPanelHeight[input.panelId];
}

export function updatePageLayoutPanelRect(input: {
  layoutState: PageLayoutState;
  panelIds: PageLayoutPanelId[];
  panelId: PageLayoutPanelId;
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
  panelIds: PageLayoutPanelId[];
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
    }, {} as Record<PageLayoutPanelId, PageLayoutRect>)
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

export function getSnappedPageLayoutColumn(input: {
  offsetX: number;
  width: number;
  columnCount: number;
  columnGap: number;
}) {
  const safeWidth = Math.max(input.width, 1);
  const totalGapWidth = Math.max(0, input.columnCount - 1) * Math.max(0, input.columnGap);
  const availableColumnWidth = Math.max(1, safeWidth - totalGapWidth);
  const columnWidth = availableColumnWidth / Math.max(1, input.columnCount);
  const stride = columnWidth + Math.max(0, input.columnGap);
  const clampedOffset = clamp(input.offsetX, 0, safeWidth);

  return clamp(Math.floor(clampedOffset / Math.max(stride, 1)) + 1, 1, input.columnCount);
}

export function getSnappedPageLayoutRow(input: {
  offsetY: number;
  rowHeight: number;
  rowGap: number;
}) {
  const safeRowHeight = Math.max(input.rowHeight, 1);
  const stride = safeRowHeight + Math.max(0, input.rowGap);
  return Math.max(1, Math.floor(Math.max(input.offsetY, 0) / Math.max(stride, 1)) + 1);
}

export function getPageLayoutRowCount(input: {
  layoutState: PageLayoutState;
  panelIds: PageLayoutPanelId[];
}) {
  const maxRow = input.panelIds.reduce((currentMax, panelId) => {
    if (!input.layoutState.visible[panelId]) {
      return currentMax;
    }

    const panel = input.layoutState.panels[panelId];
    return Math.max(currentMax, panel.y + panel.h - 1);
  }, pageLayoutMinimumRows);

  return Math.max(pageLayoutMinimumRows, maxRow);
}
