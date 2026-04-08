import type { WorkspaceLayoutFileReference } from "../layoutFiles";
import {
  SharedLayoutToolbar,
  type SharedLayoutFileNotice,
  type SharedLayoutToolbarComponent
} from "./SharedLayoutToolbar";
import type { PointerEvent as ReactPointerEvent } from "react";

type LayoutToolbarComponent = {
  id: string;
  label: string;
  collapsed?: boolean;
  visible: boolean;
};

type LayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: WorkspaceLayoutFileReference[];
  components: LayoutToolbarComponent[];
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

export function LayoutToolbar({ components, ...props }: LayoutToolbarProps) {
  const sharedComponents: SharedLayoutToolbarComponent[] = components.map((component) => ({
    id: component.id,
    label: component.label,
    visible: component.visible,
    statusLabel: component.collapsed ? "Collapsed" : null
  }));

  return (
    <SharedLayoutToolbar
      {...props}
      layoutFilePlaceholder="match-workspace"
      knownLayoutFiles={props.knownLayoutFiles}
      components={sharedComponents}
    />
  );
}
