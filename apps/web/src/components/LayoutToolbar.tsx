import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Folder, FolderOpen, RefreshCw, Save, Trash2, X } from "lucide-react";
import type { WorkspaceLayoutFileReference } from "../layoutFiles";
import { NumberStepperField } from "./NumberStepperField";

type LayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type LayoutToolbarComponent = {
  id: string;
  label: string;
  collapsed?: boolean;
};

type LayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: LayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: WorkspaceLayoutFileReference[];
  components: LayoutToolbarComponent[];
  onToggleLayoutMode: () => void;
  onColumnCountChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onLayoutFileNameChange: (value: string) => void;
  onConnectLayoutDirectory: () => void;
  onLoadLayoutFile: () => void;
  onSaveLayoutFile: () => void;
  onDeleteLayoutFile: () => void;
  onSelectKnownLayoutFile: (name: string) => void;
  onRestoreComponent: (id: string) => void;
  onResetLayout: () => void;
};

export function LayoutToolbar({
  columnCount,
  columnGap,
  rowHeight,
  showLayoutGrid,
  layoutFileName,
  layoutDirectoryName,
  layoutFileNotice,
  isLayoutDirectorySupported,
  layoutFileBusyAction,
  knownLayoutFiles,
  components,
  onToggleLayoutMode,
  onColumnCountChange,
  onColumnGapChange,
  onRowHeightChange,
  onToggleLayoutGrid,
  onLayoutFileNameChange,
  onConnectLayoutDirectory,
  onLoadLayoutFile,
  onSaveLayoutFile,
  onDeleteLayoutFile,
  onSelectKnownLayoutFile,
  onRestoreComponent,
  onResetLayout
}: LayoutToolbarProps) {
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
                min={1}
                max={24}
                step={1}
                onChange={onColumnCountChange}
              />
              <NumberStepperField
                label="Column gap (px)"
                value={columnGap}
                min={0}
                max={64}
                step={2}
                onChange={onColumnGapChange}
              />
              <NumberStepperField
                label="Row height (px)"
                value={rowHeight}
                min={8}
                max={256}
                step={2}
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
              <h3 className="layout-toolbar__section-title">Components</h3>
            </div>

            <div className="layout-toolbar__component-list">
              {components.map((component) => (
                <Button
                  key={component.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="layout-toolbar__component-button"
                  onClick={() => onRestoreComponent(component.id)}
                >
                  <span>{component.label}</span>
                  {component.collapsed ? <Badge variant="secondary">Collapsed</Badge> : null}
                </Button>
              ))}
            </div>
          </section>

          <section className="layout-toolbar__section layout-toolbar__file-section">
            <div className="layout-toolbar__section-header">
              <h3 className="layout-toolbar__section-title">Layouts</h3>
              {layoutDirectoryName ? <Badge variant="outline">Connected: {layoutDirectoryName}</Badge> : null}
            </div>

            <div className="layout-toolbar__file-controls">
              <label className="slider-field">
                <div className="slider-field__header">
                  <span>File name</span>
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

              <div className="layout-toolbar__icon-actions">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onConnectLayoutDirectory}
                      disabled={!isLayoutDirectorySupported || layoutFileBusyAction !== null}
                      aria-label="Connect layout folder"
                    >
                      <Folder />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Connect folder</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onLoadLayoutFile}
                      disabled={!layoutDirectoryName || layoutFileBusyAction !== null}
                      aria-label="Load layout file"
                    >
                      <FolderOpen />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Load named file</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onSaveLayoutFile}
                      disabled={!layoutDirectoryName || layoutFileBusyAction !== null}
                      aria-label="Save layout file"
                    >
                      <Save />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save named file</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onResetLayout}
                      disabled={layoutFileBusyAction !== null}
                      aria-label="Reset layout"
                    >
                      <RefreshCw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset layout</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={onDeleteLayoutFile}
                      disabled={!layoutDirectoryName || layoutFileBusyAction !== null}
                      aria-label="Remove layout file"
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove named file</TooltipContent>
                </Tooltip>
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
              <p className="muted">Folder save requires the File System Access API on localhost or HTTPS.</p>
            ) : null}
          </section>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
