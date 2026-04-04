export const workspacePanelIds = [
  "board",
  "moves",
  "narrative",
  "saved",
  "study",
  "status"
] as const;

export const collapsibleWorkspacePanelIds = [
  "moves",
  "narrative",
  "saved",
  "study",
  "status"
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
  version: 1;
  columnFractions: [number, number, number];
  rowHeight: number;
  panels: Record<WorkspacePanelId, WorkspacePanelRect>;
  collapsed: Record<CollapsibleWorkspacePanelId, boolean>;
};

type PanelPlacementRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const storageKey = "narrative-chess:workspace-layout:v1";
const workspaceGroupUnits = [6, 3, 3] as const;
const workspaceColumnCount = 12;
const workspaceMinimumRows = 18;
const collapsedPanelHeight = 2;

const minimumPanelWidth: Record<WorkspacePanelId, number> = {
  board: 4,
  moves: 2,
  narrative: 2,
  saved: 2,
  study: 2,
  status: 2
};

const minimumPanelHeight: Record<WorkspacePanelId, number> = {
  board: 12,
  moves: 5,
  narrative: 5,
  saved: 4,
  study: 5,
  status: 4
};

const defaultLayoutState: WorkspaceLayoutState = {
  version: 1,
  columnFractions: [1.5, 1, 1],
  rowHeight: 44,
  panels: {
    board: { x: 1, y: 1, w: 6, h: 16 },
    moves: { x: 7, y: 1, w: 3, h: 8 },
    narrative: { x: 10, y: 1, w: 3, h: 8 },
    saved: { x: 7, y: 9, w: 3, h: 6 },
    study: { x: 10, y: 9, w: 3, h: 6 },
    status: { x: 7, y: 15, w: 6, h: 4 }
  },
  collapsed: {
    moves: false,
    narrative: false,
    saved: false,
    study: false,
    status: false
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

function normalizeColumnFractions(value: unknown): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    return [...defaultLayoutState.columnFractions];
  }

  const normalized = value.map((entry, index) =>
    clamp(numberOrFallback(entry, defaultLayoutState.columnFractions[index] ?? 1), 0.5, 4)
  ) as [number, number, number];

  return normalized;
}

function normalizePanelRect(panelId: WorkspacePanelId, value: unknown): WorkspacePanelRect {
  const fallback = defaultLayoutState.panels[panelId];
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const width = clamp(
    roundOrFallback(candidate.w, fallback.w),
    minimumPanelWidth[panelId],
    workspaceColumnCount
  );
  const x = clamp(
    roundOrFallback(candidate.x, fallback.x),
    1,
    workspaceColumnCount - width + 1
  );
  const height = clamp(roundOrFallback(candidate.h, fallback.h), minimumPanelHeight[panelId], 32);
  const y = clamp(roundOrFallback(candidate.y, fallback.y), 1, 64);

  return {
    x,
    y,
    w: width,
    h: height
  };
}

export function getDefaultWorkspaceLayoutState(): WorkspaceLayoutState {
  return {
    version: 1,
    columnFractions: [...defaultLayoutState.columnFractions],
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

  return {
    version: 1,
    columnFractions: normalizeColumnFractions(candidate.columnFractions),
    rowHeight: clamp(numberOrFallback(candidate.rowHeight, defaultLayoutState.rowHeight), 30, 80),
    panels: workspacePanelIds.reduce((nextPanels, panelId) => {
      nextPanels[panelId] = normalizePanelRect(panelId, candidatePanels[panelId]);
      return nextPanels;
    }, {} as Record<WorkspacePanelId, WorkspacePanelRect>),
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

export function getWorkspacePanelRenderHeight(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId
) {
  if (panelId === "board") {
    return layoutState.panels[panelId].h;
  }

  return layoutState.collapsed[panelId] ? collapsedPanelHeight : layoutState.panels[panelId].h;
}

function getWorkspacePanelPlacementRect(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId
): PanelPlacementRect {
  const panel = layoutState.panels[panelId];

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

export function canPlaceWorkspacePanel(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId,
  nextRect: WorkspacePanelRect
) {
  const normalizedRect = normalizePanelRect(panelId, nextRect);
  const nextPlacementRect: PanelPlacementRect = {
    x: normalizedRect.x,
    y: normalizedRect.y,
    w: normalizedRect.w,
    h: normalizedRect.h
  };

  for (const otherPanelId of workspacePanelIds) {
    if (otherPanelId === panelId) {
      continue;
    }

    if (
      rectanglesOverlap(nextPlacementRect, getWorkspacePanelPlacementRect(layoutState, otherPanelId))
    ) {
      return false;
    }
  }

  return true;
}

export function updateWorkspacePanelRect(input: {
  layoutState: WorkspaceLayoutState;
  panelId: WorkspacePanelId;
  nextRect: WorkspacePanelRect;
}) {
  const normalizedRect = normalizePanelRect(input.panelId, input.nextRect);

  if (!canPlaceWorkspacePanel(input.layoutState, input.panelId, normalizedRect)) {
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

export function updateWorkspaceColumnFraction(input: {
  layoutState: WorkspaceLayoutState;
  index: 0 | 1 | 2;
  value: number;
}) {
  const nextFractions = [...input.layoutState.columnFractions] as [number, number, number];
  nextFractions[input.index] = clamp(input.value, 0.5, 4);

  return {
    ...input.layoutState,
    columnFractions: nextFractions
  };
}

export function updateWorkspaceRowHeight(input: {
  layoutState: WorkspaceLayoutState;
  value: number;
}) {
  return {
    ...input.layoutState,
    rowHeight: clamp(Math.round(input.value), 30, 80)
  };
}

export function getWorkspaceGridUnitFractions(columnFractions: [number, number, number]) {
  return workspaceGroupUnits.map((unitCount, index) => columnFractions[index] / unitCount) as [
    number,
    number,
    number
  ];
}

export function getSnappedWorkspaceColumn(input: {
  offsetX: number;
  width: number;
  columnFractions: [number, number, number];
}) {
  const safeWidth = Math.max(input.width, 1);
  const clampedOffset = clamp(input.offsetX, 0, safeWidth);
  const totalFractions = input.columnFractions.reduce((sum, value) => sum + value, 0);
  const groupWidths = workspaceGroupUnits.map(
    (unitCount, index) => (safeWidth * input.columnFractions[index]) / totalFractions / unitCount
  );

  let runningWidth = 0;
  let currentColumn = 1;

  for (let groupIndex = 0; groupIndex < workspaceGroupUnits.length; groupIndex += 1) {
    const unitCount = workspaceGroupUnits[groupIndex];
    const unitWidth = groupWidths[groupIndex];

    for (let unitIndex = 0; unitIndex < unitCount; unitIndex += 1) {
      runningWidth += unitWidth;
      if (clampedOffset <= runningWidth || currentColumn === workspaceColumnCount) {
        return currentColumn;
      }

      currentColumn += 1;
    }
  }

  return workspaceColumnCount;
}

export function getSnappedWorkspaceRow(input: {
  offsetY: number;
  rowHeight: number;
}) {
  const safeRowHeight = Math.max(input.rowHeight, 1);
  return Math.max(1, Math.floor(Math.max(input.offsetY, 0) / safeRowHeight) + 1);
}

export function getWorkspaceLayoutRowCount(layoutState: WorkspaceLayoutState) {
  const maxRow = workspacePanelIds.reduce((currentMax, panelId) => {
    const panel = layoutState.panels[panelId];
    return Math.max(currentMax, panel.y + panel.h - 1);
  }, workspaceMinimumRows);

  return Math.max(workspaceMinimumRows, maxRow);
}
