import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompetitiveLandscapePage } from "./CompetitiveLandscapePage";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";

type ResearchPageProps = {
  layoutMode: boolean;
  showLayoutGrid: boolean;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

export function ResearchPage({
  layoutMode,
  showLayoutGrid,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: ResearchPageProps) {
  return (
    <IndexedWorkspace
      className="research-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="research-page"
      layoutVariant="two-pane"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          badgeRow={
            <>
              <Badge variant="outline">Competition</Badge>
            </>
          }
          title="Research"
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Competitive analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <div className="grid gap-3">
              <Badge variant="secondary" className="w-fit">Competition</Badge>
            </div>
          </CardContent>
        </Card>
      }
      detail={
        <Card className="page-card page-card--detail">
          <CardContent className="page-card__content page-card__content--scroll">
            <CompetitiveLandscapePage />
          </CardContent>
        </Card>
      }
    />
  );
}
