type LayoutToolbarProps = {
  columnFractions: [number, number, number];
  rowHeight: number;
  showLayoutGrid: boolean;
  onColumnFractionChange: (index: 0 | 1 | 2, value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onResetLayout: () => void;
};

export function LayoutToolbar({
  columnFractions,
  rowHeight,
  showLayoutGrid,
  onColumnFractionChange,
  onRowHeightChange,
  onToggleLayoutGrid,
  onResetLayout
}: LayoutToolbarProps) {
  return (
    <section className="layout-toolbar">
      <div className="layout-toolbar__copy">
        <p className="panel__eyebrow">Layout Mode</p>
        <h2>Drag panel headers, resize from the lower-right corner, and snap to the guide grid.</h2>
      </div>

      <div className="layout-toolbar__controls">
        <label className="slider-field">
          <span>Column 1</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={columnFractions[0]}
            onChange={(event) => onColumnFractionChange(0, Number(event.currentTarget.value))}
          />
          <strong>{columnFractions[0].toFixed(2)}fr</strong>
        </label>
        <label className="slider-field">
          <span>Column 2</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={columnFractions[1]}
            onChange={(event) => onColumnFractionChange(1, Number(event.currentTarget.value))}
          />
          <strong>{columnFractions[1].toFixed(2)}fr</strong>
        </label>
        <label className="slider-field">
          <span>Column 3</span>
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.25"
            value={columnFractions[2]}
            onChange={(event) => onColumnFractionChange(2, Number(event.currentTarget.value))}
          />
          <strong>{columnFractions[2].toFixed(2)}fr</strong>
        </label>
        <label className="slider-field">
          <span>Row height</span>
          <input
            type="range"
            min="30"
            max="80"
            step="2"
            value={rowHeight}
            onChange={(event) => onRowHeightChange(Number(event.currentTarget.value))}
          />
          <strong>{rowHeight}px</strong>
        </label>
      </div>

      <div className="layout-toolbar__actions">
        <label className="menu-toggle menu-toggle--inline">
          <div>
            <span className="menu-toggle__label">Show snap grid</span>
            <span className="menu-toggle__description">Helps line up placements while editing.</span>
          </div>
          <input
            type="checkbox"
            checked={showLayoutGrid}
            onChange={(event) => onToggleLayoutGrid(event.currentTarget.checked)}
          />
        </label>
        <button
          type="button"
          className="button button--ghost"
          onClick={onResetLayout}
        >
          Reset layout
        </button>
      </div>
    </section>
  );
}
