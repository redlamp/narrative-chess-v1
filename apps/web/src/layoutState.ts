export const workspacePanelIds = [
  "board",
  "moves",
  "narrative",
  "saved",
  "study"
] as const;

export const collapsibleWorkspacePanelIds = [
  "moves",
  "narrative",
  "saved",
  "study"
] as const;

export type WorkspacePanelId = (typeof workspacePanelIds)[number];
export type CollapsibleWorkspacePanelId = (typeof collapsibleWorkspacePanelIds)[number];

export type WorkspacePanelRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WorkspaceLayoutState = {
  version: 2;
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  panels: Record<WorkspacePanelId, WorkspacePanelRect>;
  collapsed: Record<CollapsibleWorkspacePanelId, boolean>;
};

const storageKey = "narrative-chess:workspace-layout:v1";
const workspaceDefaultColumnCount = 12;
const workspaceMinimumColumns = 1;
const workspaceMaximumColumns = 24;
const workspaceDefaultColumnGap = 16;
const workspaceMinimumColumnGap = 0;
const workspaceMaximumColumnGap = 64;
const workspaceMinimumRowHeight = 8;
const workspaceMaximumRowHeight = 256;
const workspaceMinimumRows = 18;
const collapsedPanelHeight = 2;

const minimumPanelWidth: Record<WorkspacePanelId, number> = {
  board: 4,
  moves: 2,
  narrative: 2,
  saved: 2,
  study: 2
};

const minimumPanelHeight: Record<WorkspacePanelId, number> = {
  board: 2,
  moves: 1,
  narrative: 1,
  saved: 1,
  study: 1
};

const defaultLayoutState: WorkspaceLayoutState = {
  version: 2,
  columnCount: workspaceDefaultColumnCount,
  columnGap: workspaceDefaultColumnGap,
  rowHeight: 44,
  panels: {
    board: { x: 1, y: 1, w: 6, h: 16 },
    moves: { x: 7, y: 1, w: 3, h: 10 },
    narrative: { x: 10, y: 1, w: 3, h: 10 },
    saved: { x: 7, y: 11, w: 3, h: 6 },
    study: { x: 10, y: 11, w: 3, h: 6 }
  },
  collapsed: {
    moves: false,
    narrative: false,
    saved: false,
    study: false
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
    roundOrFallback(value, workspaceDefaultColumnCount),
    workspaceMinimumColumns,
    workspaceMaximumColumns
  );
}

function normalizeColumnGap(value: unknown) {
  return clamp(
    roundOrFallback(value, workspaceDefaultColumnGap),
    workspaceMinimumColumnGap,
    workspaceMaximumColumnGap
  );
}

function normalizePanelRect(
  panelId: WorkspacePanelId,
  value: unknown,
  columnCount: number
): WorkspacePanelRect {
  const fallback = defaultLayoutState.panels[panelId];
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
  panelId: WorkspacePanelId,
  panel: WorkspacePanelRect,
  fromColumnCount: number,
  toColumnCount: number
) {
  if (fromColumnCount === toColumnCount) {
    return normalizePanelRect(panelId, panel, toColumnCount);
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
    panelId,
    {
      ...panel,
      x: scaledX,
      w: scaledWidth
    },
    toColumnCount
  );
}

export function getDefaultWorkspaceLayoutState(): WorkspaceLayoutState {
  return {
    version: 2,
    columnCount: defaultLayoutState.columnCount,
    columnGap: defaultLayoutState.columnGap,
    rowHeight: defaultLayoutState.rowHeight,
    panels: workspacePanelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = { ...defaultLayoutState.panels[panelId] };
      return nextPanels;
    }, {} as Record<WorkspacePanelId, WorkspacePanelRect>),
    collapsed: collapsibleWorkspacePanelIds.reduce((nextCollapsed, panelId) => {
      nextCollapsed[panelId] = defaultLayoutState.collapsed[panelId];
      return nextCollapsed;
    }, {} as Record<CollapsibleWorkspacePanelId, boolean>)
  };
}

export function normalizeWorkspaceLayoutState(value: unknown): WorkspaceLayoutState {
  if (!value || typeof value !== "object") {
    return getDefaultWorkspaceLayoutState();
  }

  const candidate = value as Record<string, unknown>;
  const candidatePanels =
    candidate.panels && typeof candidate.panels === "object"
      ? (candidate.panels as Record<string, unknown>)
      : {};
  const candidateCollapsed =
    candidate.collapsed && typeof candidate.collapsed === "object"
      ? (candidate.collapsed as Record<string, unknown>)
      : {};
  const columnCount = normalizeColumnCount(candidate.columnCount);
  const normalizedPanels = workspacePanelIds.reduce((nextPanels, panelId) => {
    nextPanels[panelId] = normalizePanelRect(panelId, candidatePanels[panelId], columnCount);
    return nextPanels;
  }, {} as Record<WorkspacePanelId, WorkspacePanelRect>);

  return {
    version: 2,
    columnCount,
    columnGap: normalizeColumnGap(candidate.columnGap),
    rowHeight: clamp(
      numberOrFallback(candidate.rowHeight, defaultLayoutState.rowHeight),
      workspaceMinimumRowHeight,
      workspaceMaximumRowHeight
    ),
    panels: normalizedPanels,
    collapsed: collapsibleWorkspacePanelIds.reduce((nextCollapsed, panelId) => {
      nextCollapsed[panelId] =
        typeof candidateCollapsed[panelId] === "boolean"
          ? (candidateCollapsed[panelId] as boolean)
          : defaultLayoutState.collapsed[panelId];
      return nextCollapsed;
    }, {} as Record<CollapsibleWorkspacePanelId, boolean>)
  };
}

export function listWorkspaceLayoutState(): WorkspaceLayoutState {
  const storage = getStorage();
  if (!storage) {
    return getDefaultWorkspaceLayoutState();
  }

  const rawValue = storage.getItem(storageKey);
  if (!rawValue) {
    return getDefaultWorkspaceLayoutState();
  }

  try {
    return normalizeWorkspaceLayoutState(JSON.parse(rawValue));
  } catch {
    return getDefaultWorkspaceLayoutState();
  }
}

export function saveWorkspaceLayoutState(layoutState: WorkspaceLayoutState): WorkspaceLayoutState {
  const nextState = normalizeWorkspaceLayoutState(layoutState);
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextState));
  }

  return nextState;
}

export function resetWorkspaceLayoutState(): WorkspaceLayoutState {
  const nextState = getDefaultWorkspaceLayoutState();
  const storage = getStorage();

  if (storage) {
    storage.setItem(storageKey, JSON.stringify(nextState));
  }

  return nextState;
}

export function restoreWorkspacePanel(input: {
  layoutState: WorkspaceLayoutState;
  panelId: WorkspacePanelId;
}): WorkspaceLayoutState {
  const restoredRect = scalePanelRect(
    input.panelId,
    defaultLayoutState.panels[input.panelId],
    defaultLayoutState.columnCount,
    input.layoutState.columnCount
  );

  const nextState: WorkspaceLayoutState = {
    ...input.layoutState,
    panels: {
      ...input.layoutState.panels,
      [input.panelId]: restoredRect
    }
  };

  if (input.panelId !== "board") {
    nextState.collapsed = {
      ...nextState.collapsed,
      [input.panelId]: false
    };
  }

  return nextState;
}

export function getWorkspacePanelRenderHeight(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId
) {
  if (panelId === "board") {
    return layoutState.panels[panelId].h;
  }

  return layoutState.collapsed[panelId] ? collapsedPanelHeight : layoutState.panels[panelId].h;
}

export function canPlaceWorkspacePanel(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId,
  nextRect: WorkspacePanelRect
) {
  const normalizedRect = normalizePanelRect(panelId, nextRect, layoutState.columnCount);
  return normalizedRect.w >= minimumPanelWidth[panelId] && normalizedRect.h >= minimumPanelHeight[panelId];
}

export function updateWorkspacePanelRect(input: {
  layoutState: WorkspaceLayoutState;
  panelId: WorkspacePanelId;
  nextRect: WorkspacePanelRect;
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

export function setWorkspacePanelCollapsed(input: {
  layoutState: WorkspaceLayoutState;
  panelId: CollapsibleWorkspacePanelId;
  collapsed: boolean;
}) {
  return {
    ...input.layoutState,
    collapsed: {
      ...input.layoutState.collapsed,
      [input.panelId]: input.collapsed
    }
  };
}

export function expandAllWorkspacePanels(layoutState: WorkspaceLayoutState) {
  return {
    ...layoutState,
    collapsed: collapsibleWorkspacePanelIds.reduce((nextCollapsed, panelId) => {
      nextCollapsed[panelId] = false;
      return nextCollapsed;
    }, {} as Record<CollapsibleWorkspacePanelId, boolean>)
  };
}

export function updateWorkspaceColumnCount(input: {
  layoutState: WorkspaceLayoutState;
  value: number;
}) {
  const nextColumnCount = normalizeColumnCount(input.value);

  if (nextColumnCount === input.layoutState.columnCount) {
    return input.layoutState;
  }

  return {
    ...input.layoutState,
    columnCount: nextColumnCount,
    panels: workspacePanelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = scalePanelRect(
        panelId,
        input.layoutState.panels[panelId],
        input.layoutState.columnCount,
        nextColumnCount
      );
      return nextPanels;
    }, {} as Record<WorkspacePanelId, WorkspacePanelRect>)
  };
}

export function updateWorkspaceColumnGap(input: {
  layoutState: WorkspaceLayoutState;
  value: number;
}) {
  return {
    ...input.layoutState,
    columnGap: normalizeColumnGap(input.value)
  };
}

export function updateWorkspaceRowHeight(input: {
  layoutState: WorkspaceLayoutState;
  value: number;
}) {
  return {
    ...input.layoutState,
    rowHeight: clamp(Math.round(input.value), workspaceMinimumRowHeight, workspaceMaximumRowHeight)
  };
}

export function getSnappedWorkspaceColumn(input: {
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

export function getSnappedWorkspaceRow(input: {
  offsetY: number;
  rowHeight: number;
  rowGap: number;
}) {
  const safeRowHeight = Math.max(input.rowHeight, 1);
  const stride = safeRowHeight + Math.max(0, input.rowGap);
  return Math.max(1, Math.floor(Math.max(input.offsetY, 0) / Math.max(stride, 1)) + 1);
}

export function getWorkspaceLayoutRowCount(layoutState: WorkspaceLayoutState) {
  const maxRow = workspacePanelIds.reduce((currentMax, panelId) => {
    const panel = layoutState.panels[panelId];
    return Math.max(currentMax, panel.y + panel.h - 1);
  }, workspaceMinimumRows);

  return Math.max(workspaceMinimumRows, maxRow);
}
