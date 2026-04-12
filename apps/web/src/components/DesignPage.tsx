import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { PieceAssetsPage } from "./PieceAssetsPage";
import { PieceStyleReferencePage } from "./PieceStyleReferencePage";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";
import { WorkspaceListItem } from "./WorkspaceListItem";

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type TypographyZooCategory = "all" | "display" | "headings" | "body" | "labels" | "mono";

type TypographySpecimen = {
  label: string;
  sample: string;
  note: string;
  className: string;
  categories: TypographyZooCategory[];
};

const typographySpecimens: TypographySpecimen[] = [
  {
    label: "Display",
    sample: "Narrative Chess",
    note: "Use for landing moments and section openers.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--display",
    categories: ["all", "display"]
  },
  {
    label: "Section heading",
    sample: "District review",
    note: "Strong enough to orient the eye, not so large that it steals the page.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--section",
    categories: ["all", "display", "headings"]
  },
  {
    label: "Subhead",
    sample: "Board tiles, map anchors, and narrative notes should stay easy to scan.",
    note: "Good for short explanatory lines under cards or headers.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--subhead",
    categories: ["all", "headings"]
  },
  {
    label: "Body",
    sample:
      "Players should be able to read the board, inspect the city, and understand the state of play without hunting for meaning.",
    note: "Default paragraph rhythm for the app.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--body",
    categories: ["all", "body"]
  },
  {
    label: "Label",
    sample: "Review status",
    note: "Useful for form labels, status rows, and compact metadata.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--label",
    categories: ["all", "labels"]
  },
  {
    label: "Mono",
    sample: "a8 · reviewed · 2026-04-09",
    note: "Use for file paths, identifiers, and technical context.",
    className: "design-typography-zoo__sample-value design-typography-zoo__sample-value--mono",
    categories: ["all", "mono"]
  }
];

function TypographyZooPage() {
  const [activeCategory, setActiveCategory] = useState<TypographyZooCategory>("all");
  const filteredSpecimens = typographySpecimens.filter((specimen) => specimen.categories.includes(activeCategory));

  return (
    <Card className="page-card page-card--detail design-typography-zoo-card">
      <CardContent className="page-card__content page-card__content--scroll design-typography-zoo-scroll">
        <section className="grid w-full gap-6 design-typography-zoo">
          <Card className="design-typography-zoo__hero">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Typography zoo</Badge>
                <Badge variant="outline">Design exploration</Badge>
              </div>
              <CardTitle className="text-4xl tracking-tight">Type scale, rhythm, and contrast</CardTitle>
              <CardDescription className="max-w-3xl text-sm leading-6">
                Compare display text, section titles, labels, and body copy in one place before
                settling on a direction for the rest of the app.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
              <div className="design-typography-zoo__hero-copy">
                <p className="design-typography-zoo__eyebrow">Primary sample</p>
                <h2>Narrative text should read with confidence before it tries to feel clever.</h2>
                <p>
                  This area gives you a quick editorial read on the page hierarchy: large headlines,
                  compact labels, a comfortable paragraph measure, and the kinds of dense technical
                  strings the app already uses.
                </p>
              </div>
              <div className="design-typography-zoo__hero-panel">
                <div className="design-typography-zoo__hero-panel-row">
                  <span className="design-typography-zoo__sample-label">Measure</span>
                  <span className="design-typography-zoo__sample-value design-typography-zoo__sample-value--body">
                    52 to 64 characters
                  </span>
                </div>
                <div className="design-typography-zoo__hero-panel-row">
                  <span className="design-typography-zoo__sample-label">Hierarchy</span>
                  <span className="design-typography-zoo__sample-value design-typography-zoo__sample-value--label">
                    Display / heading / body / label
                  </span>
                </div>
                <div className="design-typography-zoo__hero-panel-row">
                  <span className="design-typography-zoo__sample-label">Use case</span>
                  <span className="design-typography-zoo__sample-value design-typography-zoo__sample-value--mono">
                    design/page exploration
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="design-typography-zoo__options">
            <CardHeader className="gap-2">
              <CardTitle>Design section options</CardTitle>
              <CardDescription>
                Browse the typography hierarchy by role before settling the page direction.
              </CardDescription>
            </CardHeader>
            <CardContent className="design-typography-zoo__options-body">
              <Tabs
                value={activeCategory}
                onValueChange={(value) => setActiveCategory(value as TypographyZooCategory)}
              >
                <TabsList variant="line" className="design-typography-zoo__tabs-list">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="display">Display</TabsTrigger>
                  <TabsTrigger value="headings">Headings</TabsTrigger>
                  <TabsTrigger value="body">Body</TabsTrigger>
                  <TabsTrigger value="labels">Labels</TabsTrigger>
                  <TabsTrigger value="mono">Mono</TabsTrigger>
                </TabsList>
                <TabsContent value={activeCategory} className="design-typography-zoo__tabs-content">
                  <div className="design-typography-zoo__options-summary">
                    <span className="design-typography-zoo__sample-label">Showing</span>
                    <span className="design-typography-zoo__options-count">{filteredSpecimens.length} specimens</span>
                  </div>
                  <p className="design-typography-zoo__options-note">
                    Use the tabs to focus on a narrow slice of the hierarchy, or keep the full set in
                    view for side-by-side comparison.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="design-typography-zoo__specimen">
            <CardHeader className="gap-2">
              <CardDescription className="text-xs uppercase tracking-[0.18em]">Heading stack</CardDescription>
            </CardHeader>
            <CardContent className="design-typography-zoo__heading-stack">
              <div>
                <span className="design-typography-zoo__sample-label">H1</span>
                <h1 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h1">Narrative Chess</h1>
              </div>
              <div>
                <span className="design-typography-zoo__sample-label">H2</span>
                <h2 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h2">District review and map placement</h2>
              </div>
              <div>
                <span className="design-typography-zoo__sample-label">H3</span>
                <h3 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h3">City overview and editorial notes</h3>
              </div>
              <div>
                <span className="design-typography-zoo__sample-label">H4</span>
                <h4 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h4">Board tile alignment</h4>
              </div>
              <div>
                <span className="design-typography-zoo__sample-label">H5</span>
                <h5 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h5">Narrative hooks</h5>
              </div>
              <div>
                <span className="design-typography-zoo__sample-label">H6</span>
                <h6 className="design-typography-zoo__heading-sample design-typography-zoo__heading-sample--h6">Metadata and status</h6>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            {filteredSpecimens.map((specimen) => (
              <Card key={specimen.label} className="design-typography-zoo__specimen">
                <CardHeader className="gap-2">
                  <CardDescription className="text-xs uppercase tracking-[0.18em]">
                    {specimen.label}
                  </CardDescription>
                </CardHeader>
                <CardContent className="design-typography-zoo__specimen-body grid gap-3">
                  <div className={specimen.className}>{specimen.sample}</div>
                  <p className="design-typography-zoo__specimen-note">{specimen.note}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="design-typography-zoo__footer">
            <CardHeader className="gap-2">
              <CardTitle>Typography notes</CardTitle>
              <CardDescription>Keep these anchors stable while the rest of the system evolves.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium">Headers</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Prefer compact letter spacing and strong line-height control.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium">Body copy</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep paragraphs calm and readable; let the content carry the density.
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="font-medium">Labels</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uppercase metadata works best when it stays small and spaced out.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </CardContent>
    </Card>
  );
}

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
  const [activeSection, setActiveSection] = useState<"art-assets" | "style-reference" | "typography-zoo">(
    "art-assets"
  );

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
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <ul className="workspace-list">
              <WorkspaceListItem
                type="button"
                onClick={() => setActiveSection("art-assets")}
                selected={activeSection === "art-assets"}
                title="Art assets"
                meta={<Badge variant="outline">Reference</Badge>}
              />
              <WorkspaceListItem
                type="button"
                onClick={() => setActiveSection("style-reference")}
                selected={activeSection === "style-reference"}
                title="Style reference"
                meta={<Badge variant="outline">Editable</Badge>}
              />
              <WorkspaceListItem
                type="button"
                onClick={() => setActiveSection("typography-zoo")}
                selected={activeSection === "typography-zoo"}
                title="Typography zoo"
                meta={<Badge variant="outline">New</Badge>}
              />
            </ul>
          </CardContent>
        </Card>
      }
      detail={
        activeSection === "art-assets" ? (
          <Card className="page-card page-card--detail">
            <CardContent className="page-card__content page-card__content--scroll">
              <PieceAssetsPage />
            </CardContent>
          </Card>
        ) : activeSection === "style-reference" ? (
          <Card className="page-card page-card--detail">
            <CardContent className="page-card__content page-card__content--scroll">
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
            </CardContent>
          </Card>
        ) : (
          <TypographyZooPage />
        )
      }
    />
  );
}
