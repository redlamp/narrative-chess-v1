import { useMemo, useState } from "react";
import { createReplayFromPgn } from "@narrative-chess/game-core";
import type { MoveRecord, ReferenceGame } from "@narrative-chess/content-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { IndexedWorkspace } from "./IndexedWorkspace";

type ClassicGamesLibraryPageProps = {
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: () => void;
};

type MovePair = {
  moveNumber: number;
  white: string;
  black: string | null;
};

function gameMatchesQuery(game: ReferenceGame, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    game.title,
    game.white,
    game.black,
    game.opening,
    game.summary,
    game.historicalSignificance,
    ...game.teachingFocus
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function buildMovePairs(moves: MoveRecord[]): MovePair[] {
  const movePairs: MovePair[] = [];

  for (let index = 0; index < moves.length; index += 2) {
    const whiteMove = moves[index];
    const blackMove = moves[index + 1] ?? null;

    if (!whiteMove) {
      continue;
    }

    movePairs.push({
      moveNumber: Math.floor(index / 2) + 1,
      white: whiteMove.san,
      black: blackMove?.san ?? null
    });
  }

  return movePairs;
}

export function ClassicGamesLibraryPage({
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame
}: ClassicGamesLibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const filteredGames = useMemo(
    () => referenceGames.filter((game) => gameMatchesQuery(game, searchQuery)),
    [referenceGames, searchQuery]
  );
  const selectedGame =
    referenceGames.find((game) => game.id === selectedReferenceGameId) ??
    filteredGames[0] ??
    referenceGames[0] ??
    null;
  const selectedGameMovePairs = useMemo(() => {
    if (!selectedGame) {
      return [];
    }

    try {
      const replay = createReplayFromPgn(selectedGame.pgn);
      const finalSnapshot = replay.snapshots.at(-1);
      return buildMovePairs(finalSnapshot?.moveHistory ?? []);
    } catch {
      return [];
    }
  }, [selectedGame]);

  return (
    <IndexedWorkspace
      intro={
        <Card className="page-card page-card--intro">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Classic Games</Badge>
              <Badge variant="outline">{referenceGames.length} seeded studies</Badge>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid gap-2">
                <CardTitle className="text-3xl tracking-tight">Historic reference game library</CardTitle>
                <CardDescription className="max-w-4xl text-sm leading-6">
                  Review a growing set of classic games, scan what made each one historically
                  significant, and load any line onto the study board for step-through analysis.
                  The move history in chess is commonly called the game score or PGN movetext.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={onLoadReferenceGame}
                disabled={!selectedGame}
              >
                Load on study board
              </Button>
            </div>
          </CardHeader>
        </Card>
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Game list</CardTitle>
              <CardDescription>
                Search by player, opening, title, or teaching focus.
              </CardDescription>
            </div>
            <Input
              name="classic-game-search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search classic games"
              aria-label="Search classic chess games"
            />
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <ScrollArea className="page-card__scroll-area rounded-lg border">
              <div className="grid gap-2 p-3">
                {filteredGames.map((game) => (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => onSelectReferenceGame(game.id)}
                    className={[
                      "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      game.id === selectedGame?.id
                        ? "border-foreground/15 bg-muted"
                        : "bg-background hover:bg-muted/50"
                    ].join(" ")}
                    aria-pressed={game.id === selectedGame?.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{game.title}</span>
                      <Badge variant="outline">{game.year}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {game.white} vs {game.black}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{game.opening}</Badge>
                      <Badge variant="outline">{game.result}</Badge>
                    </div>
                  </button>
                ))}
                {!filteredGames.length ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No classic games matched that search.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      }
      detail={
        <Card className="page-card page-card--detail">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{selectedGame?.title ?? "Classic game detail"}</CardTitle>
              {selectedGame ? <Badge variant="outline">{selectedGame.year}</Badge> : null}
              {selectedGame ? <Badge variant="secondary">{selectedGame.result}</Badge> : null}
            </div>
            <CardDescription>
              {selectedGame
                ? `${selectedGame.white} vs ${selectedGame.black} | ${selectedGame.event}`
                : "Select a classic game from the left to review its score and notes."}
            </CardDescription>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll grid gap-4">
            {selectedGame ? (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Why it matters</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedGame.historicalSignificance}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">What it teaches</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{selectedGame.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedGame.teachingFocus.map((focus) => (
                        <Badge key={focus} variant="outline">
                          {focus}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <dl className="grid gap-3 text-sm">
                      <div className="grid gap-1">
                        <dt className="font-medium">Site</dt>
                        <dd className="text-muted-foreground">{selectedGame.site}</dd>
                      </div>
                      <div className="grid gap-1">
                        <dt className="font-medium">Opening</dt>
                        <dd className="text-muted-foreground">{selectedGame.opening}</dd>
                      </div>
                      <div className="grid gap-1">
                        <dt className="font-medium">Source</dt>
                        <dd className="text-muted-foreground">
                          {selectedGame.sourceUrl ? (
                            <a href={selectedGame.sourceUrl} target="_blank" rel="noreferrer">
                              Historical reference
                            </a>
                          ) : (
                            "No source URL"
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Review note</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedGame.reviewNotes ?? "No review note recorded yet."}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">Game score</p>
                      <p className="text-sm text-muted-foreground">
                        PGN movetext rendered as paired white and black moves.
                      </p>
                    </div>
                    <Badge variant="outline">{selectedGameMovePairs.length} full moves</Badge>
                  </div>
                  <ScrollArea className="h-[360px] rounded-lg border">
                    <div className="grid gap-2 p-3">
                      {selectedGameMovePairs.map((movePair) => (
                        <article
                          key={`${selectedGame.id}-${movePair.moveNumber}`}
                          className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-3 rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="font-medium text-muted-foreground">{movePair.moveNumber}.</span>
                          <span>{movePair.white}</span>
                          <span className="text-muted-foreground">{movePair.black ?? "..."}</span>
                        </article>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Select a classic game from the left to review it in detail.
              </div>
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
