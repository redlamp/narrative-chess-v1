import { type ReactNode, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FloatingActionNotice } from "./FloatingActionNotice";
import {
  ChevronDown,
  CloudDownload,
  CloudUpload,
  EllipsisVertical,
  FolderOpen,
  FolderTree,
  GripHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X
} from "lucide-react";
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

export type SharedLayoutPageOption = {
  value: string;
  label: string;
  icon?: ReactNode;
};

export type SharedLayoutPresetEntry = {
  id: string;
  name: string;
  active: boolean;
};

type SharedLayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  components: SharedLayoutToolbarComponent[];

  // Page navigation
  pages?: SharedLayoutPageOption[];
  activePage?: string;
  onPageChange?: (page: string) => void;

  // Presets
  presets: SharedLayoutPresetEntry[];
  onCreatePreset: () => void;
  onSavePreset: () => void;
  onActivatePreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onRenamePreset: (id: string, name: string) => void;
  onReorderPreset: (id: string, targetId: string) => void;

  // File (single bundle)
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  onLayoutFileNameChange: (value: string) => void;
  onConnectLayoutDirectory: () => void;
  onSaveLayoutBundle: () => void;
  onLoadLayoutBundle: () => void;
  onSaveLayoutBundleToCloud?: () => void;
  onLoadLayoutBundleFromCloud?: () => void;

  // Toolbar chrome
  onDragHandlePointerDown?: (event: ReactPointerEvent<HTMLElement>) => void;
  isDragging?: boolean;
  onToggleLayoutMode: () => void;
  onColumnCountChange: (value: number) => void;
  onColumnGapChange: (value: number) => void;
  onRowHeightChange: (value: number) => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  onRestoreComponent: (id: string) => void;
  onToggleComponentVisibility: (id: string, visible: boolean) => void;
  onResetLayout: () => void;
};

type LayoutToolbarOpenSections = {
  layouts: boolean;
  grid: boolean;
  components: boolean;
  file: boolean;
};

const defaultOpenSections: LayoutToolbarOpenSections = {
  layouts: true,
  grid: false,
  components: false,
  file: false
};

let sharedOpenSections: LayoutToolbarOpenSections = { ...defaultOpenSections };

export function SharedLayoutToolbar({
  columnCount,
  columnGap,
  rowHeight,
  showLayoutGrid,
  components,
  pages,
  activePage,
  onPageChange,
  presets,
  onCreatePreset,
  onSavePreset,
  onActivatePreset,
  onDeletePreset,
  onRenamePreset,
  onReorderPreset,
  layoutFileName,
  layoutDirectoryName,
  layoutFileNotice,
  isLayoutDirectorySupported,
  layoutFileBusyAction,
  onLayoutFileNameChange,
  onConnectLayoutDirectory,
  onSaveLayoutBundle,
  onLoadLayoutBundle,
  onSaveLayoutBundleToCloud,
  onLoadLayoutBundleFromCloud,
  onDragHandlePointerDown,
  isDragging = false,
  onToggleLayoutMode,
  onColumnCountChange,
  onColumnGapChange,
  onRowHeightChange,
  onToggleLayoutGrid,
  onRestoreComponent,
  onToggleComponentVisibility,
  onResetLayout
}: SharedLayoutToolbarProps) {
  const [openSections, setOpenSections] = useState<LayoutToolbarOpenSections>(() => ({
    ...sharedOpenSections
  }));

  const updateOpenSections = (
    updater: LayoutToolbarOpenSections | ((current: LayoutToolbarOpenSections) => LayoutToolbarOpenSections)
  ) => {
    setOpenSections((current) => {
      const next =
        typeof updater === "function"
          ? (updater as (current: LayoutToolbarOpenSections) => LayoutToolbarOpenSections)(current)
          : updater;
      sharedOpenSections = { ...next };
      return next;
    });
  };

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [draggedPresetId, setDraggedPresetId] = useState<string | null>(null);
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null);
  const activePreset = presets.find((p) => p.active);

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
              <h2 className="layout-toolbar__title">Layout Manager</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="layout-toolbar__close-button"
                  onClick={onToggleLayoutMode}
                  aria-label="Close layout manager"
                >
                  <X />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close layout manager</TooltipContent>
            </Tooltip>
          </div>

          {pages && pages.length > 0 && activePage && onPageChange ? (
            <Tabs
              value={activePage}
              onValueChange={onPageChange}
              className="layout-toolbar__page-tabs"
            >
              <TabsList className="layout-toolbar__page-tabs-list">
                {pages.map((page) => (
                  <Tooltip key={page.value}>
                    <TooltipTrigger asChild>
                      <TabsTrigger
                        value={page.value}
                        className="layout-toolbar__page-tab"
                        aria-label={page.label}
                      >
                        {page.icon}
                      </TabsTrigger>
                    </TooltipTrigger>
                    <TooltipContent>{page.label}</TooltipContent>
                  </Tooltip>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </CardHeader>

        <CardContent className="layout-toolbar__body">
          {/* Layouts section — sub-layouts / presets for this page */}
          <Collapsible
            open={openSections.layouts}
            onOpenChange={(open) => updateOpenSections((current) => ({ ...current, layouts: open }))}
            className="layout-toolbar__section"
          >
            <CollapsibleTrigger className="layout-toolbar__section-header">
              <span className="layout-toolbar__section-toggle" aria-hidden="true">
                <ChevronDown
                  className={`layout-toolbar__section-chevron ${openSections.layouts ? "is-open" : ""}`}
                />
              </span>
              <div className="layout-toolbar__section-meta">
                <h3 className="layout-toolbar__section-title">Layouts</h3>
                {presets.length > 0 ? <Badge variant="outline">{presets.length}</Badge> : null}
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="layout-toolbar__section-content">
              <div className="layout-toolbar__preset-list">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    draggable
                    className={[
                      "layout-toolbar__preset-row",
                      preset.active ? "is-active" : "",
                      dragOverPresetId === preset.id ? "is-drag-over" : "",
                      draggedPresetId === preset.id ? "is-dragging" : ""
                    ].filter(Boolean).join(" ")}
                    onDragStart={() => setDraggedPresetId(preset.id)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (draggedPresetId && draggedPresetId !== preset.id) {
                        setDragOverPresetId(preset.id);
                      }
                    }}
                    onDragLeave={() => setDragOverPresetId(null)}
                    onDrop={() => {
                      if (draggedPresetId && draggedPresetId !== preset.id) {
                        onReorderPreset(draggedPresetId, preset.id);
                      }
                      setDraggedPresetId(null);
                      setDragOverPresetId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedPresetId(null);
                      setDragOverPresetId(null);
                    }}
                  >
                    <span className="layout-toolbar__preset-grip" aria-hidden="true">
                      <GripHorizontal />
                    </span>
                    {editingPresetId === preset.id ? (
                      <input
                        className="layout-toolbar__preset-rename-input"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.currentTarget.value)}
                        onBlur={() => {
                          if (editingName.trim()) onRenamePreset(preset.id, editingName);
                          setEditingPresetId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            if (editingName.trim()) onRenamePreset(preset.id, editingName);
                            setEditingPresetId(null);
                          } else if (e.key === "Escape") {
                            setEditingPresetId(null);
                          }
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="layout-toolbar__preset-label"
                        onClick={() => onActivatePreset(preset.id)}
                        aria-pressed={preset.active}
                      >
                        <span className="layout-toolbar__preset-name">{preset.name}</span>
                        <span
                          className={`layout-toolbar__preset-indicator ${preset.active ? "is-active" : ""}`}
                          aria-hidden="true"
                        />
                      </button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Layout options"
                        >
                          <EllipsisVertical />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingPresetId(preset.id);
                            setEditingName(preset.name);
                          }}
                        >
                          <Pencil />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={presets.length <= 1}
                          onClick={() => onDeletePreset(preset.id)}
                        >
                          <Trash2 />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>

              <div className="layout-toolbar__preset-actions-row">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => activePreset && onDeletePreset(activePreset.id)}
                      disabled={!activePreset || presets.length <= 1}
                      aria-label="Delete active layout"
                    >
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete active layout</TooltipContent>
                </Tooltip>
                <span className="layout-toolbar__preset-actions-spacer" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onCreatePreset}
                      aria-label="New layout"
                    >
                      <Plus />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>New layout</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => activePreset && onActivatePreset(activePreset.id)}
                      disabled={!activePreset}
                      aria-label="Load active layout"
                    >
                      <FolderOpen />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Load active layout</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onResetLayout}
                      aria-label="Reset to default"
                    >
                      <RefreshCw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset to default</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={onSavePreset}
                      disabled={!activePreset}
                      aria-label="Save to active layout"
                    >
                      <Save />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save to active layout</TooltipContent>
                </Tooltip>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-1" />

          {/* Grid section */}
          <Collapsible
            open={openSections.grid}
            onOpenChange={(open) => updateOpenSections((current) => ({ ...current, grid: open }))}
            className="layout-toolbar__section"
          >
            <CollapsibleTrigger className="layout-toolbar__section-header">
              <span className="layout-toolbar__section-toggle" aria-hidden="true">
                <ChevronDown className={`layout-toolbar__section-chevron ${openSections.grid ? "is-open" : ""}`} />
              </span>
              <h3 className="layout-toolbar__section-title">Grid</h3>
            </CollapsibleTrigger>

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

          {/* Components section */}
          <Collapsible
            open={openSections.components}
            onOpenChange={(open) => updateOpenSections((current) => ({ ...current, components: open }))}
            className="layout-toolbar__section layout-toolbar__file-section"
          >
            <CollapsibleTrigger className="layout-toolbar__section-header">
              <span className="layout-toolbar__section-toggle" aria-hidden="true">
                <ChevronDown
                  className={`layout-toolbar__section-chevron ${openSections.components ? "is-open" : ""}`}
                />
              </span>
              <div className="layout-toolbar__section-meta">
                <h3 className="layout-toolbar__section-title">Components</h3>
                <Badge variant="outline">{components.length}</Badge>
              </div>
            </CollapsibleTrigger>

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

          {/* File section — single bundle for all pages */}
          <Collapsible
            open={openSections.file}
            onOpenChange={(open) => updateOpenSections((current) => ({ ...current, file: open }))}
            className="layout-toolbar__section layout-toolbar__file-section"
          >
            <CollapsibleTrigger className="layout-toolbar__section-header">
              <span className="layout-toolbar__section-toggle" aria-hidden="true">
                <ChevronDown
                  className={`layout-toolbar__section-chevron ${openSections.file ? "is-open" : ""}`}
                />
              </span>
              <div className="layout-toolbar__section-meta">
                <h3 className="layout-toolbar__section-title">File</h3>
                {layoutDirectoryName ? <Badge variant="outline">{layoutDirectoryName}</Badge> : null}
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent className="layout-toolbar__section-content">
              <div className="layout-toolbar__file-controls">
                <label className="slider-field">
                  <div className="slider-field__header">
                    <span>Bundle name</span>
                    <strong>{layoutFileName.trim() || "workspace-layout"}</strong>
                  </div>
                  <Input
                    name="layout-file-name"
                    autoComplete="off"
                    placeholder="workspace-layout"
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
                        <FolderTree />
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
                        onClick={onLoadLayoutBundle}
                        disabled={!layoutDirectoryName || layoutFileBusyAction !== null}
                        aria-label="Load layout bundle"
                      >
                        <FolderOpen />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Load all page layouts from file</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={onSaveLayoutBundle}
                        disabled={!layoutDirectoryName || layoutFileBusyAction !== null}
                        aria-label="Save layout bundle"
                      >
                        <Save />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save all page layouts to file</TooltipContent>
                  </Tooltip>
                  {onLoadLayoutBundleFromCloud ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={onLoadLayoutBundleFromCloud}
                          disabled={layoutFileBusyAction !== null}
                          aria-label="Load layout bundle from cloud"
                        >
                          <CloudDownload />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Load all page layouts from cloud</TooltipContent>
                    </Tooltip>
                  ) : null}
                  {onSaveLayoutBundleToCloud ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={onSaveLayoutBundleToCloud}
                          disabled={layoutFileBusyAction !== null}
                          aria-label="Save layout bundle to cloud"
                        >
                          <CloudUpload />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save all page layouts to cloud</TooltipContent>
                    </Tooltip>
                  ) : null}
                  <FloatingActionNotice notice={layoutFileNotice} />
                </div>
              </div>

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
