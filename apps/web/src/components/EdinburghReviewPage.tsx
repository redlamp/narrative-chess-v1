import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { CityBoard, DistrictCell, Square } from "@narrative-chess/content-schema";
import {
  ArrowDownAZ,
  ArrowDownZA,
  Asterisk,
  BadgeCheck,
  Check,
  ChevronDown,
  Crosshair,
  Download,
  FilePenLine,
  FolderTree,
  FolderOpen,
  Move,
  OctagonAlert,
  Bot,
  RotateCcw,
  Save,
  type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cityBoardDefinitions, getCityBoardDefinition } from "../cityBoards";
import { getDistrictMapCenter, getDistrictRadiusMeters } from "./cityMapShared";
import {
  buildCityBoardValidation,
  listCityBoardDraft,
  listCityBoardSavedBaseline,
  resetCityBoardDraft,
  saveCityBoardDraft,
  saveCityBoardSavedBaseline
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
import {
  CityDistrictBoardEditor,
  CityDistrictMapEditor
} from "./CityDistrictPlacementEditor";

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
const reviewStatusSortOrder = ["empty", "needs review", "reviewed", "approved"] as const;
const reviewOptions = ["needs review", "reviewed", "approved"] as const;
const districtSortOptions = [
  { value: "name", label: "Name" },
  { value: "square-file", label: "Square (file)" },
  { value: "square-rank", label: "Square (rank)" },
  { value: "locality", label: "Locality" },
  { value: "review-status", label: "Review status" },
  { value: "recently-reviewed", label: "Recently reviewed" }
] as const;

type DistrictSortMode = (typeof districtSortOptions)[number]["value"];
type DistrictSortDirection = "asc" | "desc";
type CityEditorTab = "basics" | "narrative" | "info";
type DistrictEditorTab = "basics" | "narrative" | "location";
type StatusTone = "empty" | "procedural" | "authored" | "needs-review" | "reviewed" | "approved";
type StatusMeta = {
  label: string;
  icon: LucideIcon;
  toneClassName: `status-tone--${StatusTone}`;
};

const initialCityDefinition = cityBoardDefinitions[0] ?? null;
const initialCityId = initialCityDefinition?.id ?? "edinburgh";
const minimumDistrictRadiusMeters = 50;
const maximumDistrictRadiusMeters = 2000;
const radiusSliderMarkerValues = [
  50,
  100,
  200,
  300,
  400,
  500,
  700,
  1000,
  1250,
  1500,
  1750,
  2000,
] as const;
const radiusSliderCurveExponent = 1.6;

function createInitialCityDraft() {
  const fallbackDefinition = initialCityDefinition ?? cityBoardDefinitions[0] ?? null;

  if (!fallbackDefinition) {
    throw new Error("At least one city board definition is required.");
  }

  return listCityBoardDraft(fallbackDefinition.id, fallbackDefinition.board);
}

function createInitialCitySavedBaseline() {
  const fallbackDefinition = initialCityDefinition ?? cityBoardDefinitions[0] ?? null;

  if (!fallbackDefinition) {
    throw new Error("At least one city board definition is required.");
  }

  return listCityBoardSavedBaseline(fallbackDefinition.id, fallbackDefinition.board);
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

function getContiguousSelection(input: {
  orderedIds: string[];
  anchorId: string | null;
  targetId: string;
}) {
  const anchorId = input.anchorId ?? input.targetId;
  const anchorIndex = input.orderedIds.indexOf(anchorId);
  const targetIndex = input.orderedIds.indexOf(input.targetId);

  if (anchorIndex === -1 || targetIndex === -1) {
    return [input.targetId];
  }

  const start = Math.min(anchorIndex, targetIndex);
  const end = Math.max(anchorIndex, targetIndex);
  return input.orderedIds.slice(start, end + 1);
}

function getNextMultiSelection(input: {
  orderedIds: string[];
  currentIds: string[];
  anchorId: string | null;
  targetId: string;
  shiftKey: boolean;
  toggleKey: boolean;
  allowEmpty?: boolean;
}) {
  if (input.shiftKey) {
    return {
      selectedIds: getContiguousSelection(input),
      anchorId: input.anchorId ?? input.targetId
    };
  }

  if (input.toggleKey) {
    const nextSelection = input.currentIds.includes(input.targetId)
      ? input.currentIds.filter((id) => id !== input.targetId)
      : input.orderedIds.filter((id) => [...input.currentIds, input.targetId].includes(id));

    if (!input.allowEmpty && nextSelection.length === 0) {
      return {
        selectedIds: [input.targetId],
        anchorId: input.targetId
      };
    }

    return {
      selectedIds: nextSelection,
      anchorId: input.targetId
    };
  }

  return {
    selectedIds: [input.targetId],
    anchorId: input.targetId
  };
}

function updateDistrictMapAnchorFromParts(input: {
  district: DistrictCell;
  fallbackAnchor: { longitude: number; latitude: number };
  longitudeText?: string;
  latitudeText?: string;
}) {
  const nextLongitudeText =
    input.longitudeText ?? `${input.district.mapAnchor?.longitude ?? input.fallbackAnchor.longitude}`;
  const nextLatitudeText =
    input.latitudeText ?? `${input.district.mapAnchor?.latitude ?? input.fallbackAnchor.latitude}`;
  const trimmedLongitude = nextLongitudeText.trim();
  const trimmedLatitude = nextLatitudeText.trim();

  if (!trimmedLongitude && !trimmedLatitude) {
    return {
      ...input.district,
      mapAnchor: undefined
    };
  }

  const longitude = trimmedLongitude === "" ? input.district.mapAnchor?.longitude ?? 0 : Number(trimmedLongitude);
  const latitude = trimmedLatitude === "" ? input.district.mapAnchor?.latitude ?? 0 : Number(trimmedLatitude);

  return {
    ...input.district,
    mapAnchor: {
      longitude:
        Number.isFinite(longitude) ? longitude : input.district.mapAnchor?.longitude ?? input.fallbackAnchor.longitude,
      latitude:
        Number.isFinite(latitude) ? latitude : input.district.mapAnchor?.latitude ?? input.fallbackAnchor.latitude
    }
  };
}

const boardSquares: Square[] = Array.from({ length: 8 }, (_, rankIndex) => 8 - rankIndex)
  .flatMap((rank) =>
    ["a", "b", "c", "d", "e", "f", "g", "h"].map((file) => `${file}${rank}` as Square)
  );

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

function cloneDistrict(district: DistrictCell) {
  return JSON.parse(JSON.stringify(district)) as DistrictCell;
}

function areDistrictsEqual(left: DistrictCell | null | undefined, right: DistrictCell | null | undefined) {
  if (!left || !right) {
    return left === right;
  }

  return JSON.stringify(left) === JSON.stringify(right);
}

function getDirtyDistrictIdSet(currentBoard: CityBoard, savedBoard: CityBoard | null | undefined) {
  if (!savedBoard) {
    return new Set<string>();
  }

  const savedDistrictsById = new Map(savedBoard.districts.map((district) => [district.id, district] as const));
  return new Set(
    currentBoard.districts
      .filter((district) => !areDistrictsEqual(district, savedDistrictsById.get(district.id)))
      .map((district) => district.id)
  );
}

function reassignDistrictSquare(board: CityBoard, districtId: string, nextSquare: Square) {
  const selectedDistrict = board.districts.find((district) => district.id === districtId);
  if (!selectedDistrict || selectedDistrict.square === nextSquare) {
    return board;
  }

  const occupant = board.districts.find(
    (district) => district.square === nextSquare && district.id !== districtId
  );

  return {
    ...board,
    districts: board.districts.map((district) => {
      if (district.id === districtId) {
        return {
          ...district,
          square: nextSquare
        };
      }

      if (occupant && district.id === occupant.id) {
        return {
          ...district,
          square: selectedDistrict.square
        };
      }

      return district;
    })
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
  if (sortMode === "square-file") {
    const fileDelta = left.square[0]!.localeCompare(right.square[0]!);
    if (fileDelta !== 0) {
      return fileDelta;
    }

    return left.square[1]!.localeCompare(right.square[1]!);
  }

  if (sortMode === "square-rank") {
    const rankDelta = Number(right.square[1]) - Number(left.square[1]);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.square[0]!.localeCompare(right.square[0]!);
  }

  if (sortMode === "locality") {
    const localityDelta = left.locality.localeCompare(right.locality);
    if (localityDelta !== 0) {
      return localityDelta;
    }
  }

  if (sortMode === "review-status") {
    const reviewOrder = new Map(reviewStatusSortOrder.map((status, index) => [status, index] as const));
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

function clampRadiusMeters(radiusMeters: number) {
  return Math.min(
    Math.max(Math.round(radiusMeters / 50) * 50, minimumDistrictRadiusMeters),
    maximumDistrictRadiusMeters
  );
}

function getCurvedRadiusSliderValue(radiusMeters: number) {
  const safeRadius = clampRadiusMeters(radiusMeters);
  const normalized =
    (safeRadius - minimumDistrictRadiusMeters) /
    (maximumDistrictRadiusMeters - minimumDistrictRadiusMeters);
  return Math.pow(normalized, 1 / radiusSliderCurveExponent) * 100;
}

function getRadiusMetersFromSliderValue(sliderValue: number) {
  const normalized = Math.min(Math.max(sliderValue, 0), 100) / 100;
  const radius =
    minimumDistrictRadiusMeters +
    (maximumDistrictRadiusMeters - minimumDistrictRadiusMeters) *
      Math.pow(normalized, radiusSliderCurveExponent);
  return clampRadiusMeters(radius);
}

function getContentStatusMeta(status: DistrictCell["contentStatus"] | CityBoard["contentStatus"]): StatusMeta {
  switch (status) {
    case "authored":
      return {
        label: "Authored",
        icon: FilePenLine,
        toneClassName: "status-tone--authored"
      };
    case "procedural":
      return {
        label: "Procedural",
        icon: Bot,
        toneClassName: "status-tone--procedural"
      };
    default:
      return {
        label: "Empty",
        icon: OctagonAlert,
        toneClassName: "status-tone--empty"
      };
  }
}

function getReviewStatusMeta(status: DistrictCell["reviewStatus"] | CityBoard["reviewStatus"]): StatusMeta {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        icon: BadgeCheck,
        toneClassName: "status-tone--approved"
      };
    case "reviewed":
      return {
        label: "Reviewed",
        icon: Check,
        toneClassName: "status-tone--reviewed"
      };
    case "needs review":
      return {
        label: "Needs review",
        icon: OctagonAlert,
        toneClassName: "status-tone--needs-review"
      };
    default:
      return {
        label: "Empty",
        icon: OctagonAlert,
        toneClassName: "status-tone--empty"
      };
  }
}

type StatusDropdownFieldProps<Value extends string> = {
  label: string;
  value: Value;
  options: readonly Value[];
  getMeta: (value: Value) => StatusMeta;
  disabled?: boolean;
  onChange: (value: Value) => void;
};

function StatusDropdownField<Value extends string>({
  label,
  value,
  options,
  getMeta,
  disabled = false,
  onChange
}: StatusDropdownFieldProps<Value>) {
  const activeMeta = getMeta(value);
  const ActiveIcon = activeMeta.icon;

  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="field-select status-menu-trigger" disabled={disabled}>
            <span className="status-menu-trigger__value">
              <ActiveIcon className={activeMeta.toneClassName} />
              <span>{activeMeta.label}</span>
            </span>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(nextValue) => onChange(nextValue as Value)}>
            {options.map((option) => {
              const optionMeta = getMeta(option);
              const OptionIcon = optionMeta.icon;

              return (
                <DropdownMenuRadioItem key={option} value={option}>
                  <span className="status-menu-item">
                    <OptionIcon className={optionMeta.toneClassName} />
                    <span>{optionMeta.label}</span>
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </label>
  );
}

type CoordinateStepperFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  className?: string;
  onChange: (valueText: string) => void;
};

function CoordinateStepperField({
  label,
  value,
  min,
  max,
  step,
  disabled = false,
  className,
  onChange
}: CoordinateStepperFieldProps) {
  return (
    <label className={className ? `grid gap-2 ${className}` : "grid gap-2"}>
      <span className="text-sm font-medium">{label}</span>
      <div className="coordinate-stepper">
        <Input
          name={`district-map-${label.toLowerCase()}`}
          autoComplete="off"
        type="number"
        step={step}
        min={min}
        max={max}
          disabled={disabled}
          value={value.toFixed(6)}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      </div>
    </label>
  );
}

type MapPositionMoveButtonProps = {
  longitude: number;
  latitude: number;
  longitudeMin: number;
  longitudeMax: number;
  latitudeMin: number;
  latitudeMax: number;
  step: number;
  disabled?: boolean;
  onMove: (longitudeText: string, latitudeText: string) => void;
};

function MapPositionMoveButton({
  longitude,
  latitude,
  longitudeMin,
  longitudeMax,
  latitudeMin,
  latitudeMax,
  step,
  disabled = false,
  onMove
}: MapPositionMoveButtonProps) {
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    startLongitude: number;
    startLatitude: number;
  } | null>(null);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      return;
    }

    event.preventDefault();
    dragStartRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLongitude: longitude,
      startLatitude: latitude
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (!dragStartRef.current) {
        return;
      }

      const deltaX = pointerEvent.clientX - dragStartRef.current.startX;
      const deltaY = dragStartRef.current.startY - pointerEvent.clientY;
      const nextLongitude = Math.min(
        Math.max(dragStartRef.current.startLongitude + Math.round(deltaX / 6) * step, longitudeMin),
        longitudeMax
      );
      const nextLatitude = Math.min(
        Math.max(dragStartRef.current.startLatitude + Math.round(deltaY / 6) * step, latitudeMin),
        latitudeMax
      );

      onMove(nextLongitude.toFixed(6), nextLatitude.toFixed(6));
    };

    const handlePointerUp = () => {
      dragStartRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="coordinate-stepper__drag"
            aria-label="Drag to move location"
            disabled={disabled}
            onPointerDown={handlePointerDown}
          >
            <Move />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Drag to move location</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

type EdinburghReviewPageProps = {
  layoutMode: boolean;
  showLayoutGrid: boolean;
  onCityBoardDraftChange?: (board: CityBoard) => void;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

export function EdinburghReviewPage({
  layoutMode,
  showLayoutGrid,
  onCityBoardDraftChange,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: EdinburghReviewPageProps) {
  const [selectedCityId, setSelectedCityId] = useState(initialCityId);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([initialCityId]);
  const [citySelectionAnchorId, setCitySelectionAnchorId] = useState<string | null>(initialCityId);
  const [draft, setDraft] = useState<CityBoard>(() => createInitialCityDraft());
  const cityDraftsRef = useRef<Record<string, CityBoard>>({
    [initialCityId]: createInitialCityDraft()
  });
  const [savedDraftsByCityId, setSavedDraftsByCityId] = useState<Record<string, CityBoard>>(() => ({
    [initialCityId]: createInitialCitySavedBaseline()
  }));
  const [selectedRecordId, setSelectedRecordId] = useState(cityOverviewId);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const [districtSelectionAnchorId, setDistrictSelectionAnchorId] = useState<string | null>(null);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [hoveredBoardSquare, setHoveredBoardSquare] = useState<Square | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [districtSortMode, setDistrictSortMode] = useState<DistrictSortMode>("name");
  const [districtSortDirection, setDistrictSortDirection] = useState<DistrictSortDirection>("asc");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const [isDirectorySupported, setIsDirectorySupported] = useState(false);
  const [cityReviewDirectoryName, setCityReviewDirectoryName] = useState<string | null>(null);
  const [selectedCityTab, setSelectedCityTabState] = useState<CityEditorTab>("basics");
  const [selectedDistrictTab, setSelectedDistrictTabState] = useState<DistrictEditorTab>("basics");
  const [isMapImportArmed, setIsMapImportArmed] = useState(false);
  const mapPlacementSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedCityDefinition =
    getCityBoardDefinition(selectedCityId) ?? initialCityDefinition ?? cityBoardDefinitions[0] ?? null;
  const validation = useMemo(() => buildCityBoardValidation(draft), [draft]);
  const trackedCities = useMemo<TrackedCity[]>(
    () =>
      cityBoardDefinitions.map((definition) => {
        const board =
          definition.id === draft.id
            ? draft
            : cityDraftsRef.current[definition.id] ?? listCityBoardDraft(definition.id, definition.board);

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
    void getConnectedCityReviewDirectoryName().then((directoryName) => {
      setCityReviewDirectoryName(directoryName);
    });
  }, []);

  useEffect(() => {
    try {
      const savedDraft = saveCityBoardDraft(draft);
      onCityBoardDraftChange?.(savedDraft);
    } catch {
      // Keep persisting local working edits even while the draft is temporarily invalid.
    }
  }, [draft, onCityBoardDraftChange]);

  useEffect(() => {
    if (!selectedCityDefinition) {
      return;
    }

    const cachedDraft = cityDraftsRef.current[selectedCityDefinition.id];
    const nextDraft = cachedDraft ?? listCityBoardDraft(selectedCityDefinition.id, selectedCityDefinition.board);
    cityDraftsRef.current[selectedCityDefinition.id] = nextDraft;
    setSavedDraftsByCityId((current) =>
      current[selectedCityDefinition.id]
        ? current
        : {
            ...current,
            [selectedCityDefinition.id]: listCityBoardSavedBaseline(
              selectedCityDefinition.id,
              selectedCityDefinition.board
            )
          }
    );
    setDraft(nextDraft);
    setSelectedRecordId(cityOverviewId);
    setSelectedDistrictIds([]);
    setDistrictSelectionAnchorId(null);
    setIsMapImportArmed(false);
    setHoveredDistrictId(null);
    setHoveredBoardSquare(null);
  }, [selectedCityDefinition]);

  useEffect(() => {
    cityDraftsRef.current[draft.id] = draft;
  }, [draft]);

  useEffect(() => {
    const validDistrictIds = new Set(draft.districts.map((district) => district.id));
    const nextSelectedDistrictIds = selectedDistrictIds.filter((districtId) => validDistrictIds.has(districtId));

    if (nextSelectedDistrictIds.length !== selectedDistrictIds.length) {
      setSelectedDistrictIds(nextSelectedDistrictIds);
    }

    if (selectedRecordId !== cityOverviewId && !validDistrictIds.has(selectedRecordId)) {
      setSelectedRecordId(nextSelectedDistrictIds[0] ?? cityOverviewId);
    }
  }, [draft, selectedDistrictIds, selectedRecordId]);
  const filteredDistricts = useMemo(
    () => {
      const sortedDistricts = [...draft.districts.filter((district) => districtMatchesSearch(district, searchQuery))].sort(
        (left, right) => compareDistricts(left, right, districtSortMode)
      );

      return districtSortDirection === "desc" ? sortedDistricts.reverse() : sortedDistricts;
    },
    [draft.districts, districtSortDirection, districtSortMode, searchQuery]
  );
  const selectedDistrictIdSet = useMemo(() => new Set(selectedDistrictIds), [selectedDistrictIds]);
  const selectedDistrict =
    selectedDistrictIds.length === 0
      ? null
      : draft.districts.find(
          (district) => district.id === selectedRecordId && selectedDistrictIdSet.has(district.id)
        ) ??
        draft.districts.find((district) => selectedDistrictIdSet.has(district.id)) ??
        null;
  const hoveredDistrictFromList = hoveredDistrictId
    ? draft.districts.find((district) => district.id === hoveredDistrictId) ?? null
    : null;
  const hoveredDistrictFromBoard = hoveredBoardSquare
    ? draft.districts.find((district) => district.square === hoveredBoardSquare) ?? null
    : null;
  const highlightedDistrict = hoveredDistrictFromList ?? hoveredDistrictFromBoard ?? null;
  const savedDraft = savedDraftsByCityId[draft.id] ?? null;
  const dirtyDistrictIdSet = useMemo(
    () => getDirtyDistrictIdSet(draft, savedDraft),
    [draft, savedDraft]
  );
  const editorDistrict = highlightedDistrict ?? selectedDistrict;
  const isDistrictHoverPreview = highlightedDistrict !== null && highlightedDistrict.id !== selectedDistrict?.id;
  const canEditEditorDistrict = editorDistrict !== null && !isDistrictHoverPreview;
  const isEditorDistrictDirty = editorDistrict ? dirtyDistrictIdSet.has(editorDistrict.id) : false;
  const cityContentStatusMeta = getContentStatusMeta(draft.contentStatus);
  const cityReviewStatusMeta = getReviewStatusMeta(draft.reviewStatus);
  const CityContentStatusIcon = cityContentStatusMeta.icon;
  const CityReviewStatusIcon = cityReviewStatusMeta.icon;
  const editorDistrictEffectiveMapAnchor = useMemo(() => {
    if (!editorDistrict) {
      return null;
    }

    const [longitude, latitude] = getDistrictMapCenter(draft, editorDistrict);
    return {
      longitude,
      latitude
    };
  }, [draft, editorDistrict]);
  const editorDistrictRadiusMeters = editorDistrict
    ? clampRadiusMeters(getDistrictRadiusMeters(editorDistrict))
    : minimumDistrictRadiusMeters;
  const isBulkCitySelection = selectedCityIds.length > 1;
  const isBulkDistrictSelection = selectedDistrictIds.length > 1;
  const setSelectedCityTab = (nextTab: CityEditorTab) => {
    setSelectedCityTabState(nextTab);
    setSelectedDistrictTabState(nextTab === "info" ? "location" : nextTab);
  };
  const setSelectedDistrictTab = (nextTab: DistrictEditorTab) => {
    setSelectedDistrictTabState(nextTab);
    setSelectedCityTabState(nextTab === "location" ? "info" : nextTab);
  };
  const selectDistrictById = (districtId: string) => {
    setSelectedDistrictIds([districtId]);
    setDistrictSelectionAnchorId(districtId);
    setSelectedRecordId(districtId);
    setIsMapImportArmed(false);
    setHoveredDistrictId(null);
    setHoveredBoardSquare(null);
  };

  const applyToSelectedCities = (updater: (board: CityBoard) => CityBoard) => {
    const targetCityIds = selectedCityIds.length ? selectedCityIds : [selectedCityId];

    setDraft((currentDraft) => {
      let nextCurrentDraft = currentDraft;

      for (const cityId of targetCityIds) {
        const cityDefinition = getCityBoardDefinition(cityId);
        if (!cityDefinition) {
          continue;
        }

        const baseBoard =
          cityId === currentDraft.id
            ? currentDraft
            : cityDraftsRef.current[cityId] ?? listCityBoardDraft(cityId, cityDefinition.board);
        const nextBoard = updater(baseBoard);
        cityDraftsRef.current[cityId] = nextBoard;

        if (cityId === currentDraft.id) {
          nextCurrentDraft = nextBoard;
          continue;
        }

        try {
          saveCityBoardDraft(nextBoard);
        } catch {
          // Keep the updated board in memory even if the draft is temporarily invalid.
        }
      }

      return nextCurrentDraft;
    });
  };

  const setCityField = <Field extends keyof CityBoard>(field: Field, value: CityBoard[Field]) => {
    applyToSelectedCities((board) => ({
      ...board,
      [field]: value
    }));
  };

  const updateSelectedDistricts = (updater: (district: DistrictCell) => DistrictCell) => {
    const targetDistrictIds =
      selectedDistrictIds.length > 0 ? selectedDistrictIds : selectedDistrict ? [selectedDistrict.id] : [];

    if (!targetDistrictIds.length) {
      return;
    }

    const targetDistrictIdSet = new Set(targetDistrictIds);
    setDraft((current) => ({
      ...current,
      districts: current.districts.map((district) =>
        targetDistrictIdSet.has(district.id) ? updater(district) : district
      )
    }));
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

  const markCityBoardSaved = (board: CityBoard) => {
    const nextBoard = saveCityBoardSavedBaseline(board);
    setSavedDraftsByCityId((current) => ({
      ...current,
      [nextBoard.id]: nextBoard
    }));
    return nextBoard;
  };

  const saveBoardToConnectedDirectory = async (board: CityBoard) => {
    if (!cityReviewDirectoryName) {
      return null;
    }

    const result = await saveCityDraftToDirectory(board);
    setCityReviewDirectoryName(result.directoryName);
    return result;
  };

  const handleSaveCityDraft = () => {
    void runDirectoryAction("save-city-draft", async () => {
      const nextDraft = saveCityBoardDraft(draft);
      cityDraftsRef.current[nextDraft.id] = nextDraft;
      markCityBoardSaved(nextDraft);

      const result = await saveBoardToConnectedDirectory(nextDraft);
      setSaveNotice({
        tone: "success",
        text: result
          ? `Saved all ${nextDraft.name} data to ${result.relativePath} inside ${result.directoryName}.`
          : `Saved all ${nextDraft.name} data to the browser draft. Connect a folder to save to disk.`
      });
    });
  };

  const handleResetCityDraft = () => {
    const fallback = selectedCityDefinition?.board ?? createInitialCityDraft();
    const nextDraft = resetCityBoardDraft(selectedCityId, fallback);
    cityDraftsRef.current[nextDraft.id] = nextDraft;
    markCityBoardSaved(nextDraft);
    setDraft(nextDraft);
    setSelectedCityId(nextDraft.id);
    setSelectedRecordId(cityOverviewId);
    setSelectedDistrictIds([]);
    setDistrictSelectionAnchorId(null);
    setSaveNotice({
      tone: "neutral",
      text: `Reset all ${nextDraft.name} data back to the bundled board.`
    });
  };

  const handleSaveEditorDistrict = () => {
    if (!editorDistrict || !canEditEditorDistrict) {
      return;
    }

    const districtId = editorDistrict.id;
    const districtToSave = draft.districts.find((district) => district.id === districtId);
    if (!districtToSave) {
      return;
    }

    void runDirectoryAction("save-district-draft", async () => {
      const baselineBoard = savedDraft ?? selectedCityDefinition?.board ?? draft;
      const nextSavedBoard = updateDistrict(
        reassignDistrictSquare(baselineBoard, districtId, districtToSave.square),
        districtId,
        () => cloneDistrict(districtToSave)
      );
      markCityBoardSaved(nextSavedBoard);

      const result = await saveBoardToConnectedDirectory(nextSavedBoard);
      setSaveNotice({
        tone: "success",
        text: result
          ? `Saved ${districtToSave.name} to ${result.relativePath} inside ${result.directoryName}.`
          : `Saved ${districtToSave.name} to the browser draft baseline. Connect a folder to save to disk.`
      });
    });
  };

  const handleResetEditorDistrict = () => {
    if (!editorDistrict || !canEditEditorDistrict || !savedDraft) {
      return;
    }

    const savedDistrict = savedDraft.districts.find((district) => district.id === editorDistrict.id);
    if (!savedDistrict) {
      return;
    }

    setDraft((current) => {
      const nextDraft = updateDistrict(
        reassignDistrictSquare(current, savedDistrict.id, savedDistrict.square),
        savedDistrict.id,
        () => ({ ...savedDistrict })
      );
      cityDraftsRef.current[nextDraft.id] = nextDraft;
      return nextDraft;
    });
    setIsMapImportArmed(false);
    setSaveNotice({
      tone: "neutral",
      text: `Reset ${savedDistrict.name} to its last saved state.`
    });
  };

  const handleCityListItemClick = (cityId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    const nextSelection = getNextMultiSelection({
      orderedIds: trackedCities.map((city) => city.id),
      currentIds: selectedCityIds,
      anchorId: citySelectionAnchorId,
      targetId: cityId,
      shiftKey: event.shiftKey,
      toggleKey: event.ctrlKey || event.metaKey
    });
    const nextPrimaryCityId = nextSelection.selectedIds.includes(cityId)
      ? cityId
      : nextSelection.selectedIds[nextSelection.selectedIds.length - 1] ?? cityId;
    const nextCityDefinition = getCityBoardDefinition(nextPrimaryCityId);

    if (nextCityDefinition) {
      const nextDraft =
        cityDraftsRef.current[nextPrimaryCityId] ??
        listCityBoardDraft(nextPrimaryCityId, nextCityDefinition.board);
      cityDraftsRef.current[nextPrimaryCityId] = nextDraft;
      setDraft(nextDraft);
    }

    setSelectedCityIds(nextSelection.selectedIds);
    setCitySelectionAnchorId(nextSelection.anchorId);
    setSelectedCityId(nextPrimaryCityId);
    setSelectedRecordId(cityOverviewId);
    setSelectedDistrictIds([]);
    setDistrictSelectionAnchorId(null);
    setHoveredDistrictId(null);
    setHoveredBoardSquare(null);
  };

  const handleDistrictListItemClick = (districtId: string, event: ReactMouseEvent<HTMLButtonElement>) => {
    const nextSelection = getNextMultiSelection({
      orderedIds: filteredDistricts.map((district) => district.id),
      currentIds: selectedDistrictIds,
      anchorId: districtSelectionAnchorId,
      targetId: districtId,
      shiftKey: event.shiftKey,
      toggleKey: event.ctrlKey || event.metaKey,
      allowEmpty: true
    });
    const nextPrimaryDistrictId = nextSelection.selectedIds.includes(districtId)
      ? districtId
      : nextSelection.selectedIds[0] ?? cityOverviewId;

    setSelectedDistrictIds(nextSelection.selectedIds);
    setDistrictSelectionAnchorId(nextSelection.anchorId);
    setSelectedRecordId(nextPrimaryDistrictId);
    setIsMapImportArmed(false);
    setHoveredDistrictId(null);
    setHoveredBoardSquare(null);
  };

  return (
    <IndexedWorkspace
      className="cities-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="cities-page"
      layoutVariant="three-pane"
      panelLabels={{
        intro: "Header",
        index: "Cities",
        secondary: "Districts",
        detail: "District detail",
        tertiary: "Board",
        quaternary: "Map"
      }}
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          title="Cities"
          actions={
            <TooltipProvider delayDuration={150}>
              <div className="workspace-header-actions-group">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() =>
                        runDirectoryAction("connect-directory", async () => {
                          const result = await connectCityReviewDirectory();
                          setCityReviewDirectoryName(result.directoryName);
                          setSaveNotice({
                            tone: "success",
                            text: `Connected to ${result.directoryName}.`
                          });
                        })
                      }
                      disabled={!isDirectorySupported || busyAction !== null}
                      aria-label="Connect folder"
                    >
                      <FolderTree />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Connect folder</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
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

                          const nextDraft = saveCityBoardDraft(result.board);
                          cityDraftsRef.current[nextDraft.id] = nextDraft;
                          markCityBoardSaved(nextDraft);
                          setDraft(nextDraft);
                          setSelectedCityId(result.board.id);
                          setSelectedRecordId(cityOverviewId);
                          setSelectedDistrictIds([]);
                          setDistrictSelectionAnchorId(null);
                          setSaveNotice({
                            tone: "success",
                            text: `Loaded ${result.sourceKind} data from ${result.relativePath}.`
                          });
                        })
                      }
                      disabled={busyAction !== null}
                      aria-label="Open file"
                    >
                      <FolderOpen />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open file</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="workspace-header-actions-reset-button"
                      onClick={handleResetCityDraft}
                      aria-label="Reset all city data"
                    >
                      <RotateCcw />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset all city data</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={() => {
                        downloadDraft(draft);
                        setSaveNotice({
                          tone: "neutral",
                          text: `Downloaded ${draft.id}-board.local.json.`
                        });
                      }}
                      disabled={busyAction !== null}
                      aria-label="Download JSON"
                    >
                      <Download />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Download JSON</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      onClick={handleSaveCityDraft}
                      disabled={busyAction !== null}
                      aria-label="Save all city data"
                    >
                      <Save />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Save all city data</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          }
          status={saveNotice}
        >
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
        </WorkspaceIntroCard>
      }
      index={
        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Cities</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <ul className="cities-page__list">
              {trackedCities.map((city) => {
                const contentStatusMeta = getContentStatusMeta(city.contentStatus);
                const reviewStatusMeta = getReviewStatusMeta(city.reviewStatus);
                const ContentStatusIcon = contentStatusMeta.icon;
                const ReviewStatusIcon = reviewStatusMeta.icon;

                return (
                  <WorkspaceListItem
                    key={city.id}
                    type="button"
                    onClick={(event) => handleCityListItemClick(city.id, event)}
                    selected={selectedCityIds.includes(city.id)}
                    title={
                      <div className="cities-page__city-list-title">
                        <h4 className="cities-page__district-title">{city.name}</h4>
                        <Badge variant="outline">{city.districtCount} districts</Badge>
                      </div>
                    }
                    meta={
                      <>
                        <span
                          className={`cities-page__status-indicator ${contentStatusMeta.toneClassName}`}
                          aria-label={`Content status: ${contentStatusMeta.label}`}
                          title={`Content status: ${contentStatusMeta.label}`}
                        >
                          <ContentStatusIcon />
                        </span>
                        <span
                          className={`cities-page__status-indicator ${reviewStatusMeta.toneClassName}`}
                          aria-label={`Review status: ${reviewStatusMeta.label}`}
                          title={`Review status: ${reviewStatusMeta.label}`}
                        >
                          <ReviewStatusIcon />
                        </span>
                      </>
                    }
                  />
                );
              })}
            </ul>
          </CardContent>
        </Card>
      }
      secondaryIndex={
        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>City</CardTitle>
            </div>
            <ul className="workspace-list">
              <WorkspaceListItem
                type="button"
                onClick={() => {
                  setSelectedRecordId(cityOverviewId);
                  setSelectedDistrictIds([]);
                  setDistrictSelectionAnchorId(null);
                  setHoveredDistrictId(null);
                  setHoveredBoardSquare(null);
                }}
                selected={selectedDistrictIds.length === 0}
                className="workspace-list-item--overview cities-page__overview-item"
                title={
                  <div className="cities-page__overview-title">
                    <h4 className="cities-page__district-title">{draft.name}</h4>
                    <Badge variant="secondary" className="cities-page__overview-pill">City Overview</Badge>
                  </div>
                }
                meta={
                  <>
                    <span
                      className={`cities-page__status-indicator ${cityContentStatusMeta.toneClassName}`}
                      aria-label={`Content status: ${cityContentStatusMeta.label}`}
                      title={`Content status: ${cityContentStatusMeta.label}`}
                    >
                      <CityContentStatusIcon />
                    </span>
                    <span
                      className={`cities-page__status-indicator ${cityReviewStatusMeta.toneClassName}`}
                      aria-label={`Review status: ${cityReviewStatusMeta.label}`}
                      title={`Review status: ${cityReviewStatusMeta.label}`}
                    >
                      <CityReviewStatusIcon />
                    </span>
                  </>
                }
              />
            </ul>
            <hr className="cities-districts-divider" />
            <div className="grid gap-3">
              <div className="cities-districts-section-header">
                <h3>Districts</h3>
              </div>
              <ClearableSearchField
                label={null}
                name="district-search"
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search Districts"
                ariaLabel="Search city districts"
              />
            </div>
            <div className="cities-districts-sort-row">
              <div className="cities-districts-sort-row__select">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" className="field-select cities-districts-sort-trigger">
                      <span>{districtSortOptions.find((option) => option.value === districtSortMode)?.label ?? "Name"}</span>
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={districtSortMode}
                      onValueChange={(value) => setDistrictSortMode(value as DistrictSortMode)}
                    >
                      {districtSortOptions.map((option) => (
                        <DropdownMenuRadioItem key={option.value} value={option.value}>
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="cities-districts-sort-row__actions">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  onClick={() =>
                    setDistrictSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                  }
                  aria-label={districtSortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                  title={districtSortDirection === "asc" ? "Sort ascending" : "Sort descending"}
                >
                  {districtSortDirection === "asc" ? <ArrowDownAZ /> : <ArrowDownZA />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <ul className="cities-page__list">
              {filteredDistricts.map((district) => (
                (() => {
                  const contentStatusMeta = getContentStatusMeta(district.contentStatus);
                  const reviewStatusMeta = getReviewStatusMeta(district.reviewStatus);
                  const ContentStatusIcon = contentStatusMeta.icon;
                  const ReviewStatusIcon = reviewStatusMeta.icon;

                  return (
                    <WorkspaceListItem
                      key={district.id}
                      type="button"
                      onClick={(event) => handleDistrictListItemClick(district.id, event)}
                      onMouseEnter={() => setHoveredDistrictId(district.id)}
                      onMouseLeave={() => setHoveredDistrictId(null)}
                      onFocus={() => setHoveredDistrictId(district.id)}
                      onBlur={() => setHoveredDistrictId(null)}
                      selected={selectedDistrictIdSet.has(district.id)}
                      className={highlightedDistrict?.id === district.id ? "cities-page__list-item--hovered" : undefined}
                      title={
                        <h4 className="cities-page__district-title">
                          <span className="cities-page__district-title-text">{district.name}</span>
                          {dirtyDistrictIdSet.has(district.id) ? (
                            <span
                              className="cities-page__dirty-indicator"
                              aria-label="District has unsaved edits"
                              title="District has unsaved edits"
                            >
                              <Asterisk />
                            </span>
                          ) : null}
                        </h4>
                      }
                      meta={
                        <>
                          <Badge variant="outline" className="cities-page__district-square-badge">
                            {district.square}
                          </Badge>
                          <span
                            className={`cities-page__status-indicator ${contentStatusMeta.toneClassName}`}
                            aria-label={`Content status: ${contentStatusMeta.label}`}
                            title={`Content status: ${contentStatusMeta.label}`}
                          >
                            <ContentStatusIcon />
                          </span>
                          <span
                            className={`cities-page__status-indicator ${reviewStatusMeta.toneClassName}`}
                            aria-label={`Review status: ${reviewStatusMeta.label}`}
                            title={`Review status: ${reviewStatusMeta.label}`}
                          >
                            <ReviewStatusIcon />
                          </span>
                        </>
                      }
                    />
                  );
                })()
              ))}
              {!filteredDistricts.length ? (
                <li className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No districts matched that search.
                </li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      }
      detail={
        <div className="page-card-stack">
          {selectedDistrictIds.length === 0 && !editorDistrict ? (
          <Card className="page-card page-card--detail">
            <CardHeader className="gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="grid min-w-0 gap-2">
                  <CardTitle>City Editor</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    {isBulkCitySelection ? (
                      <Badge variant="secondary">{selectedCityIds.length} selected</Badge>
                    ) : selectedCity ? (
                      <Badge variant="outline">{selectedCity.name}</Badge>
                    ) : null}
                  </div>
                </div>
                <TooltipProvider delayDuration={150}>
                  <div className="flex shrink-0 items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          className="workspace-header-actions-reset-button"
                          onClick={handleResetCityDraft}
                          aria-label="Reset all city data"
                        >
                          <RotateCcw />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reset all city data</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="outline"
                          onClick={handleSaveCityDraft}
                          disabled={busyAction !== null}
                          aria-label="Save all city data"
                        >
                          <Save />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Save all city data</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent className="page-card__content grid gap-4">
              <Tabs value={selectedCityTab} onValueChange={(value) => setSelectedCityTab(value as CityEditorTab)}>
                <TabsList className="detail-editor-tabs-list">
                  <TabsTrigger value="basics">Basics</TabsTrigger>
                  <TabsTrigger value="narrative">Narrative</TabsTrigger>
                  <TabsTrigger value="info">Info</TabsTrigger>
                </TabsList>

                <TabsContent value="basics" className="grid gap-4 pt-2">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <label className="grid gap-2 lg:col-span-3">
                      <span className="text-sm font-medium">City name</span>
                      <Input
                        name="city-name"
                        autoComplete="off"
                        value={draft.name}
                        onChange={(event) => setCityField("name", event.currentTarget.value)}
                      />
                    </label>
                    <StatusDropdownField
                      label="Content status"
                      value={draft.contentStatus}
                      options={statusOptions}
                      getMeta={getContentStatusMeta}
                      onChange={(value) => setCityField("contentStatus", value as CityBoard["contentStatus"])}
                    />
                    <StatusDropdownField
                      label="Review status"
                      value={draft.reviewStatus}
                      options={reviewOptions}
                      getMeta={getReviewStatusMeta}
                      onChange={(value) => setCityField("reviewStatus", value as CityBoard["reviewStatus"])}
                    />
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
                    <label className="grid gap-2 lg:col-span-3">
                      <span className="text-sm font-medium">Review notes</span>
                      <Textarea
                        name="city-review-notes"
                        autoComplete="off"
                        value={draft.reviewNotes ?? ""}
                        onChange={(event) => setCityField("reviewNotes", event.currentTarget.value || null)}
                        rows={3}
                      />
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="narrative" className="grid gap-4 pt-2">
                  <div className="grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Summary</span>
                      <Textarea
                        name="city-summary"
                        autoComplete="off"
                        value={draft.summary}
                        onChange={(event) => setCityField("summary", event.currentTarget.value)}
                        rows={4}
                      />
                    </label>
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Board orientation</span>
                      <Textarea
                        name="city-board-orientation"
                        autoComplete="off"
                        value={draft.boardOrientation}
                        onChange={(event) => setCityField("boardOrientation", event.currentTarget.value)}
                        rows={2}
                      />
                    </label>
                  </div>
                </TabsContent>

                <TabsContent value="info" className="grid gap-4 pt-2">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-sm font-medium">Country / region</span>
                      <Input
                        name="city-country"
                        autoComplete="off"
                        value={draft.country}
                        onChange={(event) => setCityField("country", event.currentTarget.value)}
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          ) : null}

          {editorDistrict ? (
          <>
            <Card className="page-card page-card--detail">
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid min-w-0 gap-2">
                    <CardTitle>District Editor</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedCity ? <Badge variant="outline">{selectedCity.name}</Badge> : null}
                      {isBulkDistrictSelection && !isDistrictHoverPreview ? (
                        <Badge variant="secondary">{selectedDistrictIds.length} selected</Badge>
                      ) : (
                        <>
                          {isEditorDistrictDirty ? (
                            <span
                              className="cities-page__dirty-indicator"
                              aria-label="District has unsaved edits"
                              title="District has unsaved edits"
                            >
                              <Asterisk />
                            </span>
                          ) : null}
                          <Badge variant="secondary">{editorDistrict.name}</Badge>
                          <Badge variant="outline">{editorDistrict.square}</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <TooltipProvider delayDuration={150}>
                    <div className="flex shrink-0 items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            className="workspace-header-actions-reset-button"
                            onClick={handleResetEditorDistrict}
                            disabled={isBulkDistrictSelection || !canEditEditorDistrict || !isEditorDistrictDirty}
                            aria-label="Reset district"
                          >
                            <RotateCcw />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset district</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={handleSaveEditorDistrict}
                            disabled={
                              busyAction !== null ||
                              isBulkDistrictSelection ||
                              !canEditEditorDistrict ||
                              !isEditorDistrictDirty
                            }
                            aria-label="Save district"
                          >
                            <Save />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Save district</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="page-card__content grid gap-4">
                <Tabs value={selectedDistrictTab} onValueChange={(value) => setSelectedDistrictTab(value as DistrictEditorTab)}>
                  <TabsList className="detail-editor-tabs-list">
                    <TabsTrigger value="basics">Basics</TabsTrigger>
                    <TabsTrigger value="narrative">Narrative</TabsTrigger>
                    <TabsTrigger value="location">Location</TabsTrigger>
                  </TabsList>

                  <TabsContent value="basics" className="grid gap-4 pt-2">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <label className="grid gap-2 lg:col-span-3">
                        <span className="text-sm font-medium">District name</span>
                        <Input
                          name="district-name"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.name}
                          onChange={(event) => {
                            const nextName = event.currentTarget.value;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              name: nextName
                            }));
                          }}
                        />
                      </label>
                      <StatusDropdownField
                        label="Content status"
                        value={editorDistrict.contentStatus}
                        options={statusOptions}
                        getMeta={getContentStatusMeta}
                        disabled={!canEditEditorDistrict}
                        onChange={(value) =>
                          updateSelectedDistricts((district) => ({
                            ...district,
                            contentStatus: value as DistrictCell["contentStatus"]
                          }))
                        }
                      />
                      <StatusDropdownField
                        label="Review status"
                        value={editorDistrict.reviewStatus}
                        options={reviewOptions}
                        getMeta={getReviewStatusMeta}
                        disabled={!canEditEditorDistrict}
                        onChange={(value) =>
                          updateSelectedDistricts((district) => ({
                            ...district,
                            reviewStatus: value as DistrictCell["reviewStatus"]
                          }))
                        }
                      />
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Last reviewed</span>
                        <Input
                          name="district-last-reviewed-at"
                          autoComplete="off"
                          type="date"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.lastReviewedAt ?? ""}
                          onChange={(event) => {
                            const nextLastReviewedAt = event.currentTarget.value || null;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              lastReviewedAt: nextLastReviewedAt
                            }));
                          }}
                        />
                      </label>
                      <label className="grid gap-2 lg:col-span-3">
                        <span className="text-sm font-medium">Review notes</span>
                        <Textarea
                          name="district-review-notes"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.reviewNotes ?? ""}
                          onChange={(event) => {
                            const nextReviewNotes = event.currentTarget.value || null;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              reviewNotes: nextReviewNotes
                            }));
                          }}
                          rows={4}
                        />
                      </label>
                    </div>
                  </TabsContent>

                  <TabsContent value="narrative" className="grid gap-4 pt-2">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2 lg:col-span-2">
                        <span className="text-sm font-medium">Day profile</span>
                        <Textarea
                          name="district-day-profile"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.dayProfile}
                          onChange={(event) => {
                            const nextDayProfile = event.currentTarget.value;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              dayProfile: nextDayProfile
                            }));
                          }}
                          rows={3}
                        />
                      </label>
                      <label className="grid gap-2 lg:col-span-2">
                        <span className="text-sm font-medium">Night profile</span>
                        <Textarea
                          name="district-night-profile"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.nightProfile}
                          onChange={(event) => {
                            const nextNightProfile = event.currentTarget.value;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              nightProfile: nextNightProfile
                            }));
                          }}
                          rows={3}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Descriptions</span>
                        <Textarea
                          name="district-descriptors"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={formatListValue(editorDistrict.descriptors)}
                          onChange={(event) => {
                            const nextDescriptors = parseListValue(event.currentTarget.value);
                            updateSelectedDistricts((district) => ({
                              ...district,
                              descriptors: nextDescriptors
                            }));
                          }}
                          rows={5}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Tone cues</span>
                        <Textarea
                          name="district-tone-cues"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={formatListValue(editorDistrict.toneCues)}
                          onChange={(event) => {
                            const nextToneCues = parseListValue(event.currentTarget.value);
                            updateSelectedDistricts((district) => ({
                              ...district,
                              toneCues: nextToneCues
                            }));
                          }}
                          rows={5}
                        />
                      </label>
                    </div>
                  </TabsContent>

                  <TabsContent value="location" className="grid gap-4 pt-2">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Board tile</span>
                        <select
                          name="district-square"
                          className="field-select"
                          disabled={isBulkDistrictSelection || !canEditEditorDistrict}
                          value={editorDistrict.square}
                          onChange={(event) => {
                            const nextSquare = event.currentTarget.value as DistrictCell["square"];
                            setDraft((current) =>
                              reassignDistrictSquare(
                                current,
                                editorDistrict.id,
                                nextSquare
                              )
                            );
                          }}
                        >
                          {boardSquares.map((square) => (
                            <option key={square} value={square}>
                              {square}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Locality</span>
                        <Input
                          name="district-locality"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={editorDistrict.locality}
                          onChange={(event) => {
                            const nextLocality = event.currentTarget.value;
                            updateSelectedDistricts((district) => ({
                              ...district,
                              locality: nextLocality
                            }));
                          }}
                        />
                      </label>
                      <label className="grid gap-2 lg:col-span-2">
                        <span className="text-sm font-medium">Landmarks</span>
                        <Textarea
                          name="district-landmarks"
                          autoComplete="off"
                          disabled={!canEditEditorDistrict}
                          value={formatListValue(editorDistrict.landmarks)}
                          onChange={(event) => {
                            const nextLandmarks = parseListValue(event.currentTarget.value);
                            updateSelectedDistricts((district) => ({
                              ...district,
                              landmarks: nextLandmarks
                            }));
                          }}
                          rows={4}
                        />
                      </label>
                      <div className="grid gap-2 lg:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium">Radius</span>
                          <span className="text-xs text-muted-foreground">
                            {editorDistrictRadiusMeters.toLocaleString()} m
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={1}
                          value={[getCurvedRadiusSliderValue(editorDistrictRadiusMeters)]}
                          disabled={!canEditEditorDistrict}
                          onValueChange={([sliderValue]) => {
                            if (typeof sliderValue !== "number") {
                              return;
                            }

                            updateSelectedDistricts((district) => ({
                              ...district,
                              radiusMeters: getRadiusMetersFromSliderValue(sliderValue)
                            }));
                          }}
                        />
                        <div className="cities-page__radius-slider-markers" aria-hidden="true">
                          {radiusSliderMarkerValues.map((markerValue, index) => {
                            const leftPercent =
                              getCurvedRadiusSliderValue(markerValue);
                            const transform =
                              index === 0 ? "translateX(0)" : index === radiusSliderMarkerValues.length - 1 ? "translateX(-100%)" : "translateX(-50%)";

                            return (
                              <span
                                key={markerValue}
                                className="cities-page__radius-slider-marker"
                                style={{
                                  left: `${leftPercent}%`,
                                  transform
                                }}
                              >
                                {markerValue.toLocaleString()} m
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="cities-page__coordinate-row lg:col-span-2">
                        <div className="grid gap-2 justify-items-start">
                          <span className="text-sm font-medium">Pin</span>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant={isMapImportArmed ? "secondary" : "outline"}
                                  className="mt-auto"
                                  disabled={isBulkDistrictSelection || !canEditEditorDistrict}
                                  onClick={() => setIsMapImportArmed((current) => !current)}
                                  aria-label="Pin on map"
                                >
                                  <Crosshair />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Pin on map</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <CoordinateStepperField
                          label="Longitude"
                          value={editorDistrictEffectiveMapAnchor?.longitude ?? 0}
                          min={-180}
                          max={180}
                          step={0.00001}
                          disabled={isBulkDistrictSelection || !canEditEditorDistrict}
                          className="coordinate-stepper-field--compact"
                          onChange={(valueText) =>
                            updateSelectedDistricts((district) =>
                              updateDistrictMapAnchorFromParts({
                                district,
                                fallbackAnchor: editorDistrictEffectiveMapAnchor ?? { longitude: 0, latitude: 0 },
                                longitudeText: valueText
                              })
                            )
                          }
                        />
                        <MapPositionMoveButton
                          longitude={editorDistrictEffectiveMapAnchor?.longitude ?? 0}
                          latitude={editorDistrictEffectiveMapAnchor?.latitude ?? 0}
                          longitudeMin={-180}
                          longitudeMax={180}
                          latitudeMin={-90}
                          latitudeMax={90}
                          step={0.00001}
                          disabled={isBulkDistrictSelection || !canEditEditorDistrict}
                          onMove={(longitudeText, latitudeText) =>
                            updateSelectedDistricts((district) =>
                              updateDistrictMapAnchorFromParts({
                                district,
                                fallbackAnchor: editorDistrictEffectiveMapAnchor ?? { longitude: 0, latitude: 0 },
                                longitudeText,
                                latitudeText
                              })
                            )
                          }
                        />
                        <CoordinateStepperField
                          label="Latitude"
                          value={editorDistrictEffectiveMapAnchor?.latitude ?? 0}
                          min={-90}
                          max={90}
                          step={0.00001}
                          disabled={isBulkDistrictSelection || !canEditEditorDistrict}
                          className="coordinate-stepper-field--compact"
                          onChange={(valueText) =>
                            updateSelectedDistricts((district) =>
                              updateDistrictMapAnchorFromParts({
                                district,
                                fallbackAnchor: editorDistrictEffectiveMapAnchor ?? { longitude: 0, latitude: 0 },
                                latitudeText: valueText
                              })
                            )
                          }
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
          ) : null}
        </div>
      }
      tertiary={
        <Card className="page-card page-card--detail">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Board</CardTitle>
              {selectedDistrict && !isBulkDistrictSelection ? (
                <Badge variant="secondary">{selectedDistrict.square}</Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="page-card__content grid gap-4">
            {selectedDistrict ? (
              <CityDistrictBoardEditor
                cityBoard={draft}
                selectedDistrict={selectedDistrict}
                highlightedDistrict={highlightedDistrict}
                hoveredSquare={highlightedDistrict?.square ?? hoveredBoardSquare}
                onHoveredSquareChange={setHoveredBoardSquare}
                onSelectDistrict={selectDistrictById}
                onSquareChange={(square) => {
                  setDraft((current) => reassignDistrictSquare(current, selectedDistrict.id, square));
                }}
              />
            ) : (
              <CityDistrictBoardEditor
                cityBoard={draft}
                selectedDistrict={null}
                highlightedDistrict={highlightedDistrict}
                hoveredSquare={highlightedDistrict?.square ?? hoveredBoardSquare}
                onHoveredSquareChange={setHoveredBoardSquare}
                onSelectDistrict={selectDistrictById}
                onSquareChange={() => {}}
              />
            )}
          </CardContent>
        </Card>
      }
      quaternary={
        <Card className="page-card page-card--detail">
          <CardHeader className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Map</CardTitle>
              <div ref={mapPlacementSearchContainerRef} className="city-placement-editor__geocoder-host" />
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--map-placement">
            {selectedDistrict ? (
              <CityDistrictMapEditor
                cityBoard={draft}
                selectedDistrict={selectedDistrict}
                highlightedDistrict={highlightedDistrict}
                searchContainerRef={mapPlacementSearchContainerRef}
                onHighlightedDistrictChange={setHoveredDistrictId}
                onSelectDistrict={selectDistrictById}
                importModeArmed={isMapImportArmed}
                onImportModeConsumed={() => setIsMapImportArmed(false)}
                onMapAnchorChange={(mapAnchor) =>
                  setDraft((current) =>
                    updateDistrict(current, selectedDistrict.id, (district) => ({
                      ...district,
                      mapAnchor
                    }))
                  )
                }
              />
            ) : (
              <CityDistrictMapEditor
                cityBoard={draft}
                selectedDistrict={null}
                highlightedDistrict={highlightedDistrict}
                searchContainerRef={mapPlacementSearchContainerRef}
                onHighlightedDistrictChange={setHoveredDistrictId}
                onSelectDistrict={selectDistrictById}
                importModeArmed={false}
                onImportModeConsumed={() => {}}
                onMapAnchorChange={() => {}}
              />
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
