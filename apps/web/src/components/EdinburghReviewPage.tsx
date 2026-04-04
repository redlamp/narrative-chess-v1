import { useEffect, useMemo, useState } from "react";
import type { CityBoard, DistrictCell } from "@narrative-chess/content-schema";
import { cn } from "@/lib/utils";
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
import { edinburghBoard } from "../edinburghBoard";
import {
  buildEdinburghBoardValidation,
  listEdinburghBoardDraft,
  resetEdinburghBoardDraft,
  saveEdinburghBoardDraft
} from "../edinburghReviewState";
import {
  connectEdinburghReviewDirectory,
  getConnectedEdinburghReviewDirectoryName,
  loadEdinburghDraftFromDirectory,
  saveEdinburghDraftToDirectory,
  supportsLocalContentDirectory
} from "../fileSystemAccess";

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
};

const cityOverviewId = "city-overview";
const statusOptions = ["empty", "procedural", "authored"] as const;
const reviewOptions = ["empty", "needs review", "reviewed", "approved"] as const;

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
  anchor.download = "edinburgh-board.local.json";
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

export function EdinburghReviewPage() {
  const [draft, setDraft] = useState<CityBoard>(() => listEdinburghBoardDraft());
  const [selectedCityId, setSelectedCityId] = useState(() => edinburghBoard.id);
  const [selectedRecordId, setSelectedRecordId] = useState(cityOverviewId);
  const [searchQuery, setSearchQuery] = useState("");
  const [directoryName, setDirectoryName] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [isDirectorySupported, setIsDirectorySupported] = useState(false);
  const validation = useMemo(() => buildEdinburghBoardValidation(draft), [draft]);
  const trackedCities = useMemo<TrackedCity[]>(
    () => [
      {
        id: draft.id,
        name: draft.name,
        country: draft.country,
        summary: draft.summary,
        districtCount: draft.districts.length
      }
    ],
    [draft]
  );
  const selectedCity =
    trackedCities.find((city) => city.id === selectedCityId) ?? trackedCities[0] ?? null;

  useEffect(() => {
    setIsDirectorySupported(supportsLocalContentDirectory());

    let cancelled = false;

    void getConnectedEdinburghReviewDirectoryName().then((name) => {
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
      saveEdinburghBoardDraft(draft);
    }
  }, [draft, validation.isValid]);

  useEffect(() => {
    if (!selectedCity || selectedCity.id === selectedCityId) {
      return;
    }

    setSelectedCityId(selectedCity.id);
  }, [selectedCity, selectedCityId]);

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
      draft.districts.filter((district) => districtMatchesSearch(district, searchQuery)),
    [draft.districts, searchQuery]
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
    <main className="indexed-workspace indexed-workspace--page-scroll cities-workspace">
      <Card className="page-card page-card--intro">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Cities</Badge>
            <Badge variant="outline">{trackedCities.length} tracked city</Badge>
            <Badge variant="outline">64 mapped districts</Badge>
            <Badge variant={validation.isValid ? "outline" : "destructive"}>
              {validation.isValid ? "Schema valid" : `${validation.issues.length} validation issues`}
            </Badge>
            {directoryName ? <Badge variant="outline">Connected: {directoryName}</Badge> : null}
          </div>
          <CardTitle className="text-3xl tracking-tight">City and district workspace</CardTitle>
          <CardDescription className="max-w-4xl text-sm leading-6">
            Review gathered city boards, move from city selection into district detail, and write a
            repo-local draft file when you want the changes available to future passes. The current
            workspace is seeded with Edinburgh and structured so more cities can slot into the same
            pattern over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Tracked cities</p>
              <p className="mt-2 text-2xl font-semibold">{trackedCities.length}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Reviewed</p>
              <p className="mt-2 text-2xl font-semibold">{reviewedDistrictCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Landmarks</p>
              <p className="mt-2 text-2xl font-semibold">{uniqueLandmarkCount}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Review status</p>
              <p className="mt-2 text-sm text-muted-foreground">{draft.reviewStatus}</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_auto_auto_auto_auto] xl:items-start">
            <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              Browser edits autosave immediately. To create a file I can inspect in the repo later,
              connect the repo root or the `content` folder and save the draft to
              `content/cities/edinburgh-board.local.json`.
            </div>
            <Button
              variant="outline"
              onClick={() =>
                runDirectoryAction("connect-directory", async () => {
                  const result = await connectEdinburghReviewDirectory();
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
                  const result = await loadEdinburghDraftFromDirectory(edinburghBoard);
                  if (!result) {
                    setSaveNotice({
                      tone: "neutral",
                      text: "No local Edinburgh draft or canonical board file was found in the connected directory."
                    });
                    return;
                  }

                  setDraft(saveEdinburghBoardDraft(result.board));
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
                  const result = await saveEdinburghDraftToDirectory(draft);
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
                  text: "Downloaded edinburgh-board.local.json."
                });
              }}
              disabled={busyAction !== null}
            >
              Download JSON
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const nextDraft = resetEdinburghBoardDraft();
                setDraft(nextDraft);
                setSelectedCityId(nextDraft.id);
                setSelectedRecordId(cityOverviewId);
                setSaveNotice({
                  tone: "neutral",
                  text: "Reset the working draft back to the bundled Edinburgh board."
                });
              }}
            >
              Reset browser draft
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(saveEdinburghBoardDraft(draft));
                setSaveNotice({
                  tone: "success",
                  text: "Re-saved the current browser draft."
                });
              }}
            >
              Re-save browser draft
            </Button>
          </div>

          {saveNotice ? (
            <div
              aria-live="polite"
              role="status"
              className={cn(
                "rounded-lg border p-3 text-sm",
                saveNotice.tone === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "bg-muted/30 text-muted-foreground"
              )}
            >
              {saveNotice.text}
            </div>
          ) : null}

          {!validation.isValid ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-foreground">Validation notes</p>
              <ul className="mt-3 grid gap-2 text-sm text-muted-foreground">
                {validation.issues.slice(0, 8).map((issue) => (
                  <li key={issue} className="rounded-md border bg-background px-3 py-2">
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="indexed-workspace__columns indexed-workspace__columns--three-pane">
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
                <button
                  key={city.id}
                  type="button"
                  onClick={() => {
                    setSelectedCityId(city.id);
                    setSelectedRecordId(cityOverviewId);
                  }}
                  className={cn(
                    "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    city.id === selectedCity?.id
                      ? "border-foreground/15 bg-muted"
                      : "bg-background hover:bg-muted/50"
                  )}
                  aria-pressed={city.id === selectedCity?.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{city.name}</span>
                    <Badge variant="outline">{city.districtCount}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{city.country}</p>
                  <p className="text-sm text-muted-foreground">{city.summary}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Districts</CardTitle>
                {selectedCity ? <Badge variant="outline">{selectedCity.name}</Badge> : null}
              </div>
              <CardDescription>
                Select the city overview or drill into a district record like Edinburgh {">"} Broughton.
              </CardDescription>
            </div>
            <Input
              name="district-search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search by square, name, locality, or descriptor"
              aria-label="Search Edinburgh districts"
            />
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
                <button
                  type="button"
                  onClick={() => setSelectedRecordId(cityOverviewId)}
                  className={cn(
                    "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selectedRecordId === cityOverviewId
                      ? "border-foreground/15 bg-muted"
                      : "bg-background hover:bg-muted/50"
                  )}
                  aria-pressed={selectedRecordId === cityOverviewId}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{draft.name}</span>
                    <Badge variant="secondary">City overview</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{draft.summary}</p>
                </button>
                {filteredDistricts.map((district) => (
                  <button
                    key={district.id}
                    type="button"
                    onClick={() => setSelectedRecordId(district.id)}
                    className={cn(
                      "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      district.id === selectedDistrict?.id
                        ? "border-foreground/15 bg-muted"
                        : "bg-background hover:bg-muted/50"
                    )}
                    aria-pressed={district.id === selectedDistrict?.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{district.name}</span>
                      <Badge variant="outline">{district.square}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{district.locality}</Badge>
                      <Badge variant="outline">{district.reviewStatus}</Badge>
                    </div>
                  </button>
                ))}
                {!filteredDistricts.length ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No districts matched that search.
                  </div>
                ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="indexed-workspace__detail page-card-stack">
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
          ) : null}
        </div>
      </div>
    </main>
  );
}
