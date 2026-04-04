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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { getPieceGlyph, getPieceKindLabel } from "../chessPresentation";
import {
  findRoleCatalogEntry,
  groupRoleCatalogByPieceKind,
  pieceKinds,
  type RoleCatalog
} from "../roleCatalog";
import { IndexedWorkspace } from "./IndexedWorkspace";

type RoleCatalogPageProps = {
  roleCatalog: RoleCatalog;
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
};

const contentStatusOptions = ["empty", "procedural", "authored"] as const;
const reviewStatusOptions = ["empty", "needs review", "reviewed", "approved"] as const;

function formatListValue(values: string[]) {
  return values.join("\n");
}

function parseListValue(value: string) {
  return value
    .split(/\r?\n|,/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function roleMatchesQuery(
  role: RoleCatalog[number],
  query: string
) {
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

export function RoleCatalogPage({
  roleCatalog,
  onRoleCatalogChange,
  onRoleCatalogReset,
  onRoleCatalogAdd,
  onRoleCatalogDuplicate,
  onRoleCatalogRemove
}: RoleCatalogPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState(roleCatalog[0]?.id ?? "");
  const groupedRoles = useMemo(() => groupRoleCatalogByPieceKind(roleCatalog), [roleCatalog]);
  const filteredRoles = useMemo(
    () => roleCatalog.filter((role) => roleMatchesQuery(role, searchQuery)),
    [roleCatalog, searchQuery]
  );
  const selectedRole =
    findRoleCatalogEntry(roleCatalog, selectedRoleId) ??
    filteredRoles[0] ??
    roleCatalog[0] ??
    null;

  useEffect(() => {
    if (!selectedRole || selectedRole.id === selectedRoleId) {
      return;
    }

    setSelectedRoleId(selectedRole.id);
  }, [selectedRole, selectedRoleId]);

  return (
    <IndexedWorkspace
      intro={
        <Card>
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Role Catalog</Badge>
              <Badge variant="outline">{roleCatalog.length} editable roles</Badge>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid gap-2">
                <CardTitle className="text-3xl tracking-tight">Piece roles and job definitions</CardTitle>
                <CardDescription className="max-w-4xl text-sm leading-6">
                  Browse the full role list, select one entry, and edit the details that shape the
                  lightweight character roster. Changes save locally and feed back into new match
                  rosters immediately.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => onRoleCatalogAdd(selectedRole?.pieceKind)}>
                  Add role
                </Button>
                <Button type="button" variant="outline" onClick={onRoleCatalogReset}>
                  Reset defaults
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {pieceKinds.map((pieceKind) => (
                <Badge key={pieceKind} variant="outline">
                  {getPieceKindLabel(pieceKind)}: {groupedRoles[pieceKind].length}
                </Badge>
              ))}
            </div>
          </CardHeader>
        </Card>
      }
      index={
        <Card className="min-h-[720px]">
          <CardHeader className="gap-4">
            <div className="grid gap-2">
              <CardTitle>Role index</CardTitle>
              <CardDescription>
                Search the catalog and jump directly into one role definition.
              </CardDescription>
            </div>
            <Input
              name="role-search"
              autoComplete="off"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
              placeholder="Search by role, piece type, trait, or verb"
              aria-label="Search piece roles"
            />
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="h-[560px] rounded-lg border">
              <div className="grid gap-2 p-3">
                {filteredRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRoleId(role.id)}
                    className={[
                      "grid gap-2 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      role.id === selectedRole?.id
                        ? "border-foreground/15 bg-muted"
                        : "bg-background hover:bg-muted/50"
                    ].join(" ")}
                    aria-pressed={role.id === selectedRole?.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span aria-hidden="true" className="text-lg leading-none">
                          {getPieceGlyph({ side: "white", kind: role.pieceKind })}
                        </span>
                        <span className="font-medium">{role.name}</span>
                      </div>
                      <Badge variant="outline">{getPieceKindLabel(role.pieceKind)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{role.summary}</p>
                  </button>
                ))}
                {!filteredRoles.length ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    No roles matched that search.
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      }
      detail={
        <Card>
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
          <CardContent className="grid gap-4">
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
                    Delete role
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
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Traits</span>
                    <Textarea
                      name="role-traits"
                      autoComplete="off"
                      value={formatListValue(selectedRole.traits)}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "traits",
                          parseListValue(event.currentTarget.value)
                        )
                      }
                      rows={5}
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-medium">Verbs</span>
                    <Textarea
                      name="role-verbs"
                      autoComplete="off"
                      value={formatListValue(selectedRole.verbs)}
                      onChange={(event) =>
                        onRoleCatalogChange(
                          selectedRole.id,
                          "verbs",
                          parseListValue(event.currentTarget.value)
                        )
                      }
                      rows={5}
                    />
                  </label>
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

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Trait preview</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRole.traits.length ? (
                        selectedRole.traits.map((trait) => (
                          <Badge key={trait} variant="secondary">
                            {trait}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Add traits to shape this role.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-4">
                    <p className="text-sm font-medium">Verb preview</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedRole.verbs.length ? (
                        selectedRole.verbs.map((verb) => (
                          <Badge key={verb} variant="outline">
                            {verb}
                          </Badge>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Add verbs to shape this role.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Select a role from the left to review it in detail.
              </div>
            )}
          </CardContent>
        </Card>
      }
    />
  );
}
