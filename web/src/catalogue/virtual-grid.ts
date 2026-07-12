import { CREATOR_CONFIG } from "../config";

export interface VirtualWindow {
  start: number;
  end: number;
  top: number;
  totalHeight: number;
}

const nonnegativeInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const positiveInteger = (value: number): number =>
  Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;

export function computeVirtualColumns(input: {
  columns: number;
  rowHeight: number;
  viewportHeight: number;
  overscanRows: number;
}): number {
  const requestedColumns = positiveInteger(input.columns);
  const rowHeight = positiveInteger(input.rowHeight);
  const viewportHeight = nonnegativeInteger(input.viewportHeight);
  const overscanRows = nonnegativeInteger(input.overscanRows);
  const mountedRows = Math.max(
    1,
    Math.ceil(viewportHeight / rowHeight) + overscanRows * 2
  );
  const columnsWithinBudget = Math.max(
    1,
    Math.floor(CREATOR_CONFIG.liveThumbnailLimit / mountedRows)
  );
  return Math.min(requestedColumns, columnsWithinBudget);
}

export function computeVirtualWindow(input: {
  itemCount: number;
  columns: number;
  rowHeight: number;
  viewportHeight: number;
  scrollTop: number;
  overscanRows: number;
}): VirtualWindow {
  const itemCount = nonnegativeInteger(input.itemCount);
  const columns = computeVirtualColumns(input);
  const rowHeight = positiveInteger(input.rowHeight);
  const viewportHeight = nonnegativeInteger(input.viewportHeight);
  const scrollTop = Math.max(0, Number.isFinite(input.scrollTop) ? input.scrollTop : 0);
  const overscanRows = nonnegativeInteger(input.overscanRows);
  const totalRows = Math.ceil(itemCount / columns);
  const rawFirstRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
  const firstRow = Math.min(totalRows, rawFirstRow);
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + overscanRows * 2;
  const lastRow = Math.min(totalRows, firstRow + visibleRows);
  const start = Math.min(itemCount, firstRow * columns);
  const liveCount = Math.min(
    CREATOR_CONFIG.liveThumbnailLimit,
    Math.max(0, lastRow - firstRow) * columns
  );

  return {
    start,
    end: Math.min(itemCount, start + liveCount),
    top: firstRow * rowHeight,
    totalHeight: totalRows * rowHeight
  };
}
