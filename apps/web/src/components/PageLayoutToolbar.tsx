import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, X } from "lucide-react";
import { NumberStepperField } from "./NumberStepperField";

type PageLayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  onToggleLayoutMode: () => void;
  onColumnCountChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onResetLayout: () => void;
};

export function PageLayoutToolbar({
  columnCount,
  columnGap,
  rowHeight,
  showLayoutGrid,
  onToggleLayoutMode,
  onColumnCountChange,
  onColumnGapChange,
  onRowHeightChange,
  onToggleLayoutGrid,
  onResetLayout
}: PageLayoutToolbarProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Card className="layout-toolbar">
        <CardHeader className="layout-toolbar__header">
          <div className="layout-toolbar__header-row">
            <h2 className="layout-toolbar__title">Layout mode</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleLayoutMode}
                  aria-label="Close layout mode"
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close layout mode</TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>

        <CardContent className="layout-toolbar__body">
          <section className="layout-toolbar__section">
            <h3 className="layout-toolbar__section-title">Grid</h3>
            <div className="layout-toolbar__controls">
              <NumberStepperField
                label="Column count"
                value={columnCount}
                min={6}
                max={16}
                step={1}
                onChange={onColumnCountChange}
              />
              <NumberStepperField
                label="Column gap"
                value={columnGap}
                min={8}
                max={32}
                step={2}
                unit="px"
                onChange={onColumnGapChange}
              />
              <NumberStepperField
                label="Row height"
                value={rowHeight}
                min={30}
                max={80}
                step={2}
                unit="px"
                onChange={onRowHeightChange}
              />
            </div>

            <div className="layout-toolbar__actions">
              <label className="menu-toggle menu-toggle--inline">
                <span className="menu-toggle__label">Show grid</span>
                <Switch checked={showLayoutGrid} onCheckedChange={onToggleLayoutGrid} />
              </label>
            </div>
          </section>

          <section className="layout-toolbar__section layout-toolbar__file-section">
            <div className="layout-toolbar__section-header">
              <h3 className="layout-toolbar__section-title">Layouts</h3>
            </div>
            <div className="layout-toolbar__icon-actions">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={onResetLayout}
                    aria-label="Reset layout"
                  >
                    <RefreshCw />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset layout</TooltipContent>
              </Tooltip>
            </div>
          </section>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
