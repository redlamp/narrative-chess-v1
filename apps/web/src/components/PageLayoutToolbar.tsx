import type { PageLayoutFileReference } from "../pageLayoutFiles";
import { SharedLayoutToolbar, type SharedLayoutFileNotice } from "./SharedLayoutToolbar";
import type { PointerEvent as ReactPointerEvent } from "react";

type PageLayoutToolbarComponent = {
  id: string;
  label: string;
  visible: boolean;
};

type PageLayoutToolbarProps = {
  columnCount: number;
  columnGap: number;
  rowHeight: number;
  showLayoutGrid: boolean;
  layoutFileName: string;
  layoutDirectoryName: string | null;
  layoutFileNotice: SharedLayoutFileNotice | null;
  isLayoutDirectorySupported: boolean;
  layoutFileBusyAction: string | null;
  knownLayoutFiles: PageLayoutFileReference[];
  components: PageLayoutToolbarComponent[];
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

export function PageLayoutToolbar(props: PageLayoutToolbarProps) {
  return (
    <SharedLayoutToolbar
      {...props}
      layoutFilePlaceholder="page-layout"
      knownLayoutFiles={props.knownLayoutFiles}
      components={props.components}
    />
  );
}
