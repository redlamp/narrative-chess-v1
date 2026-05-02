import bundledMatchWorkspaceLayout from "../../../layouts/match-workspace.workspace-layout.json";
import {
  clamp,
  getStorage,
  numberOrFallback,
  roundOrFallback
} from "./layoutMath";

const workspacePanelIds = [
  "board",
  "moves",
  "city-map",
  "city-map-maplibre",
  "story-beat",
  "story-tile",
  "story-character",
  "story-tone",
  "recent-games"
] as const;

const collapsibleWorkspacePanelIds = [
  "board",
  "moves",
  "city-map",
  "city-map-maplibre",
  "story-beat",
  "story-tile",
  "story-character",
  "story-tone",
  "recent-games"
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
  version: 3;
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  panels: Record<WorkspacePanelId, WorkspacePanelRect>;
  collapsed: Record<CollapsibleWorkspacePanelId, boolean>;
  visible: Record<WorkspacePanelId, boolean>;
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
const collapsedPanelHeight = 1;

const minimumPanelWidth: Record<WorkspacePanelId, number> = {
  board: 1,
  moves: 1,
  "city-map": 1,
  "city-map-maplibre": 1,
  "story-beat": 1,
  "story-tile": 1,
  "story-character": 1,
  "story-tone": 1,
  "recent-games": 1
};

const minimumPanelHeight: Record<WorkspacePanelId, number> = {
  board: 1,
  moves: 1,
  "city-map": 1,
  "city-map-maplibre": 1,
  "story-beat": 1,
  "story-tile": 1,
  "story-character": 1,
  "story-tone": 1,
  "recent-games": 1
};

const bundledFallbackLayoutState: WorkspaceLayoutState = {
  version: 3,
  columnCount: workspaceDefaultColumnCount,
  columnGap: workspaceDefaultColumnGap,
  rowHeight: 64,
  panels: {
    board: { x: 7, y: 1, w: 4, h: 8 },
    moves: { x: 11, y: 1, w: 2, h: 15 },
    "city-map": { x: 7, y: 12, w: 4, h: 5 },
    "city-map-maplibre": { x: 7, y: 17, w: 4, h: 5 },
    "story-beat": { x: 1, y: 9, w: 6, h: 3 },
    "story-tile": { x: 1, y: 12, w: 3, h: 5 },
    "story-character": { x: 4, y: 12, w: 3, h: 5 },
    "story-tone": { x: 7, y: 9, w: 4, h: 3 },
    "recent-games": { x: 1, y: 1, w: 3, h: 8 }
  },
  collapsed: {
    board: false,
    moves: false,
    "city-map": false,
    "city-map-maplibre": false,
    "story-beat": false,
    "story-tile": false,
    "story-character": false,
    "story-tone": false,
    "recent-games": false
  },
  visible: {
    board: true,
    moves: true,
    "city-map": true,
    "city-map-maplibre": true,
    "story-beat": true,
    "story-tile": true,
    "story-character": true,
    "story-tone": true,
    "recent-games": true
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function normalizePanelRectFromFallback(
  panelId: WorkspacePanelId,
  value: unknown,
  columnCount: number,
  fallback: WorkspacePanelRect
): WorkspacePanelRect {
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

const legacyNarrativePanelId = "narrative";

function legacyStoryRectForPanel(
  panelId: WorkspacePanelId,
  legacyNarrativeRect: WorkspacePanelRect
): WorkspacePanelRect | null {
  if (
    panelId !== "story-beat" &&
    panelId !== "story-tile" &&
    panelId !== "story-character" &&
    panelId !== "story-tone"
  ) {
    return null;
  }

  const unitWidth = Math.max(1, legacyNarrativeRect.w / 8);
  const unitHeight = Math.max(1, legacyNarrativeRect.h / 11);

  const legacyStorySpec: Record<
    "story-beat" | "story-tile" | "story-character" | "story-tone",
    { x: number; y: number; w: number; h: number }
  > = {
    "story-beat": { x: 0, y: 0, w: 8, h: 4 },
    "story-tile": { x: 0, y: 4, w: 4, h: 4 },
    "story-character": { x: 4, y: 4, w: 4, h: 7 },
    "story-tone": { x: 0, y: 8, w: 4, h: 3 }
  };
  const spec = legacyStorySpec[panelId];

  return {
    x: legacyNarrativeRect.x + Math.round(spec.x * unitWidth),
    y: legacyNarrativeRect.y + Math.round(spec.y * unitHeight),
    w: Math.max(2, Math.round(spec.w * unitWidth)),
    h: Math.max(1, Math.round(spec.h * unitHeight))
  };
}

const bundledLayoutStateCandidate = isRecord(bundledMatchWorkspaceLayout)
  ? bundledMatchWorkspaceLayout.layoutState
  : null;
const bundledLayoutPanels: Record<string, unknown> = isRecord(bundledLayoutStateCandidate?.panels)
  ? bundledLayoutStateCandidate.panels
  : {};
const bundledCollapsedPanels: Record<string, unknown> = isRecord(
  bundledLayoutStateCandidate?.collapsed
)
  ? bundledLayoutStateCandidate.collapsed
  : {};
const defaultLayoutColumnCount = normalizeColumnCount(
  bundledLayoutStateCandidate?.columnCount ?? bundledFallbackLayoutState.columnCount
);
const bundledLegacyNarrativeRect = normalizePanelRectFromFallback(
  "story-beat",
  bundledLayoutPanels[legacyNarrativePanelId],
  defaultLayoutColumnCount,
  bundledFallbackLayoutState.panels["story-beat"]
);
const bundledLegacyNarrativeCollapsed =
  typeof bundledCollapsedPanels[legacyNarrativePanelId] === "boolean"
    ? (bundledCollapsedPanels[legacyNarrativePanelId] as boolean)
    : null;

const defaultLayoutState: WorkspaceLayoutState = {
  version: 3,
  columnCount: defaultLayoutColumnCount,
  columnGap: normalizeColumnGap(
    bundledLayoutStateCandidate?.columnGap ?? bundledFallbackLayoutState.columnGap
  ),
  rowHeight: clamp(
    numberOrFallback(
      bundledLayoutStateCandidate?.rowHeight,
      bundledFallbackLayoutState.rowHeight
    ),
    workspaceMinimumRowHeight,
    workspaceMaximumRowHeight
  ),
  panels: workspacePanelIds.reduce((nextPanels, panelId) => {
    const bundledPanelValue =
      bundledLayoutPanels[panelId] ??
      legacyStoryRectForPanel(panelId, bundledLegacyNarrativeRect);
    nextPanels[panelId] = normalizePanelRectFromFallback(
      panelId,
      bundledPanelValue,
      defaultLayoutColumnCount,
      bundledFallbackLayoutState.panels[panelId]
    );
    return nextPanels;
  }, {} as Record<WorkspacePanelId, WorkspacePanelRect>),
  collapsed: collapsibleWorkspacePanelIds.reduce((nextCollapsed, panelId) => {
    nextCollapsed[panelId] =
      typeof bundledCollapsedPanels[panelId] === "boolean"
        ? (bundledCollapsedPanels[panelId] as boolean)
        : bundledLegacyNarrativeCollapsed !== null &&
            (panelId === "story-beat" ||
              panelId === "story-tile" ||
              panelId === "story-character" ||
              panelId === "story-tone")
          ? bundledLegacyNarrativeCollapsed
        : bundledFallbackLayoutState.collapsed[panelId];
    return nextCollapsed;
  }, {} as Record<CollapsibleWorkspacePanelId, boolean>),
  visible: workspacePanelIds.reduce((nextVisible, panelId) => {
    nextVisible[panelId] = bundledFallbackLayoutState.visible[panelId];
    return nextVisible;
  }, {} as Record<WorkspacePanelId, boolean>)
};

function normalizePanelRect(
  panelId: WorkspacePanelId,
  value: unknown,
  columnCount: number
): WorkspacePanelRect {
  return normalizePanelRectFromFallback(
    panelId,
    value,
    columnCount,
    defaultLayoutState.panels[panelId]
  );
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
    version: 3,
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
    }, {} as Record<CollapsibleWorkspacePanelId, boolean>),
    visible: workspacePanelIds.reduce((nextVisible, panelId) => {
      nextVisible[panelId] = defaultLayoutState.visible[panelId];
      return nextVisible;
    }, {} as Record<WorkspacePanelId, boolean>)
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
  const candidateVisible =
    candidate.visible && typeof candidate.visible === "object"
      ? (candidate.visible as Record<string, unknown>)
      : {};
  const columnCount = normalizeColumnCount(candidate.columnCount);
  const legacyNarrativeRect = normalizePanelRectFromFallback(
    "story-beat",
    candidatePanels[legacyNarrativePanelId],
    columnCount,
    defaultLayoutState.panels["story-beat"]
  );
  const legacyNarrativeCollapsed =
    typeof candidateCollapsed[legacyNarrativePanelId] === "boolean"
      ? (candidateCollapsed[legacyNarrativePanelId] as boolean)
      : null;
  const normalizedPanels = workspacePanelIds.reduce((nextPanels, panelId) => {
    const candidatePanelValue =
      candidatePanels[panelId] ?? legacyStoryRectForPanel(panelId, legacyNarrativeRect);
    nextPanels[panelId] = normalizePanelRect(panelId, candidatePanelValue, columnCount);
    return nextPanels;
  }, {} as Record<WorkspacePanelId, WorkspacePanelRect>);

  return {
    version: 3,
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
          : legacyNarrativeCollapsed !== null &&
              (panelId === "story-beat" ||
                panelId === "story-tile" ||
                panelId === "story-character" ||
                panelId === "story-tone")
            ? legacyNarrativeCollapsed
          : defaultLayoutState.collapsed[panelId];
      return nextCollapsed;
    }, {} as Record<CollapsibleWorkspacePanelId, boolean>),
    visible: workspacePanelIds.reduce((nextVisible, panelId) => {
      nextVisible[panelId] =
        typeof candidateVisible[panelId] === "boolean"
          ? (candidateVisible[panelId] as boolean)
          : defaultLayoutState.visible[panelId];
      return nextVisible;
    }, {} as Record<WorkspacePanelId, boolean>)
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

function getWorkspacePanelRenderHeight(
  layoutState: WorkspaceLayoutState,
  panelId: WorkspacePanelId
) {
  if (!layoutState.visible[panelId]) {
    return 0;
  }

  const panel = layoutState.panels[panelId];
  if (!panel) {
    return 0;
  }

  return layoutState.collapsed[panelId] ? collapsedPanelHeight : panel.h;
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

export function setWorkspacePanelVisible(input: {
  layoutState: WorkspaceLayoutState;
  panelId: WorkspacePanelId;
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

export function getWorkspaceLayoutRowCount(
  layoutState: WorkspaceLayoutState,
  minimumRows: number = workspaceMinimumRows
) {
  const safeMinimumRows = Math.max(1, minimumRows);
  const maxRow = workspacePanelIds.reduce((currentMax, panelId) => {
    if (!layoutState.visible[panelId]) {
      return currentMax;
    }

    const panel = layoutState.panels[panelId];
    const renderHeight = getWorkspacePanelRenderHeight(layoutState, panelId);
    return Math.max(currentMax, panel.y + renderHeight - 1);
  }, safeMinimumRows);

  return Math.max(safeMinimumRows, maxRow);
}
