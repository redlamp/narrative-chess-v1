import { useEffect, useMemo, useState } from "react";
import type { CityBoard, DistrictCell } from "@narrative-chess/content-schema";
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
import { Textarea } from "@/components/ui/textarea";
import { cityBoardDefinitions, getCityBoardDefinition } from "../cityBoards";
import {
  buildCityBoardValidation,
  listCityBoardDraft,
  resetCityBoardDraft,
  saveCityBoardDraft
} from "../cityReviewState";
import {
  connectCityReviewDirectory,
  getConnectedCityReviewDirectoryName,
  loadCityDraftFromDirectory,
  saveCityDraftToDirectory,
  supportsLocalContentDirectory
} from "../fileSystemAccess";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";
import { WorkspaceListItem } from "./WorkspaceListItem";
import { WorkspaceNoticeCard } from "./WorkspaceNoticeCard";
import { ClearableSearchField } from "./ClearableSearchField";

type SaveNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type TrackedCity = {
  id: string;
  name: string;
  country: string;
  summary: string;
  districtCount: number;
  contentStatus: CityBoard["contentStatus"];
  reviewStatus: CityBoard["reviewStatus"];
};

const cityOverviewId = "city-overview";
const statusOptions = ["empty", "procedural", "authored"] as const;
const reviewOptions = ["empty", "needs review", "reviewed", "approved"] as const;
const districtSortOptions = [
  { value: "name", label: "Name" },
  { value: "square", label: "Square" },
  { value: "locality", label: "Locality" },
  { value: "review-status", label: "Review status" },
  { value: "recently-reviewed", label: "Recently reviewed" }
] as const;

type DistrictSortMode = (typeof districtSortOptions)[number]["value"];

const initialCityDefinition = cityBoardDefinitions[0] ?? null;
const initialCityId = initialCityDefinition?.id ?? "edinburgh";

function createInitialCityDraft() {
  const fallbackDefinition = initialCityDefinition ?? cityBoardDefinitions[0] ?? null;

  if (!fallbackDefinition) {
    throw new Error("At least one city board definition is required.");
  }

  return listCityBoardDraft(fallbackDefinition.id, fallbackDefinition.board);
}

function formatListValue(values: string[]) {
  return values.join("\n");
}

function parseListValue(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function downloadDraft(board: CityBoard) {
  const blob = new Blob([JSON.stringify(board, null, 2)], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${board.id}-board.local.json`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function countByLocality(board: CityBoard) {
  const localityCounts = new Map<string, number>();

  board.districts.forEach((district) => {
    localityCounts.set(district.locality, (localityCounts.get(district.locality) ?? 0) + 1);
  });

  return [...localityCounts.entries()].sort((left, right) => right[1] - left[1]);
}

function updateDistrict(
  board: CityBoard,
  districtId: string,
  updater: (district: DistrictCell) => DistrictCell
) {
  return {
    ...board,
    districts: board.districts.map((district) =>
      district.id === districtId ? updater(district) : district
    )
  };
}

function districtMatchesSearch(district: DistrictCell, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    district.square,
    district.name,
    district.locality,
    district.reviewStatus,
    ...district.descriptors,
    ...district.landmarks,
    ...district.toneCues
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function compareDistricts(left: DistrictCell, right: DistrictCell, sortMode: DistrictSortMode) {
  if (sortMode === "square") {
    return left.square.localeCompare(right.square);
  }

  if (sortMode === "locality") {
    const localityDelta = left.locality.localeCompare(right.locality);
    if (localityDelta !== 0) {
      return localityDelta;
    }
  }

  if (sortMode === "review-status") {
    const reviewOrder = new Map(reviewOptions.map((status, index) => [status, index] as const));
    const reviewDelta =
      (reviewOrder.get(left.reviewStatus) ?? 0) - (reviewOrder.get(right.reviewStatus) ?? 0);
    if (reviewDelta !== 0) {
      return reviewDelta;
    }
  }

  if (sortMode === "recently-reviewed") {
    const leftReviewed = left.lastReviewedAt ? Date.parse(left.lastReviewedAt) : Number.NEGATIVE_INFINITY;
    const rightReviewed = right.lastReviewedAt ? Date.parse(right.lastReviewedAt) : Number.NEGATIVE_INFINITY;
    if (leftReviewed !== rightReviewed) {
      return rightReviewed - leftReviewed;
    }
  }

  return left.name.localeCompare(right.name);
}

type EdinburghReviewPageProps = {
  layoutMode: boolean;
  showLayoutGrid: boolean;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

export function EdinburghReviewPage({
  layoutMode,
  showLayoutGrid,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: EdinburghReviewPageProps) {
  const [selectedCityId, setSelectedCityId] = useState(initialCityId);
  const [draft, setDraft] = useState<CityBoard>(() => createInitialCityDraft());
  const [selectedRecordId, setSelectedRecordId] = useState(cityOverviewId);
  const [searchQuery, setSearchQuery] = useState("");
  const [districtSortMode, setDistrictSortMode] = useState<DistrictSortMode>("name");
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [isDirectorySupported, setIsDirectorySupported] = useState(false);
  const selectedCityDefinition =
    getCityBoardDefinition(selectedCityId) ?? initialCityDefinition ?? cityBoardDefinitions[0] ?? null;
  const validation = useMemo(() => buildCityBoardValidation(draft), [draft]);
  const trackedCities = useMemo<TrackedCity[]>(
    () =>
      cityBoardDefinitions.map((definition) => {
        const board = definition.id === draft.id ? draft : listCityBoardDraft(definition.id, definition.board);

        return {
          id: board.id,
          name: board.name,
          country: board.country,
          summary: board.summary,
          districtCount: board.districts.length,
          contentStatus: board.contentStatus,
          reviewStatus: board.reviewStatus
        };
      }),
    [draft]
  );
  const selectedCity = trackedCities.find((city) => city.id === selectedCityId) ?? trackedCities[0] ?? null;

  useEffect(() => {
    setIsDirectorySupported(supportsLocalContentDirectory());

    let cancelled = false;

    void getConnectedCityReviewDirectoryName().then((name) => {
      if (!cancelled) {
        setDirectoryName(name);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (validation.isValid) {
      saveCityBoardDraft(draft);
    }
  }, [draft, validation.isValid]);

  useEffect(() => {
    if (!selectedCityDefinition) {
      return;
    }

    setDraft(listCityBoardDraft(selectedCityDefinition.id, selectedCityDefinition.board));
    setSelectedRecordId(cityOverviewId);
  }, [selectedCityDefinition]);

  useEffect(() => {
    if (
      selectedRecordId !== cityOverviewId &&
      !draft.districts.some((district) => district.id === selectedRecordId)
    ) {
      setSelectedRecordId(cityOverviewId);
    }
  }, [draft, selectedRecordId]);
  const filteredDistricts = useMemo(
    () =>
      [...draft.districts.filter((district) => districtMatchesSearch(district, searchQuery))].sort(
        (left, right) => compareDistricts(left, right, districtSortMode)
      ),
    [draft.districts, districtSortMode, searchQuery]
  );
  const selectedDistrict =
    selectedRecordId === cityOverviewId
      ? null
      : draft.districts.find((district) => district.id === selectedRecordId) ??
        filteredDistricts[0] ??
        draft.districts[0] ??
        null;
  const localityCounts = useMemo(() => countByLocality(draft), [draft]);
  const reviewedDistrictCount = draft.districts.filter(
    (district) => district.reviewStatus === "reviewed" || district.reviewStatus === "approved"
  ).length;
  const uniqueLandmarkCount = new Set(
    draft.districts.flatMap((district) => district.landmarks.map((landmark) => landmark.toLowerCase()))
  ).size;

  const setCityField = <Field extends keyof CityBoard>(field: Field, value: CityBoard[Field]) => {
    setDraft((current) => ({
      ...current,
      [field]: value
    }));
  };

  const updateSelectedDistrict = (updater: (district: DistrictCell) => DistrictCell) => {
    if (!selectedDistrict) {
      return;
    }

    setDraft((current) => updateDistrict(current, selectedDistrict.id, updater));
  };

  const runDirectoryAction = async (actionName: string, action: () => Promise<void>) => {
    setBusyAction(actionName);
    setSaveNotice(null);

    try {
      await action();
    } catch (error) {
      setSaveNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Something went wrong."
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <IndexedWorkspace
      className="cities-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="cities-page"
      layoutVariant="three-pane"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
        badgeRow={
          <>
            <Badge variant="secondary">Cities</Badge>
            <Badge variant="outline">{trackedCities.length} tracked cities</Badge>
            <Badge variant="outline">64 mapped districts</Badge>
            <Badge variant={validation.isValid ? "outline" : "destructive"}>
              {validation.isValid ? "Schema valid" : `${validation.issues.length} validation issues`}
            </Badge>
            {directoryName ? <Badge variant="outline">Connected: {directoryName}</Badge> : null}
          </>
        }
        title="City and district workspace"
        description="Review gathered city boards, move from city selection into district detail, and write a repo-local draft file when you want the changes available to future passes. The current workspace is seeded with Edinburgh and London and structured so more cities can slot into the same pattern over time."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                runDirectoryAction("connect-directory", async () => {
                  const result = await connectCityReviewDirectory();
                  setDirectoryName(result.directoryName);
                  setSaveNotice({
                    tone: "success",
                    text: `Connected to ${result.directoryName}.`
                  });
                })
              }
              disabled={!isDirectorySupported || busyAction !== null}
            >
              Connect folder
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runDirectoryAction("load-directory-draft", async () => {
                  const fallback = selectedCityDefinition?.board ?? createInitialCityDraft();
                  const result = await loadCityDraftFromDirectory(fallback);
                  if (!result) {
                    setSaveNotice({
                      tone: "neutral",
                      text: "No local city draft or canonical board file was found in the connected directory."
                    });
                    return;
                  }

                  setDraft(saveCityBoardDraft(result.board));
                  setSelectedCityId(result.board.id);
                  setSelectedRecordId(cityOverviewId);
                  setSaveNotice({
                    tone: "success",
                    text: `Loaded ${result.sourceKind} data from ${result.relativePath}.`
                  });
                })
              }
              disabled={busyAction !== null}
            >
              Load file
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                runDirectoryAction("save-directory-draft", async () => {
                  const result = await saveCityDraftToDirectory(draft);
                  setSaveNotice({
                    tone: "success",
                    text: `Saved the current draft to ${result.relativePath} inside ${result.directoryName}.`
                  });
                })
              }
              disabled={busyAction !== null}
            >
              Save draft file
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                downloadDraft(draft);
                setSaveNotice({
                  tone: "neutral",
                  text: `Downloaded ${draft.id}-board.local.json.`
                });
              }}
              disabled={busyAction !== null}
            >
              Download JSON
            </Button>
          </>
        }
        status={saveNotice}
      >
        <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Tracked cities
              </p>
              <p className="mt-2 text-2xl font-semibold">{trackedCities.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Reviewed
              </p>
              <p className="mt-2 text-2xl font-semibold">{reviewedDistrictCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Landmarks
              </p>
              <p className="mt-2 text-2xl font-semibold">{uniqueLandmarkCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Review status
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{draft.reviewStatus}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const fallback = selectedCityDefinition?.board ?? createInitialCityDraft();
                const nextDraft = resetCityBoardDraft(selectedCityId, fallback);
                setDraft(nextDraft);
                setSelectedCityId(nextDraft.id);
                setSelectedRecordId(cityOverviewId);
                setSaveNotice({
                  tone: "neutral",
                  text: `Reset the working draft back to the bundled ${nextDraft.name} board.`
                });
              }}
            >
              Reset current city draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(saveCityBoardDraft(draft));
                setSaveNotice({
                  tone: "success",
                  text: "Re-saved the current browser draft."
                });
              }}
            >
              Re-save browser draft
            </Button>
          </div>

          {!validation.isValid ? (
            <WorkspaceNoticeCard tone="error" title="Validation notes">
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {validation.issues.slice(0, 8).map((issue) => (
                  <li key={issue} className="rounded-md border bg-background px-3 py-2">
                    {issue}
                  </li>
                ))}
              </ul>
            </WorkspaceNoticeCard>
          ) : null}
        </div>
      </WorkspaceIntroCard>
      }
      index={
        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Cities</CardTitle>
              <CardDescription>
                Start with the city, then drill into districts and detail to the right.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <div className="cities-page__list">
              {trackedCities.map((city) => (
                <WorkspaceListItem
                  key={city.id}
                  type="button"
                  onClick={() => {
                    const nextCityDefinition = getCityBoardDefinition(city.id);
                    if (nextCityDefinition) {
                      setDraft(listCityBoardDraft(nextCityDefinition.id, nextCityDefinition.board));
                    }
                    setSelectedCityId(city.id);
                    setSelectedRecordId(cityOverviewId);
                  }}
                  selected={city.id === selectedCity?.id}
                  title={city.name}
                  meta={
                    <>
                      <Badge variant="outline">{city.districtCount} districts</Badge>
                      <Badge
                        variant={
                          city.contentStatus === "authored" ? "secondary" : "outline"
                        }
                      >
                        {city.contentStatus}
                      </Badge>
                      <Badge
                        variant={city.reviewStatus === "approved" || city.reviewStatus === "reviewed" ? "secondary" : "outline"}
                      >
                        {city.reviewStatus}
                      </Badge>
                    </>
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>
      }
      secondaryIndex={
        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Districts</CardTitle>
                {selectedCity ? <Badge variant="outline">{selectedCity.name}</Badge> : null}
              </div>
              <CardDescription>
                Select the city overview or drill into a district record like Edinburgh {">"} Broughton or London {">"} Camden Town.
              </CardDescription>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
              <ClearableSearchField
                label="Search districts"
                name="district-search"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by square, name, locality, or descriptor"
                ariaLabel="Search city districts"
              />
              <label className="grid gap-2">
                <span className="text-sm font-medium">Sort by</span>
                <select
                  name="district-sort"
                  className="field-select"
                  value={districtSortMode}
                  onChange={(event) => setDistrictSortMode(event.currentTarget.value as DistrictSortMode)}
                >
                  {districtSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {localityCounts.slice(0, 8).map(([locality, count]) => (
                <Badge key={locality} variant="outline">
                  {locality}: {count}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="page-card__content pt-0">
            <div className="cities-page__list rounded-lg border p-3">
              <WorkspaceListItem
                type="button"
                onClick={() => setSelectedRecordId(cityOverviewId)}
                selected={selectedRecordId === cityOverviewId}
                className="workspace-list-item--overview"
                leading={<Badge variant="secondary">Overview</Badge>}
                title={draft.name}
                meta={<Badge variant="secondary">City overview</Badge>}
              />
              {filteredDistricts.map((district) => (
                <WorkspaceListItem
                  key={district.id}
                  type="button"
                  onClick={() => setSelectedRecordId(district.id)}
                  selected={district.id === selectedDistrict?.id}
                  title={district.name}
                  description={district.locality}
                  meta={
                    <>
                      <Badge variant="outline">{district.square}</Badge>
                      <Badge variant="secondary">{district.reviewStatus}</Badge>
                    </>
                  }
                />
              ))}
              {!filteredDistricts.length ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No districts matched that search.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      }
      detail={
        <div className="page-card-stack">
          {selectedRecordId === cityOverviewId ? (
          <Card className="page-card page-card--detail">
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>City detail editor</CardTitle>
                {selectedCity ? <Badge variant="outline">{selectedCity.name}</Badge> : null}
              </div>
              <CardDescription>
                Edit the city-level summary, provenance, and source details that frame the active board mapping.
              </CardDescription>
            </CardHeader>
            <CardContent className="page-card__content grid gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium">City name</span>
                  <Input
                    name="city-name"
                    autoComplete="off"
                    value={draft.name}
                    onChange={(event) => setCityField("name", event.currentTarget.value)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Country / region</span>
                  <Input
                    name="city-country"
                    autoComplete="off"
                    value={draft.country}
                    onChange={(event) => setCityField("country", event.currentTarget.value)}
                  />
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-medium">Summary</span>
                  <Textarea
                    name="city-summary"
                    autoComplete="off"
                    value={draft.summary}
                    onChange={(event) => setCityField("summary", event.currentTarget.value)}
                    rows={4}
                  />
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-medium">Board orientation</span>
                  <Textarea
                    name="city-board-orientation"
                    autoComplete="off"
                    value={draft.boardOrientation}
                    onChange={(event) => setCityField("boardOrientation", event.currentTarget.value)}
                    rows={2}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Content status</span>
                  <select
                    name="city-content-status"
                    className="field-select"
                    value={draft.contentStatus}
                    onChange={(event) =>
                      setCityField("contentStatus", event.currentTarget.value as CityBoard["contentStatus"])
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Review status</span>
                  <select
                    name="city-review-status"
                    className="field-select"
                    value={draft.reviewStatus}
                    onChange={(event) =>
                      setCityField("reviewStatus", event.currentTarget.value as CityBoard["reviewStatus"])
                    }
                  >
                    {reviewOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Last reviewed</span>
                  <Input
                    name="city-last-reviewed-at"
                    autoComplete="off"
                    type="date"
                    value={draft.lastReviewedAt ?? ""}
                    onChange={(event) => setCityField("lastReviewedAt", event.currentTarget.value || null)}
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Generation source</span>
                  <Input
                    name="city-generation-source"
                    autoComplete="off"
                    value={draft.generationSource}
                    onChange={(event) => setCityField("generationSource", event.currentTarget.value)}
                  />
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-medium">Review notes</span>
                  <Textarea
                    name="city-review-notes"
                    autoComplete="off"
                    value={draft.reviewNotes ?? ""}
                    onChange={(event) => setCityField("reviewNotes", event.currentTarget.value || null)}
                    rows={3}
                  />
                </label>
                <label className="grid gap-2 lg:col-span-2">
                  <span className="text-sm font-medium">Source URLs</span>
                  <Textarea
                    name="city-source-urls"
                    autoComplete="off"
                    spellCheck={false}
                    value={formatListValue(draft.sourceUrls)}
                    onChange={(event) => setCityField("sourceUrls", parseListValue(event.currentTarget.value))}
                    rows={4}
                  />
                </label>
              </div>
            </CardContent>
          </Card>
          ) : null}

          {selectedDistrict ? (
          <div className="cities-workspace__detail-sticky">
          <Card className="page-card page-card--detail">
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>District detail editor</CardTitle>
                {selectedCity ? <Badge variant="outline">{selectedCity.name}</Badge> : null}
                {selectedDistrict ? <Badge variant="secondary">{selectedDistrict.name}</Badge> : null}
                {selectedDistrict ? <Badge variant="outline">{selectedDistrict.square}</Badge> : null}
              </div>
              <CardDescription>
                Edit the district record and keep the draft grounded in readable, reviewable city context.
              </CardDescription>
            </CardHeader>
            <CardContent className="page-card__content grid gap-4">
              <>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">District name</span>
                      <Input
                        name="district-name"
                        autoComplete="off"
                        value={selectedDistrict.name}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            name: event.currentTarget.value
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Square</span>
                      <Input
                        name="district-square"
                        autoComplete="off"
                        value={selectedDistrict.square}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            square: event.currentTarget.value as DistrictCell["square"]
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Locality</span>
                      <Input
                        name="district-locality"
                        autoComplete="off"
                        value={selectedDistrict.locality}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            locality: event.currentTarget.value
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Last reviewed</span>
                      <Input
                        name="district-last-reviewed-at"
                        autoComplete="off"
                        type="date"
                        value={selectedDistrict.lastReviewedAt ?? ""}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            lastReviewedAt: event.currentTarget.value || null
                          }))
                        }
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Content status</span>
                      <select
                        name="district-content-status"
                        className="field-select"
                        value={selectedDistrict.contentStatus}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            contentStatus: event.currentTarget.value as DistrictCell["contentStatus"]
                          }))
                        }
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Review status</span>
                      <select
                        name="district-review-status"
                        className="field-select"
                        value={selectedDistrict.reviewStatus}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            reviewStatus: event.currentTarget.value as DistrictCell["reviewStatus"]
                          }))
                        }
                      >
                        {reviewOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <Separator />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2 lg:col-span-2">
                      <span className="text-sm font-medium">Day profile</span>
                      <Textarea
                        name="district-day-profile"
                        autoComplete="off"
                        value={selectedDistrict.dayProfile}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            dayProfile: event.currentTarget.value
                          }))
                        }
                        rows={3}
                      />
                    </label>
                    <label className="grid gap-2 lg:col-span-2">
                      <span className="text-sm font-medium">Night profile</span>
                      <Textarea
                        name="district-night-profile"
                        autoComplete="off"
                        value={selectedDistrict.nightProfile}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            nightProfile: event.currentTarget.value
                          }))
                        }
                        rows={3}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Descriptors</span>
                      <Textarea
                        name="district-descriptors"
                        autoComplete="off"
                        value={formatListValue(selectedDistrict.descriptors)}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            descriptors: parseListValue(event.currentTarget.value)
                          }))
                        }
                        rows={5}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Tone cues</span>
                      <Textarea
                        name="district-tone-cues"
                        autoComplete="off"
                        value={formatListValue(selectedDistrict.toneCues)}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            toneCues: parseListValue(event.currentTarget.value)
                          }))
                        }
                        rows={5}
                      />
                    </label>
                    <label className="grid gap-2 lg:col-span-2">
                      <span className="text-sm font-medium">Landmarks</span>
                      <Textarea
                        name="district-landmarks"
                        autoComplete="off"
                        value={formatListValue(selectedDistrict.landmarks)}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            landmarks: parseListValue(event.currentTarget.value)
                          }))
                        }
                        rows={4}
                      />
                    </label>
                    <label className="grid gap-2 lg:col-span-2">
                      <span className="text-sm font-medium">Review notes</span>
                      <Textarea
                        name="district-review-notes"
                        autoComplete="off"
                        value={selectedDistrict.reviewNotes ?? ""}
                        onChange={(event) =>
                          updateSelectedDistrict((district) => ({
                            ...district,
                            reviewNotes: event.currentTarget.value || null
                          }))
                        }
                        rows={4}
                      />
                    </label>
                  </div>
                </>
            </CardContent>
          </Card>
          </div>
          ) : null}
        </div>
      }
    />
  );
}
