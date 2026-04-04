import competitorData from "../../../../content/competitive-analysis/chess-products.json";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type CompetitiveEntry = {
  id: string;
  name: string;
  category: string;
  url: string;
  source_urls: string[];
  screenshot: string;
  positioning: string;
  surface_notes: string[];
  opportunities_for_narrative_chess: string[];
};

const competitors = competitorData as CompetitiveEntry[];

export function CompetitiveLandscapePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Competitive Analysis</Badge>
            <Badge variant="outline">Researched April 4, 2026</Badge>
          </div>
          <CardTitle className="text-3xl tracking-tight">
            Chess product references worth studying
          </CardTitle>
          <CardDescription className="max-w-3xl text-sm leading-6">
            This page captures live product references and a few practical takeaways for
            Narrative Chess. The notes are intentionally surface-level: they focus on how
            each product frames analysis, learning, and ongoing use rather than trying to
            reproduce every feature.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {competitors.map((competitor) => (
          <Card key={competitor.id} className="overflow-hidden">
            <div className="aspect-[16/9] overflow-hidden border-b bg-muted">
              <img
                src={competitor.screenshot}
                alt={`${competitor.name} reference screenshot`}
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            </div>

            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{competitor.category}</Badge>
                <a
                  href={competitor.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
                >
                  Visit site
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
              <div className="space-y-2">
                <CardTitle>{competitor.name}</CardTitle>
                <CardDescription className="text-sm leading-6">
                  {competitor.positioning}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">Surface notes</p>
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  {competitor.surface_notes.map((note) => (
                    <li key={note} className="list-none rounded-md border bg-muted/40 px-3 py-2">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              <Separator />

              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">
                  What to borrow or pressure-test
                </p>
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  {competitor.opportunities_for_narrative_chess.map((note) => (
                    <li key={note} className="list-none rounded-md border bg-muted/40 px-3 py-2">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-2 border-t bg-muted/20">
              {competitor.source_urls.map((sourceUrl) => (
                <a
                  key={sourceUrl}
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Source
                </a>
              ))}
            </CardFooter>
          </Card>
        ))}
      </div>
    </main>
  );
}
