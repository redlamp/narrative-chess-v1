import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { PieceAssetsPage } from "./PieceAssetsPage";
import { PieceStyleReferencePage } from "./PieceStyleReferencePage";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";

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
  const [activeTab, setActiveTab] = useState("art-assets");

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
              <Badge variant="secondary">Design</Badge>
              <Badge variant="outline">Art assets</Badge>
              <Badge variant="outline">Style reference</Badge>
            </>
          }
          title="Design references and piece styling"
          description="Review the live piece assets, inspect their markup hooks, and edit the shared CSS sheet that styles them across the app."
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Design sections</CardTitle>
              <CardDescription>Switch between art asset references and the live piece stylesheet.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="research-tabs">
              <TabsList aria-label="Design sections" className="research-tabs__list">
                <TabsTrigger value="art-assets">Art assets</TabsTrigger>
                <TabsTrigger value="style-reference">Style reference</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      }
      detail={
        activeTab === "art-assets" ? (
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
