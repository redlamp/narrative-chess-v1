export function getStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function roundOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
}

export function numberOrFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getSnappedColumn(input: {
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

export function getSnappedRow(input: {
  offsetY: number;
  rowHeight: number;
  rowGap: number;
}) {
  const safeRowHeight = Math.max(input.rowHeight, 1);
  const stride = safeRowHeight + Math.max(0, input.rowGap);
  return Math.max(1, Math.floor(Math.max(input.offsetY, 0) / Math.max(stride, 1)) + 1);
}
