import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

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
    <Card className="layout-toolbar">
      <CardHeader className="layout-toolbar__copy">
        <p className="panel__eyebrow">Layout Mode</p>
        <CardTitle>Drag panel headers, resize from the lower-right corner, and snap to the guide grid.</CardTitle>
      </CardHeader>

      <CardContent className="layout-toolbar__body">
        <div className="layout-toolbar__controls">
          <label className="slider-field">
            <div className="slider-field__header">
              <span>Column 1</span>
              <strong>{columnFractions[0].toFixed(2)}fr</strong>
            </div>
            <Slider
              min={0.5}
              max={4}
              step={0.25}
              value={[columnFractions[0]]}
              onValueChange={([nextValue]) => {
                if (typeof nextValue === "number") {
                  onColumnFractionChange(0, nextValue);
                }
              }}
            />
          </label>
          <label className="slider-field">
            <div className="slider-field__header">
              <span>Column 2</span>
              <strong>{columnFractions[1].toFixed(2)}fr</strong>
            </div>
            <Slider
              min={0.5}
              max={4}
              step={0.25}
              value={[columnFractions[1]]}
              onValueChange={([nextValue]) => {
                if (typeof nextValue === "number") {
                  onColumnFractionChange(1, nextValue);
                }
              }}
            />
          </label>
          <label className="slider-field">
            <div className="slider-field__header">
              <span>Column 3</span>
              <strong>{columnFractions[2].toFixed(2)}fr</strong>
            </div>
            <Slider
              min={0.5}
              max={4}
              step={0.25}
              value={[columnFractions[2]]}
              onValueChange={([nextValue]) => {
                if (typeof nextValue === "number") {
                  onColumnFractionChange(2, nextValue);
                }
              }}
            />
          </label>
          <label className="slider-field">
            <div className="slider-field__header">
              <span>Row height</span>
              <strong>{rowHeight}px</strong>
            </div>
            <Slider
              min={30}
              max={80}
              step={2}
              value={[rowHeight]}
              onValueChange={([nextValue]) => {
                if (typeof nextValue === "number") {
                  onRowHeightChange(nextValue);
                }
              }}
            />
          </label>
        </div>

        <div className="layout-toolbar__actions">
          <label className="menu-toggle menu-toggle--inline">
            <div>
              <span className="menu-toggle__label">Show snap grid</span>
              <span className="menu-toggle__description">Helps line up placements while editing.</span>
            </div>
            <Switch checked={showLayoutGrid} onCheckedChange={onToggleLayoutGrid} />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={onResetLayout}>
            Reset layout
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
