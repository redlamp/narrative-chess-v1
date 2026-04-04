import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { WorkspaceLayoutFileReference } from "../layoutFiles";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type LayoutToolbarProps = {
  columnFractions: [number, number, number];
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: LayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: WorkspaceLayoutFileReference[];
  onToggleLayoutMode: () => void;
  onExpandPanels: () => void;
  onColumnFractionChange: (index: 0 | 1 | 2, value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onLayoutFileNameChange: (value: string) => void;
  onConnectLayoutDirectory: () => void;
  onLoadLayoutFile: () => void;
  onSaveLayoutFile: () => void;
  onSelectKnownLayoutFile: (name: string) => void;
  onResetLayout: () => void;
};

export function LayoutToolbar({
  columnFractions,
  rowHeight,
  showLayoutGrid,
  layoutFileName,
  layoutDirectoryName,
  layoutFileNotice,
  isLayoutDirectorySupported,
  layoutFileBusyAction,
  knownLayoutFiles,
  onToggleLayoutMode,
  onExpandPanels,
  onColumnFractionChange,
  onRowHeightChange,
  onToggleLayoutGrid,
  onLayoutFileNameChange,
  onConnectLayoutDirectory,
  onLoadLayoutFile,
  onSaveLayoutFile,
  onSelectKnownLayoutFile,
  onResetLayout
}: LayoutToolbarProps) {
  return (
    <Card className="layout-toolbar">
      <CardHeader className="layout-toolbar__copy">
        <div className="grid gap-2">
          <p className="panel__eyebrow">Layout Mode</p>
          <CardTitle>Drag panel headers, resize from the lower-right corner, and snap to the guide grid.</CardTitle>
        </div>
        <div className="layout-toolbar__mode-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onToggleLayoutMode}>
            Exit layout mode
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onExpandPanels}>
            Expand panels
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onResetLayout}>
            Reset layout
          </Button>
        </div>
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
        </div>

        <div className="layout-toolbar__file-section">
          <div className="layout-toolbar__file-header">
            <div className="grid gap-1">
              <span className="panel__eyebrow">Named Layout Files</span>
              <p className="muted">
                Save the current panel arrangement to a JSON file in the repo so it can be loaded again later.
              </p>
            </div>
            {layoutDirectoryName ? <Badge variant="outline">Connected: {layoutDirectoryName}</Badge> : null}
          </div>

          <div className="layout-toolbar__file-controls">
            <label className="slider-field">
              <div className="slider-field__header">
                <span>Layout file name</span>
                <strong>{layoutFileName.trim() || "match-workspace"}</strong>
              </div>
              <Input
                name="layout-file-name"
                autoComplete="off"
                placeholder="match-workspace"
                value={layoutFileName}
                onChange={(event) => onLayoutFileNameChange(event.currentTarget.value)}
              />
            </label>
            <div className="layout-toolbar__file-actions">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onConnectLayoutDirectory}
                disabled={!isLayoutDirectorySupported || layoutFileBusyAction !== null}
              >
                Connect folder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onLoadLayoutFile}
                disabled={layoutFileBusyAction !== null}
              >
                Load named file
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSaveLayoutFile}
                disabled={layoutFileBusyAction !== null}
              >
                Save named file
              </Button>
            </div>
          </div>

          {knownLayoutFiles.length ? (
            <div className="layout-toolbar__saved-files">
              {knownLayoutFiles.map((file) => (
                <Button
                  key={file.fileName}
                  type="button"
                  variant={file.name === layoutFileName ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onSelectKnownLayoutFile(file.name)}
                >
                  {file.name}
                </Button>
              ))}
            </div>
          ) : null}

          {layoutFileNotice ? (
            <div
              className={`layout-toolbar__notice layout-toolbar__notice--${layoutFileNotice.tone}`}
              role="status"
              aria-live="polite"
            >
              {layoutFileNotice.text}
            </div>
          ) : null}

          {!isLayoutDirectorySupported ? (
            <p className="muted">
              Folder save requires the File System Access API on localhost or HTTPS.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
