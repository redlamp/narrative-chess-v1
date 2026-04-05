import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { PieceAssetsPage } from "./PieceAssetsPage";
import { PieceStyleReferencePage } from "./PieceStyleReferencePage";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";
import { WorkspaceListItem } from "./WorkspaceListItem";

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type DesignPageProps = {
  layoutMode: boolean;
  showLayoutGrid: boolean;
  pieceStyleSheet: string;
  pieceStyleDirectoryName: string | null;
  isPieceStyleDirectorySupported: boolean;
  pieceStyleFileBusyAction: string | null;
  pieceStyleFileNotice: FileNotice | null;
  onPieceStyleSheetChange: (value: string) => void;
  onConnectPieceStyleDirectory: () => void;
  onLoadPieceStyleSheetFromDirectory: () => void;
  onSavePieceStyleSheetToDirectory: () => void;
  onResetPieceStyleSheet: () => void;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

export function DesignPage({
  layoutMode,
  showLayoutGrid,
  pieceStyleSheet,
  pieceStyleDirectoryName,
  isPieceStyleDirectorySupported,
  pieceStyleFileBusyAction,
  pieceStyleFileNotice,
  onPieceStyleSheetChange,
  onConnectPieceStyleDirectory,
  onLoadPieceStyleSheetFromDirectory,
  onSavePieceStyleSheetToDirectory,
  onResetPieceStyleSheet,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: DesignPageProps) {
  const [activeSection, setActiveSection] = useState<"art-assets" | "style-reference">("art-assets");

  return (
    <IndexedWorkspace
      className="design-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="design-page"
      layoutVariant="two-pane"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          badgeRow={
            <>
              <Badge variant="outline">Art assets</Badge>
              <Badge variant="outline">Style reference</Badge>
            </>
          }
          title="Design"
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Design sections</CardTitle>
              <CardDescription>Choose a section, then review or edit it in the detail pane.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <div className="grid gap-2">
              <WorkspaceListItem
                type="button"
                onClick={() => setActiveSection("art-assets")}
                selected={activeSection === "art-assets"}
                title="Art assets"
                description="Review the live piece glyphs, markup hooks, and current asset presentation."
                meta={<Badge variant="outline">Reference</Badge>}
              />
              <WorkspaceListItem
                type="button"
                onClick={() => setActiveSection("style-reference")}
                selected={activeSection === "style-reference"}
                title="Style reference"
                description="Edit the shared piece stylesheet and save it back to the project folder."
                meta={<Badge variant="outline">Editable</Badge>}
              />
            </div>
          </CardContent>
        </Card>
      }
      detail={
        activeSection === "art-assets" ? (
          <PieceAssetsPage />
        ) : (
          <PieceStyleReferencePage
            pieceStyleSheet={pieceStyleSheet}
            pieceStyleDirectoryName={pieceStyleDirectoryName}
            isPieceStyleDirectorySupported={isPieceStyleDirectorySupported}
            pieceStyleFileBusyAction={pieceStyleFileBusyAction}
            pieceStyleFileNotice={pieceStyleFileNotice}
            onPieceStyleSheetChange={onPieceStyleSheetChange}
            onConnectPieceStyleDirectory={onConnectPieceStyleDirectory}
            onLoadPieceStyleSheetFromDirectory={onLoadPieceStyleSheetFromDirectory}
            onSavePieceStyleSheetToDirectory={onSavePieceStyleSheetToDirectory}
            onResetPieceStyleSheet={onResetPieceStyleSheet}
          />
        )
      }
    />
  );
}
