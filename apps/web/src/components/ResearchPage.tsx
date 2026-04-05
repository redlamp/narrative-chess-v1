import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompetitiveLandscapePage } from "./CompetitiveLandscapePage";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { PieceAssetsPage } from "./PieceAssetsPage";
import { PieceStyleReferencePage } from "./PieceStyleReferencePage";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type ResearchPageProps = {
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

export function ResearchPage({
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
}: ResearchPageProps) {
  const [activeTab, setActiveTab] = useState("competition");

  return (
    <IndexedWorkspace
      className="research-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="research-page"
      layoutVariant="research"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          badgeRow={
            <>
              <Badge variant="secondary">Research</Badge>
              <Badge variant="outline">Competition</Badge>
              <Badge variant="outline">Art assets</Badge>
              <Badge variant="outline">Style reference</Badge>
            </>
          }
          title="Research and reference workspace"
          description="Review competitive patterns, current piece assets, and live piece styling in one place. This page now shares the same editable shell as the other curation pages."
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Research sections</CardTitle>
              <CardDescription>Switch between competition, art assets, and style references.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="research-tabs">
              <TabsList aria-label="Research sections" className="research-tabs__list">
                <TabsTrigger value="competition">Competition</TabsTrigger>
                <TabsTrigger value="art-assets">Art assets</TabsTrigger>
                <TabsTrigger value="style-reference">Style reference</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      }
      detail={
        activeTab === "competition" ? (
          <CompetitiveLandscapePage />
        ) : activeTab === "art-assets" ? (
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
