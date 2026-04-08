import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, Folder, FolderOpen, RefreshCw, Save, Trash2, X } from "lucide-react";
import { NumberStepperField } from "./NumberStepperField";

export type SharedLayoutFileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

export type SharedLayoutToolbarComponent = {
  id: string;
  label: string;
  visible: boolean;
  statusLabel?: string | null;
};

export type SharedLayoutFileReference = {
  name: string;
  fileName: string;
};

type SharedLayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutFilePlaceholder: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: SharedLayoutFileReference[];
  components: SharedLayoutToolbarComponent[];
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  isDragging?: boolean;
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
  onToggleComponentVisibility: (id: string, visible: boolean) => void;
  onResetLayout: () => void;
};

export function SharedLayoutToolbar({
  columnCount,
  columnGap,
  rowHeight,
  showLayoutGrid,
  layoutFileName,
  layoutFilePlaceholder,
  layoutDirectoryName,
  layoutFileNotice,
  isLayoutDirectorySupported,
  layoutFileBusyAction,
  knownLayoutFiles,
  components,
  onDragHandlePointerDown,
  isDragging = false,
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
  onToggleComponentVisibility,
  onResetLayout
}: SharedLayoutToolbarProps) {
  const [openSections, setOpenSections] = useState({
    grid: true,
    components: true,
    layouts: true
  });

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="layout-toolbar">
        <CardHeader className="layout-toolbar__header">
          <div className="layout-toolbar__header-row">
            <div
              className="layout-toolbar__drag-handle"
              onPointerDown={onDragHandlePointerDown}
              data-dragging={isDragging ? "true" : "false"}
            >
              <h2 className="layout-toolbar__title">Layout mode</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="layout-toolbar__close-button"
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
          <Collapsible
            open={openSections.grid}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, grid: open }))}
            className="layout-toolbar__section"
          >
            <div className="layout-toolbar__section-header">
              <h3 className="layout-toolbar__section-title">Grid</h3>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={openSections.grid ? "Collapse grid section" : "Expand grid section"}
                >
                  <ChevronDown className={`layout-toolbar__section-chevron ${openSections.grid ? "is-open" : ""}`} />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="layout-toolbar__section-content">
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
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={openSections.components}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, components: open }))}
            className="layout-toolbar__section layout-toolbar__file-section"
          >
            <div className="layout-toolbar__section-header">
              <div className="layout-toolbar__section-meta">
                <h3 className="layout-toolbar__section-title">Components</h3>
                <Badge variant="outline">{components.length}</Badge>
              </div>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={openSections.components ? "Collapse components section" : "Expand components section"}
                >
                  <ChevronDown
                    className={`layout-toolbar__section-chevron ${openSections.components ? "is-open" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>

            <CollapsibleContent className="layout-toolbar__section-content">
              <div className="layout-toolbar__component-list">
                {components.map((component) => (
                  <div key={component.id} className="layout-toolbar__component-row">
                    <label className="layout-toolbar__component-toggle">
                      <input
                        type="checkbox"
                        checked={component.visible}
                        onChange={(event) =>
                          onToggleComponentVisibility(component.id, event.currentTarget.checked)
                        }
                      />
                      <span>{component.label}</span>
                    </label>
                    <div className="layout-toolbar__component-actions">
                      {component.statusLabel ? <Badge variant="secondary">{component.statusLabel}</Badge> : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onRestoreComponent(component.id)}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible
            open={openSections.layouts}
            onOpenChange={(open) => setOpenSections((current) => ({ ...current, layouts: open }))}
            className="layout-toolbar__section layout-toolbar__file-section"
          >
            <div className="layout-toolbar__section-header">
              <h3 className="layout-toolbar__section-title">Layouts</h3>
              <div className="layout-toolbar__section-meta">
                {layoutDirectoryName ? <Badge variant="outline">Connected: {layoutDirectoryName}</Badge> : null}
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={openSections.layouts ? "Collapse layouts section" : "Expand layouts section"}
                  >
                    <ChevronDown
                      className={`layout-toolbar__section-chevron ${openSections.layouts ? "is-open" : ""}`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            <CollapsibleContent className="layout-toolbar__section-content">
              <div className="layout-toolbar__file-controls">
                <label className="slider-field">
                  <div className="slider-field__header">
                    <span>File name</span>
                    <strong>{layoutFileName.trim() || layoutFilePlaceholder}</strong>
                  </div>
                  <Input
                    name="layout-file-name"
                    autoComplete="off"
                    placeholder={layoutFilePlaceholder}
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
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
