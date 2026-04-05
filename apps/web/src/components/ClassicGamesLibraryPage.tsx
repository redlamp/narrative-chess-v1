import { useEffect, useId, useMemo, useState } from "react";
import { Copy, ExternalLink, FolderOpen, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { createReplayFromPgn, getBoardSquares } from "@narrative-chess/game-core";
import type {
  DistrictCell,
  MoveRecord,
  ReferenceGame,
  ReferenceLink,
  Square
} from "@narrative-chess/content-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Board } from "./Board";
import { ClearableSearchField } from "./ClearableSearchField";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";
import { WorkspaceListItem } from "./WorkspaceListItem";
import { WorkspaceNoticeCard } from "./WorkspaceNoticeCard";
import {
  connectClassicGamesDirectory,
  getConnectedClassicGamesDirectoryName,
  loadClassicGamesFromDirectory,
  saveClassicGamesDraftToDirectory,
  supportsLocalContentDirectory
} from "../fileSystemAccess";
import {
  buildReferenceGameLibraryValidation,
  createReferenceGameFromSource,
  createReferenceGameTemplate,
  getDefaultReferenceGames,
  listReferenceGames,
  normalizeReferenceGameLibrary,
  saveReferenceGames
} from "../referenceGames";

type ClassicGamesLibraryPageProps = {
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  layoutMode: boolean;
  showLayoutGrid: boolean;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: (game: ReferenceGame) => void;
  onReferenceGamesChange: (games: ReferenceGame[]) => void;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

type MovePair = {
  moveNumber: number;
  white: string;
  black: string | null;
  whitePlyIndex: number;
  blackPlyIndex: number | null;
};

type FileNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

const emptyDistrictsBySquare = new Map<Square, DistrictCell>();

function gameMatchesQuery(game: ReferenceGame, query: string) {
  if (!query) return true;
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
    if (!whiteMove) continue;
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
    if (seenUrls.has(link.url)) return false;
    seenUrls.add(link.url);
    return true;
  });
}

function formatLinkList(links: ReferenceLink[]) {
  return links.map((link) => `${link.label} | ${link.url}`).join("\n");
}

function parseLinkList(value: string) {
  return value
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|").map((part) => part.trim());
      const urlCandidate = rest.join(" | ").trim();
      if (!label || !urlCandidate) return null;
      try {
        return { label, url: new URL(urlCandidate).toString() };
      } catch {
        return null;
      }
    })
    .filter((link): link is ReferenceLink => link !== null)
    .slice(0, 8);
}

function normalizeSourceUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function cloneGame(game: ReferenceGame): ReferenceGame {
  return {
    ...game,
    teachingFocus: game.teachingFocus.slice(),
    detailLinks: game.detailLinks.map((link) => ({ ...link }))
  };
}

function createEditableGames(seedGames: ReferenceGame[]) {
  const normalized = normalizeReferenceGameLibrary(seedGames);
  return normalized.length > 0 ? normalized.map(cloneGame) : getDefaultReferenceGames();
}

export function ClassicGamesLibraryPage({
  referenceGames,
  selectedReferenceGameId,
  layoutMode,
  showLayoutGrid,
  onSelectReferenceGame,
  onLoadReferenceGame,
  onReferenceGamesChange,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: ClassicGamesLibraryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [games, setGames] = useState<ReferenceGame[]>(() => createEditableGames(listReferenceGames()));
  const [selectedGameId, setSelectedGameId] = useState(
    selectedReferenceGameId || referenceGames[0]?.id || ""
  );
  const [pinnedPlyIndex, setPinnedPlyIndex] = useState(0);
  const [hoveredPlyIndex, setHoveredPlyIndex] = useState<number | null>(null);
  const [isDirectorySupported, setIsDirectorySupported] = useState(false);
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [fileNotice, setFileNotice] = useState<FileNotice | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const previewStatusId = useId();

  const filteredGames = useMemo(
    () => games.filter((game) => gameMatchesQuery(game, searchQuery)),
    [games, searchQuery]
  );
  const selectedGame =
    games.find((game) => game.id === selectedGameId) ?? filteredGames[0] ?? games[0] ?? null;

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
  const selectedGameLinkValue = selectedGame ? formatLinkList(selectedGame.detailLinks) : "";
  const validation = useMemo(() => buildReferenceGameLibraryValidation(games), [games]);

  useEffect(() => {
    setIsDirectorySupported(supportsLocalContentDirectory());
    getConnectedClassicGamesDirectoryName()
      .then(setDirectoryName)
      .catch(() => setDirectoryName(null));
  }, []);

  useEffect(() => {
    const nextGames = saveReferenceGames(games);
    onReferenceGamesChange(nextGames);
  }, [games, onReferenceGamesChange]);

  useEffect(() => {
    if (referenceGames.length > 0 && games.length === 0) {
      setGames(createEditableGames(referenceGames));
    }
  }, [games.length, referenceGames]);

  useEffect(() => {
    if (selectedReferenceGameId && selectedReferenceGameId !== selectedGameId) {
      const exists = games.some((game) => game.id === selectedReferenceGameId);
      if (exists) {
        setSelectedGameId(selectedReferenceGameId);
      }
    }
  }, [games, selectedGameId, selectedReferenceGameId]);

  useEffect(() => {
    if (selectedGameId && games.some((game) => game.id === selectedGameId)) {
      onSelectReferenceGame(selectedGameId);
      return;
    }

    const nextSelectedId = games[0]?.id ?? "";
    if (nextSelectedId && nextSelectedId !== selectedGameId) {
      setSelectedGameId(nextSelectedId);
      onSelectReferenceGame(nextSelectedId);
    }
  }, [games, onSelectReferenceGame, selectedGameId]);

  useEffect(() => {
    setPinnedPlyIndex(totalPlyCount);
    setHoveredPlyIndex(null);
  }, [selectedGame?.id, totalPlyCount]);

  function selectGame(gameId: string) {
    setSelectedGameId(gameId);
    onSelectReferenceGame(gameId);
  }

  function updateSelectedGame(updater: (game: ReferenceGame) => ReferenceGame) {
    if (!selectedGame) {
      return;
    }

    setGames((current) => current.map((game) => (game.id === selectedGame.id ? updater(game) : game)));
  }

  function updateSelectedGameField<K extends keyof ReferenceGame>(field: K, value: ReferenceGame[K]) {
    updateSelectedGame((game) => ({
      ...game,
      [field]: value
    }));
  }

  function updateSelectedGameTextList(field: "teachingFocus", value: string) {
    const nextValues = value
      .split(/\r?\n|,/g)
      .map((entry) => entry.trim())
      .filter(Boolean);

    updateSelectedGame((game) => ({
      ...game,
      [field]: nextValues
    }));
  }

  function updateSelectedGameLinks(value: string) {
    updateSelectedGame((game) => ({
      ...game,
      detailLinks: parseLinkList(value)
    }));
  }

  async function handleConnectFolder() {
    setBusyAction("connect-folder");
    setFileNotice(null);

    try {
      const connected = await connectClassicGamesDirectory();
      setDirectoryName(connected.directoryName);
      setFileNotice({
        tone: "success",
        text: `Connected to ${connected.directoryName}.`
      });
    } catch (error) {
      setFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not connect a folder for classic games."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSaveToFolder() {
    setBusyAction("save-folder");
    setFileNotice(null);

    try {
      const result = await saveClassicGamesDraftToDirectory(games);
      setDirectoryName(result.directoryName);
      setFileNotice({
        tone: "success",
        text: `Saved classic games to ${result.relativePath}.`
      });
    } catch (error) {
      setFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not save classic games to disk."
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLoadFromFolder() {
    setBusyAction("load-folder");
    setFileNotice(null);

    try {
      const loaded = await loadClassicGamesFromDirectory();
      if (!loaded) {
        setFileNotice({
          tone: "neutral",
          text: "No saved classic-games.local.json file was found in the connected folder."
        });
        return;
      }

      setGames(loaded.games.map(cloneGame));
      const nextSelectedId = loaded.games.find((game) => game.id === selectedGameId)?.id ?? loaded.games[0]?.id ?? "";
      setSelectedGameId(nextSelectedId);
      if (nextSelectedId) {
        onSelectReferenceGame(nextSelectedId);
      }
      setFileNotice({
        tone: "success",
        text: `Loaded classic games from ${loaded.relativePath}.`
      });
    } catch (error) {
      setFileNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not load classic games from disk."
      });
    } finally {
      setBusyAction(null);
    }
  }

  function handleResetLibrary() {
    const nextGames = getDefaultReferenceGames();
    const nextSelectedId = nextGames[0]?.id ?? "";
    setGames(nextGames);
    setSelectedGameId(nextSelectedId);
    if (nextSelectedId) {
      onSelectReferenceGame(nextSelectedId);
    }
    setFileNotice({
      tone: "neutral",
      text: "Reset the classic games library to the checked-in defaults."
    });
  }

  function handleAddGame() {
    const nextGame = createReferenceGameTemplate(games.length);
    setGames((current) => [...current, nextGame]);
    setSelectedGameId(nextGame.id);
    onSelectReferenceGame(nextGame.id);
    setFileNotice({
      tone: "neutral",
      text: "Added a new editable classic game template."
    });
  }

  function handleDuplicateGame() {
    if (!selectedGame) {
      return;
    }

    const nextGame = createReferenceGameFromSource(selectedGame, games.length);
    setGames((current) => [...current, nextGame]);
    setSelectedGameId(nextGame.id);
    onSelectReferenceGame(nextGame.id);
    setFileNotice({
      tone: "neutral",
      text: `Duplicated ${selectedGame.title}.`
    });
  }

  function handleDeleteGame() {
    if (!selectedGame) {
      return;
    }

    const nextGames = games.filter((game) => game.id !== selectedGame.id);
    const nextSelectedId = nextGames[0]?.id ?? "";
    setGames(nextGames);
    setSelectedGameId(nextSelectedId);
    if (nextSelectedId) {
      onSelectReferenceGame(nextSelectedId);
    }
    setFileNotice({
      tone: "neutral",
      text: `Deleted ${selectedGame.title}.`
    });
  }

  return (
    <IndexedWorkspace
      className="classic-games-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="classics-page"
      layoutVariant="two-pane"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          badgeRow={
            <>
              <Badge variant="secondary">Classic Games</Badge>
              <Badge variant="outline">{games.length} editable games</Badge>
              <Badge variant="outline">Browser saved</Badge>
              <Badge variant="outline">
                {directoryName ? `Folder: ${directoryName}` : "Folder not connected"}
              </Badge>
            </>
          }
          title="Historic reference game library"
          description="Review, edit, and extend a growing set of classic and modern reference games. The browser copy saves automatically, and you can connect a repo folder when you want a named file on disk."
          actions={
            <>
              <Button type="button" variant="outline" onClick={handleAddGame}>
                <Plus className="mr-2 h-4 w-4" />
                Add game
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDuplicateGame}
                disabled={!selectedGame}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
              <Button type="button" variant="outline" onClick={handleResetLibrary}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset defaults
              </Button>
            </>
          }
          status={fileNotice}
        >
          <div className="grid gap-4 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <p>
                {directoryName
                  ? `Connected to ${directoryName}. Use the folder buttons to load or save a repo-local classic-games.local.json file.`
                  : "Connect a repo folder when you want a named file on disk instead of browser-only storage."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConnectFolder}
                  disabled={!isDirectorySupported || busyAction === "connect-folder"}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Connect folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadFromFolder}
                  disabled={!isDirectorySupported || busyAction === "load-folder"}
                >
                  Load from folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveToFolder}
                  disabled={!isDirectorySupported || busyAction === "save-folder"}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save to folder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (selectedGame) {
                      onLoadReferenceGame(selectedGame);
                    }
                  }}
                  disabled={!selectedGame}
                >
                  Load on study board
                </Button>
              </div>
            </div>
            {!validation.isValid ? (
              <WorkspaceNoticeCard tone="error" title="Library validation">
                <p>{validation.issues[0]}</p>
                {validation.issues.length > 1 ? (
                  <p className="text-sm text-muted-foreground">
                    {validation.issues.length - 1} more issue
                    {validation.issues.length - 1 === 1 ? "" : "s"} need attention.
                  </p>
                ) : null}
              </WorkspaceNoticeCard>
            ) : null}
          </div>
        </WorkspaceIntroCard>
      }
      index={
        <Card className="page-card page-card--index classic-games-page__index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Games</CardTitle>
              <CardDescription>Search by player, opening, title, or teaching focus.</CardDescription>
            </div>
            <ClearableSearchField
              label="Search games"
              name="classic-game-search"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search classic games"
              ariaLabel="Search classic chess games"
            />
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <div className="grid gap-2">
              {filteredGames.map((game) => (
                <WorkspaceListItem
                  key={game.id}
                  type="button"
                  onClick={() => selectGame(game.id)}
                  selected={game.id === selectedGame?.id}
                  title={game.title}
                  description={`${game.white} vs ${game.black}`}
                  leading={<span className="text-base font-semibold">{game.year}</span>}
                  meta={
                    <>
                      <Badge variant="secondary">{game.opening}</Badge>
                      <Badge variant="outline">{game.result}</Badge>
                    </>
                  }
                />
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
              {selectedGame ? <Badge variant="outline">{selectedGame.reviewStatus}</Badge> : null}
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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleDuplicateGame}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button type="button" variant="outline" onClick={handleDeleteGame}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Title</span>
                      <Input
                        value={selectedGame.title}
                        onChange={(event) => updateSelectedGameField("title", event.currentTarget.value)}
                      />
                    </label>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">White</span>
                        <Input
                          value={selectedGame.white}
                          onChange={(event) => updateSelectedGameField("white", event.currentTarget.value)}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Black</span>
                        <Input
                          value={selectedGame.black}
                          onChange={(event) => updateSelectedGameField("black", event.currentTarget.value)}
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Event</span>
                        <Input
                          value={selectedGame.event}
                          onChange={(event) => updateSelectedGameField("event", event.currentTarget.value)}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Site</span>
                        <Input
                          value={selectedGame.site}
                          onChange={(event) => updateSelectedGameField("site", event.currentTarget.value)}
                        />
                      </label>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Year</span>
                        <Input
                          type="number"
                          value={selectedGame.year}
                          onChange={(event) =>
                            updateSelectedGameField(
                              "year",
                              Number.parseInt(event.currentTarget.value, 10) || selectedGame.year
                            )
                          }
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Opening</span>
                        <Input
                          value={selectedGame.opening}
                          onChange={(event) => updateSelectedGameField("opening", event.currentTarget.value)}
                        />
                      </label>
                    </div>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Result</span>
                      <Input
                        value={selectedGame.result}
                        onChange={(event) => updateSelectedGameField("result", event.currentTarget.value)}
                      />
                    </label>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium">Why it matters</p>
                      <Textarea
                        className="mt-2 min-h-36"
                        value={selectedGame.historicalSignificance}
                        onChange={(event) =>
                          updateSelectedGameField("historicalSignificance", event.currentTarget.value)
                        }
                      />
                    </div>
                    <div className="rounded-lg border bg-muted/20 p-4">
                      <p className="text-sm font-medium">What it teaches</p>
                      <Textarea
                        className="mt-2 min-h-36"
                        value={selectedGame.summary}
                        onChange={(event) => updateSelectedGameField("summary", event.currentTarget.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Teaching focus</span>
                    <Textarea
                      value={selectedGame.teachingFocus.join("\n")}
                      onChange={(event) => updateSelectedGameTextList("teachingFocus", event.currentTarget.value)}
                      placeholder="One focus per line"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Reference links</span>
                    <Textarea
                      value={selectedGameLinkValue}
                      onChange={(event) => updateSelectedGameLinks(event.currentTarget.value)}
                      placeholder="Label | https://example.com"
                    />
                  </label>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Source URL</span>
                    <Input
                      value={selectedGame.sourceUrl ?? ""}
                      onChange={(event) =>
                        updateSelectedGameField("sourceUrl", normalizeSourceUrl(event.currentTarget.value))
                      }
                      placeholder="https://..."
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Review note</span>
                    <Input
                      value={selectedGame.reviewNotes ?? ""}
                      onChange={(event) =>
                        updateSelectedGameField("reviewNotes", event.currentTarget.value.trim() || null)
                      }
                      placeholder="Optional note"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">PGN</span>
                  <Textarea
                    className="min-h-60 font-mono text-sm"
                    value={selectedGame.pgn}
                    onChange={(event) => updateSelectedGameField("pgn", event.currentTarget.value)}
                  />
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Browser-local metadata</p>
                    <dl className="mt-3 grid gap-3 text-sm">
                      <div className="grid gap-1">
                        <dt className="font-medium">Generation source</dt>
                        <dd className="text-muted-foreground">{selectedGame.generationSource}</dd>
                      </div>
                      <div className="grid gap-1">
                        <dt className="font-medium">Status</dt>
                        <dd className="text-muted-foreground">
                          {selectedGame.contentStatus} / {selectedGame.reviewStatus}
                        </dd>
                      </div>
                      <div className="grid gap-1">
                        <dt className="font-medium">Last reviewed</dt>
                        <dd className="text-muted-foreground">
                          {selectedGame.lastReviewedAt ?? "Not yet reviewed"}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">References</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedGameLinks.length ? (
                        selectedGameLinks.map((link) => (
                          <Button key={link.url} asChild variant="outline" size="sm">
                            <a href={link.url} target="_blank" rel="noreferrer">
                              {link.label}
                              <ExternalLink data-icon="inline-end" />
                            </a>
                          </Button>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No references recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]">
                  <div className="grid gap-4">
                    <div className="grid gap-1">
                      <p className="text-sm font-medium">Board preview</p>
                      <p
                        className="text-sm text-muted-foreground"
                        id={previewStatusId}
                        role="status"
                        aria-live="polite"
                      >
                        {activeMove
                          ? `Showing the position after ${activeMove.moveNumber}. ${activeMove.san}`
                          : "Showing the starting position before move 1."}
                      </p>
                    </div>
                    {activeSnapshot ? (
                      <Board
                        snapshot={activeSnapshot}
                        cells={activeBoardSquares}
                        selectedSquare={activeMove?.to ?? null}
                        hoveredSquare={null}
                        inspectedSquare={activeMove?.to ?? null}
                        legalMoves={[]}
                        viewMode="board"
                        districtsBySquare={emptyDistrictsBySquare}
                        showCoordinates={true}
                        showDistrictLabels={false}
                        onSquareClick={() => {}}
                        onSquareHover={() => {}}
                        onSquareLeave={() => {}}
                      />
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        This game preview could not be rendered from the stored PGN.
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
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
                    <div onMouseLeave={() => setHoveredPlyIndex(null)} className="grid gap-2">
                      {selectedGameMovePairs.map((movePair) => (
                        <article
                          key={`${selectedGame.id}-${movePair.moveNumber}`}
                          className="grid grid-cols-[auto_1fr_1fr] items-stretch gap-2 rounded-lg border p-3"
                        >
                          <span className="font-medium text-muted-foreground">{movePair.moveNumber}.</span>
                          <button
                            type="button"
                            className={[
                              "rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              activePlyIndex === movePair.whitePlyIndex
                                ? "border-foreground/15 bg-muted"
                                : "bg-background hover:bg-muted/50"
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            aria-current={activePlyIndex === movePair.whitePlyIndex ? "step" : undefined}
                            aria-describedby={previewStatusId}
                            aria-label={`Move ${movePair.moveNumber}, White plays ${movePair.white}`}
                            onMouseEnter={() => setHoveredPlyIndex(movePair.whitePlyIndex)}
                            onFocus={() => setHoveredPlyIndex(movePair.whitePlyIndex)}
                            onBlur={() => setHoveredPlyIndex(null)}
                            onClick={() => setPinnedPlyIndex(movePair.whitePlyIndex)}
                          >
                            <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                              White
                            </span>
                            <span>{movePair.white}</span>
                          </button>
                          {movePair.blackPlyIndex ? (
                            <button
                              type="button"
                              className={[
                                "rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                activePlyIndex === movePair.blackPlyIndex
                                  ? "border-foreground/15 bg-muted"
                                  : "bg-background hover:bg-muted/50"
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              aria-current={activePlyIndex === movePair.blackPlyIndex ? "step" : undefined}
                              aria-describedby={previewStatusId}
                              aria-label={`Move ${movePair.moveNumber}, Black plays ${movePair.black}`}
                              onMouseEnter={() => setHoveredPlyIndex(movePair.blackPlyIndex)}
                              onFocus={() => setHoveredPlyIndex(movePair.blackPlyIndex)}
                              onBlur={() => setHoveredPlyIndex(null)}
                              onClick={() => {
                                if (movePair.blackPlyIndex) {
                                  setPinnedPlyIndex(movePair.blackPlyIndex);
                                }
                              }}
                            >
                              <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                                Black
                              </span>
                              <span>{movePair.black}</span>
                            </button>
                          ) : (
                            <span className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
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
