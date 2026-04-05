import { useEffect, useMemo, useState } from "react";
import type {
  ContentStatus,
  PieceKind,
  ReviewStatus
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
import { Textarea } from "@/components/ui/textarea";
import { getPieceKindLabel } from "../chessPresentation";
import {
  listRoleCatalog,
  findRoleCatalogEntry,
  groupRoleCatalogByPieceKind,
  pieceKinds,
  type RoleCatalog
} from "../roleCatalog";
import { IndexedWorkspace } from "./IndexedWorkspace";
import { ClearableSearchField } from "./ClearableSearchField";
import { EditableTagList } from "./EditableTagList";
import { PieceArt } from "./PieceArt";
import { WorkspaceIntroCard } from "./WorkspaceIntroCard";
import { WorkspaceListItem } from "./WorkspaceListItem";

type RoleCatalogPageProps = {
  roleCatalog: RoleCatalog;
  layoutMode: boolean;
  showLayoutGrid: boolean;
  roleCatalogDirectoryName: string | null;
  isRoleCatalogDirectorySupported: boolean;
  roleCatalogFileBusyAction: string | null;
  roleCatalogFileNotice: {
    tone: "neutral" | "success" | "error";
    text: string;
  } | null;
  onRoleCatalogChange: (
    roleId: string,
    field:
      | "pieceKind"
      | "name"
      | "summary"
      | "traits"
      | "verbs"
      | "notes"
      | "contentStatus"
      | "reviewStatus"
      | "reviewNotes"
      | "lastReviewedAt",
    value:
      | PieceKind
      | string
      | string[]
      | null
      | ContentStatus
      | ReviewStatus
  ) => void;
  onRoleCatalogReset: () => void;
  onRoleCatalogAdd: (pieceKind?: PieceKind) => void;
  onRoleCatalogDuplicate: (roleId: string) => void;
  onRoleCatalogRemove: (roleId: string) => void;
  onConnectRoleCatalogDirectory: () => void;
  onLoadRoleCatalogFromDirectory: () => void;
  onSaveRoleCatalogToDirectory: () => void;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
};

const contentStatusOptions = ["empty", "procedural", "authored"] as const;
const reviewStatusOptions = ["empty", "needs review", "reviewed", "approved"] as const;
const roleSortOptions = [
  { value: "name", label: "Name" },
  { value: "review-status", label: "Review status" },
  { value: "recently-reviewed", label: "Recently reviewed" }
] as const;

type RoleSortMode = (typeof roleSortOptions)[number]["value"];

function roleMatchesQuery(role: RoleCatalog[number], query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    role.name,
    role.summary,
    role.pieceKind,
    ...role.traits,
    ...role.verbs,
    role.notes ?? ""
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function compareRoleEntries(
  left: RoleCatalog[number],
  right: RoleCatalog[number],
  sortMode: RoleSortMode
) {
  if (sortMode === "review-status") {
    const reviewOrder = new Map(reviewStatusOptions.map((status, index) => [status, index] as const));
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

export function RoleCatalogPage({
  roleCatalog,
  layoutMode,
  showLayoutGrid,
  roleCatalogDirectoryName,
  isRoleCatalogDirectorySupported,
  roleCatalogFileBusyAction,
  roleCatalogFileNotice,
  onRoleCatalogChange,
  onRoleCatalogReset,
  onRoleCatalogAdd,
  onRoleCatalogDuplicate,
  onRoleCatalogRemove,
  onConnectRoleCatalogDirectory,
  onLoadRoleCatalogFromDirectory,
  onSaveRoleCatalogToDirectory,
  onToggleLayoutMode,
  onToggleLayoutGrid
}: RoleCatalogPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<RoleSortMode>("name");
  const [selectedPieceKind, setSelectedPieceKind] = useState<PieceKind>(
    roleCatalog[0]?.pieceKind ?? "pawn"
  );
  const [selectedRoleId, setSelectedRoleId] = useState(roleCatalog[0]?.id ?? "");
  const groupedRoles = useMemo(() => groupRoleCatalogByPieceKind(roleCatalog), [roleCatalog]);
  const filteredRoleGroups = useMemo(
    () =>
      pieceKinds.reduce(
        (catalog, pieceKind) => {
          catalog[pieceKind] = groupedRoles[pieceKind].filter((role) =>
            roleMatchesQuery(role, searchQuery)
          );
          return catalog;
        },
        {} as Record<PieceKind, RoleCatalog>
      ),
    [groupedRoles, searchQuery]
  );
  const selectedPieceRoles = useMemo(
    () =>
      [...(filteredRoleGroups[selectedPieceKind] ?? [])].sort((left, right) =>
        compareRoleEntries(left, right, sortMode)
      ),
    [filteredRoleGroups, selectedPieceKind, sortMode]
  );
  const selectedRole =
    selectedPieceRoles.find((role) => role.id === selectedRoleId) ??
    groupedRoles[selectedPieceKind].find((role) => role.id === selectedRoleId) ??
    selectedPieceRoles[0] ??
    groupedRoles[selectedPieceKind][0] ??
    findRoleCatalogEntry(roleCatalog, selectedRoleId) ??
    roleCatalog[0] ??
    null;

  useEffect(() => {
    const pieceHasVisibleRoles = selectedPieceRoles.length > 0;
    if (pieceHasVisibleRoles || !searchQuery) {
      return;
    }

    const nextPieceKind =
      pieceKinds.find((pieceKind) => filteredRoleGroups[pieceKind].length > 0) ?? selectedPieceKind;
    if (nextPieceKind !== selectedPieceKind) {
      setSelectedPieceKind(nextPieceKind);
    }
  }, [filteredRoleGroups, searchQuery, selectedPieceKind, selectedPieceRoles.length]);

  useEffect(() => {
    if (!selectedRole) {
      return;
    }

    if (selectedRole.pieceKind !== selectedPieceKind) {
      setSelectedPieceKind(selectedRole.pieceKind);
    }

    if (selectedRole.id !== selectedRoleId) {
      setSelectedRoleId(selectedRole.id);
    }
  }, [selectedPieceKind, selectedRole, selectedRoleId]);

  const handleResetSelectedRole = () => {
    if (!selectedRole) {
      return;
    }

    const savedRole = listRoleCatalog().find((role) => role.id === selectedRole.id);
    if (!savedRole) {
      return;
    }

    onRoleCatalogChange(selectedRole.id, "pieceKind", savedRole.pieceKind);
    onRoleCatalogChange(selectedRole.id, "name", savedRole.name);
    onRoleCatalogChange(selectedRole.id, "summary", savedRole.summary);
    onRoleCatalogChange(selectedRole.id, "traits", savedRole.traits);
    onRoleCatalogChange(selectedRole.id, "verbs", savedRole.verbs);
    onRoleCatalogChange(selectedRole.id, "notes", savedRole.notes);
    onRoleCatalogChange(selectedRole.id, "contentStatus", savedRole.contentStatus);
    onRoleCatalogChange(selectedRole.id, "reviewStatus", savedRole.reviewStatus);
    onRoleCatalogChange(selectedRole.id, "reviewNotes", savedRole.reviewNotes);
    onRoleCatalogChange(selectedRole.id, "lastReviewedAt", savedRole.lastReviewedAt);
    setSelectedPieceKind(savedRole.pieceKind);
    setSelectedRoleId(savedRole.id);
  };

  return (
    <IndexedWorkspace
      className="role-catalog-workspace"
      scrollMode="page"
      layoutMode={layoutMode}
      layoutKey="roles-page"
      layoutVariant="three-pane"
      showLayoutGrid={showLayoutGrid}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      intro={
        <WorkspaceIntroCard
          badgeRow={
            <>
              <Badge variant="outline">{roleCatalog.length} editable roles</Badge>
              {roleCatalogDirectoryName ? <Badge variant="outline">{roleCatalogDirectoryName}</Badge> : null}
            </>
          }
          title="Characters"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={onConnectRoleCatalogDirectory}
                disabled={!isRoleCatalogDirectorySupported || roleCatalogFileBusyAction !== null}
              >
                Connect folder
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onLoadRoleCatalogFromDirectory}
                disabled={!roleCatalogDirectoryName || roleCatalogFileBusyAction !== null}
              >
                Load from disk
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onSaveRoleCatalogToDirectory}
                disabled={!roleCatalogDirectoryName || roleCatalogFileBusyAction !== null}
              >
                Save to disk
              </Button>
              <Button type="button" variant="outline" onClick={onRoleCatalogReset}>
                Reset defaults
              </Button>
            </>
          }
          status={roleCatalogFileNotice}
        />
      }
      index={
        <Card className="page-card page-card--index">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid gap-2">
                <CardTitle>Pieces</CardTitle>
                <CardDescription>
                  Choose the chess piece family first, then pick a role from the next column.
                </CardDescription>
              </div>
              <Button type="button" variant="outline" onClick={() => onRoleCatalogAdd(selectedPieceKind)}>
                Add role
              </Button>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <div className="grid gap-2">
              {pieceKinds.map((pieceKind) => {
                const totalCount = groupedRoles[pieceKind].length;
                const visibleCount = filteredRoleGroups[pieceKind].length;

                return (
                  <WorkspaceListItem
                    key={pieceKind}
                    onClick={() => setSelectedPieceKind(pieceKind)}
                    selected={pieceKind === selectedPieceKind}
                    leading={
                      <PieceArt
                        side="white"
                        kind={pieceKind}
                        className="board-piece-art board-piece-art--list"
                      />
                    }
                    title={getPieceKindLabel(pieceKind)}
                    description={
                      searchQuery
                        ? `${visibleCount} matching roles`
                        : `${totalCount} roles available for this piece family.`
                    }
                    meta={<Badge variant="outline">{totalCount}</Badge>}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      }
      secondaryIndex={
        <Card className="page-card page-card--index page-card--secondary-index">
          <CardHeader className="gap-4">
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Roles</CardTitle>
                <Badge variant="outline">{getPieceKindLabel(selectedPieceKind)}</Badge>
                <Badge variant="outline">{selectedPieceRoles.length} visible</Badge>
              </div>
              <CardDescription>
                Search within the catalog, then choose a specific role to edit.
              </CardDescription>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem]">
                <ClearableSearchField
                  label="Search roles"
                  name="role-search"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Search by role, trait, verb, or summary"
                  ariaLabel="Search piece roles"
                />
                <label className="grid gap-2">
                  <span className="text-sm font-medium">Sort by</span>
                  <select
                    name="role-sort"
                    className="field-select"
                    value={sortMode}
                    onChange={(event) => setSortMode(event.currentTarget.value as RoleSortMode)}
                  >
                    {roleSortOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </CardHeader>
          <CardContent className="page-card__content page-card__content--scroll pt-0">
            <div className="grid gap-2">
              {selectedPieceRoles.map((role) => (
                <WorkspaceListItem
                  key={role.id}
                  onClick={() => {
                    setSelectedPieceKind(role.pieceKind);
                    setSelectedRoleId(role.id);
                  }}
                  selected={role.id === selectedRole?.id}
                  title={role.name}
                  description={role.summary}
                  meta={<Badge variant="outline">{role.reviewStatus}</Badge>}
                />
              ))}
              {!selectedPieceRoles.length ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No {getPieceKindLabel(selectedPieceKind).toLowerCase()} roles matched that search.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      }
      detail={
        <Card className="page-card page-card--detail">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Role detail editor</CardTitle>
              {selectedRole ? <Badge variant="outline">{getPieceKindLabel(selectedRole.pieceKind)}</Badge> : null}
            </div>
            <CardDescription>
              Edit the selected role record and keep the roster grounded in readable, reusable
              character prompts.
            </CardDescription>
          </CardHeader>
          <CardContent className="page-card__content grid gap-4">
            {selectedRole ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => onRoleCatalogAdd(selectedRole.pieceKind)}>
                    Add same-piece role
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRoleCatalogDuplicate(selectedRole.id)}
                  >
                    Duplicate role
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onRoleCatalogRemove(selectedRole.id)}
                  >
                    Remove role
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResetSelectedRole}>
                    Reset role
                  </Button>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Role name</span>
                    <Input
                      name="role-name"
                      autoComplete="off"
                      value={selectedRole.name}
                      onChange={(event) =>
                        onRoleCatalogChange(selectedRole.id, "name", event.currentTarget.value)
                      }
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Piece type</span>
                    <select
                      name="role-piece-kind"
                      className="field-select"
                      value={selectedRole.pieceKind}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "pieceKind",
                          event.currentTarget.value as PieceKind
                        )
                      }
                    >
                      {pieceKinds.map((pieceKind) => (
                        <option key={pieceKind} value={pieceKind}>
                          {getPieceKindLabel(pieceKind)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 lg:col-span-2">
                    <span className="text-sm font-medium">Summary</span>
                    <Textarea
                      name="role-summary"
                      autoComplete="off"
                      value={selectedRole.summary}
                      onChange={(event) =>
                        onRoleCatalogChange(selectedRole.id, "summary", event.currentTarget.value)
                      }
                      rows={4}
                    />
                  </label>
                </div>

                <Separator />

                <div className="grid gap-4 lg:grid-cols-2">
                  <EditableTagList
                    title="Traits"
                    description="Add or remove the descriptive tags that shape the role."
                    items={selectedRole.traits}
                    placeholder="Add a trait"
                    addLabel="Add trait"
                    emptyText="Add traits to shape this role."
                    onAdd={(value) =>
                      onRoleCatalogChange(selectedRole.id, "traits", [...selectedRole.traits, value])
                    }
                    onRemove={(value) =>
                      onRoleCatalogChange(
                        selectedRole.id,
                        "traits",
                        selectedRole.traits.filter((trait) => trait !== value)
                      )
                    }
                  />
                  <EditableTagList
                    title="Verbs"
                    description="Add or remove action verbs for match narration and role prompts."
                    items={selectedRole.verbs}
                    placeholder="Add a verb"
                    addLabel="Add verb"
                    emptyText="Add verbs to shape this role."
                    onAdd={(value) =>
                      onRoleCatalogChange(selectedRole.id, "verbs", [...selectedRole.verbs, value])
                    }
                    onRemove={(value) =>
                      onRoleCatalogChange(
                        selectedRole.id,
                        "verbs",
                        selectedRole.verbs.filter((verb) => verb !== value)
                      )
                    }
                  />
                  <label className="grid gap-2 lg:col-span-2">
                    <span className="text-sm font-medium">Notes</span>
                    <Textarea
                      name="role-notes"
                      autoComplete="off"
                      value={selectedRole.notes ?? ""}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "notes",
                          event.currentTarget.value || null
                        )
                      }
                      rows={4}
                    />
                  </label>
                </div>

                <Separator />

                <div className="grid gap-4 lg:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Content status</span>
                    <select
                      name="role-content-status"
                      className="field-select"
                      value={selectedRole.contentStatus}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "contentStatus",
                          event.currentTarget.value as ContentStatus
                        )
                      }
                    >
                      {contentStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Review status</span>
                    <select
                      name="role-review-status"
                      className="field-select"
                      value={selectedRole.reviewStatus}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "reviewStatus",
                          event.currentTarget.value as ReviewStatus
                        )
                      }
                    >
                      {reviewStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Last reviewed</span>
                    <Input
                      name="role-last-reviewed"
                      autoComplete="off"
                      type="date"
                      value={selectedRole.lastReviewedAt ?? ""}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "lastReviewedAt",
                          event.currentTarget.value || null
                        )
                      }
                    />
                  </label>
                </div>

              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Select a piece family and role to review it in detail.
              </div>
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
