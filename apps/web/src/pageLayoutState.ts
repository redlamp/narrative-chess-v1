export const pageLayoutPanelIds = ["intro", "index", "secondary", "detail"] as const;

export type PageLayoutPanelId = (typeof pageLayoutPanelIds)[number];

export type PageLayoutVariant = "two-pane" | "three-pane" | "research";

export type PageLayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PageLayoutState = {
  version: 1;
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  panels: Record<PageLayoutPanelId, PageLayoutRect>;
};

type PanelPlacementRect = {
  x: number;
  y: number;
  w: number;
  h: number;
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
  intro: 4,
  index: 2,
  secondary: 2,
  detail: 4
};

const minimumPanelHeight: Record<PageLayoutPanelId, number> = {
  intro: 1,
  index: 1,
  secondary: 1,
  detail: 1
};

const defaultPanelsByVariant: Record<PageLayoutVariant, Record<PageLayoutPanelId, PageLayoutRect>> = {
  "two-pane": {
    intro: { x: 1, y: 1, w: 12, h: 5 },
    index: { x: 1, y: 6, w: 4, h: 15 },
    secondary: { x: 5, y: 6, w: 3, h: 15 },
    detail: { x: 5, y: 6, w: 8, h: 15 }
  },
  "three-pane": {
    intro: { x: 1, y: 1, w: 12, h: 5 },
    index: { x: 1, y: 6, w: 3, h: 15 },
    secondary: { x: 4, y: 6, w: 3, h: 15 },
    detail: { x: 7, y: 6, w: 6, h: 15 }
  },
  research: {
    intro: { x: 1, y: 1, w: 12, h: 4 },
    index: { x: 1, y: 5, w: 4, h: 14 },
    secondary: { x: 5, y: 5, w: 3, h: 14 },
    detail: { x: 5, y: 5, w: 8, h: 14 }
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
  const height = clamp(roundOrFallback(candidate.h, fallback.h), minimumPanelHeight[panelId], 40);
  const y = clamp(roundOrFallback(candidate.y, fallback.y), 1, 72);

  return {
    x,
    y,
    w: width,
    h: height
  };
}

function getPanelPlacementRect(panel: PageLayoutRect): PanelPlacementRect {
  return {
    x: panel.x,
    y: panel.y,
    w: panel.w,
    h: panel.h
  };
}

function rectanglesOverlap(left: PanelPlacementRect, right: PanelPlacementRect) {
  const leftX2 = left.x + left.w - 1;
  const rightX2 = right.x + right.w - 1;
  const leftY2 = left.y + left.h - 1;
  const rightY2 = right.y + right.h - 1;

  return !(leftX2 < right.x || rightX2 < left.x || leftY2 < right.y || rightY2 < left.y);
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

function reflowPageLayoutPanels(input: {
  variant: PageLayoutVariant;
  panelIds: PageLayoutPanelId[];
  panels: Record<PageLayoutPanelId, PageLayoutRect>;
  fromColumnCount: number;
  toColumnCount: number;
}) {
  const nextPanels = { ...input.panels };
  const orderedPanelIds = [...input.panelIds].sort((leftId, rightId) => {
    const left = input.panels[leftId];
    const right = input.panels[rightId];

    if (left.y !== right.y) {
      return left.y - right.y;
    }

    return left.x - right.x;
  });

  for (const panelId of orderedPanelIds) {
    const baseRect = scalePanelRect(
      input.variant,
      panelId,
      input.panels[panelId],
      input.fromColumnCount,
      input.toColumnCount
    );
    let candidateRect = baseRect;

    while (
      input.panelIds.some((otherPanelId) => {
        if (otherPanelId === panelId) {
          return false;
        }

        const otherRect = nextPanels[otherPanelId];
        return rectanglesOverlap(
          getPanelPlacementRect(candidateRect),
          getPanelPlacementRect(otherRect)
        );
      })
    ) {
      candidateRect = {
        ...candidateRect,
        y: candidateRect.y + 1
      };
    }

    nextPanels[panelId] = candidateRect;
  }

  return nextPanels;
}

function getStorageKey(layoutKey: string) {
  return `narrative-chess:page-layout:${layoutKey}:v1`;
}

export function getDefaultPageLayoutState(variant: PageLayoutVariant): PageLayoutState {
  return {
    version: 1,
    columnCount: pageLayoutDefaultColumnCount,
    columnGap: pageLayoutDefaultColumnGap,
    rowHeight: 44,
    panels: pageLayoutPanelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = { ...defaultPanelsByVariant[variant][panelId] };
      return nextPanels;
    }, {} as Record<PageLayoutPanelId, PageLayoutRect>)
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
    version: 1,
    columnCount,
    columnGap: normalizeColumnGap(candidate.columnGap),
    rowHeight: clamp(
      numberOrFallback(candidate.rowHeight, 44),
      pageLayoutMinimumRowHeight,
      pageLayoutMaximumRowHeight
    ),
    panels: reflowPageLayoutPanels({
      variant: input.variant,
      panelIds: input.panelIds,
      panels: normalizedPanels,
      fromColumnCount: columnCount,
      toColumnCount: columnCount
    })
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
  const nextPlacementRect = getPanelPlacementRect(normalizedRect);

  for (const otherPanelId of input.panelIds) {
    if (otherPanelId === input.panelId) {
      continue;
    }

    if (
      rectanglesOverlap(nextPlacementRect, getPanelPlacementRect(input.layoutState.panels[otherPanelId]))
    ) {
      return false;
    }
  }

  return true;
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

  if (
    !canPlacePageLayoutPanel({
      layoutState: input.layoutState,
      panelIds: input.panelIds,
      panelId: input.panelId,
      variant: input.variant,
      nextRect: normalizedRect
    })
  ) {
    return input.layoutState;
  }

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
    panels: reflowPageLayoutPanels({
      variant: input.variant,
      panelIds: input.panelIds,
      panels: input.layoutState.panels,
      fromColumnCount: input.layoutState.columnCount,
      toColumnCount: nextColumnCount
    })
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
}) {
  const safeWidth = Math.max(input.width, 1);
  const clampedOffset = clamp(input.offsetX, 0, safeWidth);
  const ratio = clampedOffset / safeWidth;

  return clamp(Math.floor(ratio * input.columnCount) + 1, 1, input.columnCount);
}

export function getSnappedPageLayoutRow(input: {
  offsetY: number;
  rowHeight: number;
}) {
  const safeRowHeight = Math.max(input.rowHeight, 1);
  return Math.max(1, Math.floor(Math.max(input.offsetY, 0) / safeRowHeight) + 1);
}

export function getPageLayoutRowCount(input: {
  layoutState: PageLayoutState;
  panelIds: PageLayoutPanelId[];
}) {
  const maxRow = input.panelIds.reduce((currentMax, panelId) => {
    const panel = input.layoutState.panels[panelId];
    return Math.max(currentMax, panel.y + panel.h - 1);
  }, pageLayoutMinimumRows);

  return Math.max(pageLayoutMinimumRows, maxRow);
}
