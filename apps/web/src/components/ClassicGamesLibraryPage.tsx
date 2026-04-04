import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createReplayFromPgn, getBoardSquares } from "@narrative-chess/game-core";
import type {
  DistrictCell,
  MoveRecord,
  ReferenceGame,
  Square
} from "@narrative-chess/content-schema";
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
import { Separator } from "@/components/ui/separator";
import { Board } from "./Board";
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
  whitePlyIndex: number;
  blackPlyIndex: number | null;
};

const emptyDistrictsBySquare = new Map<Square, DistrictCell>();

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
    ...game.teachingFocus,
    ...game.detailLinks.map((link) => link.label)
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
      black: blackMove?.san ?? null,
      whitePlyIndex: index + 1,
      blackPlyIndex: blackMove ? index + 2 : null
    });
  }

  return movePairs;
}

function buildReferenceLinks(game: ReferenceGame) {
  const links = [
    ...(game.sourceUrl ? [{ label: "Match details", url: game.sourceUrl }] : []),
    ...game.detailLinks
  ];
  const seenUrls = new Set<string>();

  return links.filter((link) => {
    if (seenUrls.has(link.url)) {
      return false;
    }

    seenUrls.add(link.url);
    return true;
  });
}

export function ClassicGamesLibraryPage({
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame
}: ClassicGamesLibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [pinnedPlyIndex, setPinnedPlyIndex] = useState(0);
  const [hoveredPlyIndex, setHoveredPlyIndex] = useState<number | null>(null);
  const filteredGames = useMemo(
    () => referenceGames.filter((game) => gameMatchesQuery(game, searchQuery)),
    [referenceGames, searchQuery]
  );
  const selectedGame =
    referenceGames.find((game) => game.id === selectedReferenceGameId) ??
    filteredGames[0] ??
    referenceGames[0] ??
    null;

  const selectedGameReplay = useMemo(() => {
    if (!selectedGame) {
      return null;
    }

    try {
      return createReplayFromPgn(selectedGame.pgn);
    } catch {
      return null;
    }
  }, [selectedGame]);

  const selectedGameMovePairs = useMemo(() => {
    if (!selectedGameReplay) {
      return [];
    }

    const finalSnapshot = selectedGameReplay.snapshots.at(-1);
    return buildMovePairs(finalSnapshot?.moveHistory ?? []);
  }, [selectedGameReplay]);

  const totalPlyCount = selectedGameReplay ? Math.max(0, selectedGameReplay.snapshots.length - 1) : 0;
  const activePlyIndex = hoveredPlyIndex ?? pinnedPlyIndex;
  const activeSnapshot =
    selectedGameReplay?.snapshots[activePlyIndex] ??
    selectedGameReplay?.snapshots[0] ??
    null;
  const activeMove =
    activePlyIndex > 0 && activeSnapshot
      ? activeSnapshot.moveHistory[activePlyIndex - 1] ?? null
      : null;
  const activeBoardSquares = useMemo(
    () => (activeSnapshot ? getBoardSquares(activeSnapshot) : []),
    [activeSnapshot]
  );
  const selectedGameLinks = useMemo(
    () => (selectedGame ? buildReferenceLinks(selectedGame) : []),
    [selectedGame]
  );

  useEffect(() => {
    setPinnedPlyIndex(totalPlyCount);
    setHoveredPlyIndex(null);
  }, [selectedGame?.id, totalPlyCount]);

  return (
    <IndexedWorkspace
      className="classic-games-workspace"
      scrollMode="page"
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
                  Review a growing set of classic and modern reference games, scan what made each
                  one historically significant, and hover the game score to preview the board
                  state move by move before loading any line onto the study board.
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
        <Card className="page-card page-card--index classic-games-page__index">
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
            <div className="classic-games-page__list rounded-lg border p-3">
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
          </CardContent>
        </Card>
      }
      detail={
        <Card className="page-card page-card--detail classic-games-page__detail">
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
          <CardContent className="page-card__content grid gap-5">
            {selectedGame ? (
              <>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium">Why it matters</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedGame.historicalSignificance}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium">What it teaches</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {selectedGame.summary}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedGame.teachingFocus.map((focus) => (
                          <Badge key={focus} variant="outline">
                            {focus}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {selectedGameLinks.length ? (
                    <div className="classic-games-page__links">
                      {selectedGameLinks.map((link) => (
                        <Button key={link.url} asChild variant="outline" size="sm">
                          <a href={link.url} target="_blank" rel="noreferrer">
                            {link.label}
                            <ExternalLink data-icon="inline-end" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  ) : null}
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
                        <dt className="font-medium">Game score</dt>
                        <dd className="text-muted-foreground">
                          PGN movetext rendered as paired white and black moves.
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

                <div className="classic-games-page__analysis-grid">
                  <div className="classic-games-page__preview">
                    <div className="classic-games-page__preview-header">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">Board preview</p>
                        <p className="text-sm text-muted-foreground">
                          {activeMove
                            ? `Showing the position after ${activeMove.moveNumber}. ${activeMove.san}`
                            : "Showing the starting position before move 1."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">
                          {activePlyIndex === 0 ? "Start" : `Ply ${activePlyIndex}`}
                        </Badge>
                        <Badge variant="secondary">
                          {activeSnapshot
                            ? activeSnapshot.status.turn === "white"
                              ? "White to move"
                              : "Black to move"
                            : "Preview unavailable"}
                        </Badge>
                      </div>
                    </div>

                    {activeSnapshot ? (
                      <div className="classic-games-page__preview-board">
                        <Board
                          snapshot={activeSnapshot}
                          cells={activeBoardSquares}
                          selectedSquare={activeMove?.to ?? null}
                          hoveredSquare={null}
                          legalMoves={[]}
                          viewMode="board"
                          districtsBySquare={emptyDistrictsBySquare}
                          showCoordinates={true}
                          showDistrictLabels={false}
                          onSquareClick={() => {}}
                          onSquareHover={() => {}}
                          onSquareLeave={() => {}}
                        />
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        This game preview could not be rendered from the stored PGN.
                      </div>
                    )}

                    <div className="classic-games-page__preview-footer">
                      <Button
                        type="button"
                        variant={pinnedPlyIndex === 0 ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPinnedPlyIndex(0)}
                        disabled={!selectedGameReplay}
                      >
                        Start position
                      </Button>
                      <Button
                        type="button"
                        variant={pinnedPlyIndex === totalPlyCount ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setPinnedPlyIndex(totalPlyCount)}
                        disabled={!selectedGameReplay}
                      >
                        Final position
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="grid gap-1">
                        <p className="text-sm font-medium">Game score</p>
                        <p className="text-sm text-muted-foreground">
                          Hover or focus a move to update the preview board.
                        </p>
                      </div>
                      <Badge variant="outline">{selectedGameMovePairs.length} full moves</Badge>
                    </div>
                    <div
                      className="classic-games-page__score-list rounded-lg border p-3"
                      onMouseLeave={() => setHoveredPlyIndex(null)}
                    >
                      {selectedGameMovePairs.map((movePair) => (
                        <article
                          key={`${selectedGame.id}-${movePair.moveNumber}`}
                          className="classic-games-page__score-row"
                        >
                          <span className="font-medium text-muted-foreground">
                            {movePair.moveNumber}.
                          </span>
                          <button
                            type="button"
                            className={[
                              "classic-games-page__move-button",
                              activePlyIndex === movePair.whitePlyIndex
                                ? "classic-games-page__move-button--active"
                                : ""
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            onMouseEnter={() => setHoveredPlyIndex(movePair.whitePlyIndex)}
                            onFocus={() => setHoveredPlyIndex(movePair.whitePlyIndex)}
                            onBlur={() => setHoveredPlyIndex(null)}
                            onClick={() => setPinnedPlyIndex(movePair.whitePlyIndex)}
                          >
                            <span className="classic-games-page__move-side">White</span>
                            <span>{movePair.white}</span>
                          </button>
                          {movePair.blackPlyIndex ? (
                            <button
                              type="button"
                              className={[
                                "classic-games-page__move-button",
                                activePlyIndex === movePair.blackPlyIndex
                                  ? "classic-games-page__move-button--active"
                                  : ""
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              onMouseEnter={() => setHoveredPlyIndex(movePair.blackPlyIndex)}
                              onFocus={() => setHoveredPlyIndex(movePair.blackPlyIndex)}
                              onBlur={() => setHoveredPlyIndex(null)}
                              onClick={() => {
                                if (movePair.blackPlyIndex) {
                                  setPinnedPlyIndex(movePair.blackPlyIndex);
                                }
                              }}
                            >
                              <span className="classic-games-page__move-side">Black</span>
                              <span>{movePair.black}</span>
                            </button>
                          ) : (
                            <span className="classic-games-page__move-button classic-games-page__move-button--empty">
                              ...
                            </span>
                          )}
                        </article>
                      ))}
                    </div>
                  </div>
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
