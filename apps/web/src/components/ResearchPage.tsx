import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
              <Badge variant="secondary">Research</Badge>
              <Badge variant="outline">Competition</Badge>
            </>
          }
          title="Competitive research"
          description="Review competing chess products and note the patterns worth borrowing, avoiding, or pressure-testing in Narrative Chess."
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Competitive analysis</CardTitle>
              <CardDescription>Use this page for market references and direct product comparisons.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <div className="grid gap-3">
              <Badge variant="secondary" className="w-fit">Competition</Badge>
              <p className="text-sm text-muted-foreground">
                This section tracks comparable chess products, screenshots, and notes about how
                they frame study, analysis, onboarding, and long-term retention.
              </p>
            </div>
          </CardContent>
        </Card>
      }
      detail={<CompetitiveLandscapePage />}
    />
  );
}
