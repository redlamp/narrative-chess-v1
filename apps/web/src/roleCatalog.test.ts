import { beforeEach, describe, expect, it } from "vitest";
import {
  addRoleCatalogEntry,
  duplicateRoleCatalogEntry,
  getDefaultRoleCatalog,
  getRolePoolsOverride,
  listRoleCatalog,
  removeRoleCatalogEntry,
  saveRoleCatalog,
  updateRoleCatalogEntry
} from "./roleCatalog";

describe("roleCatalog", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates the richer catalog from the checked-in defaults", () => {
    const roleCatalog = getDefaultRoleCatalog();

    expect(roleCatalog.length).toBeGreaterThan(10);
    expect(roleCatalog[0]?.summary).toBeTruthy();
    expect(roleCatalog[0]?.traits.length).toBeGreaterThan(0);
  });

  it("keeps backward compatibility with the earlier piece-to-string[] storage format", () => {
    window.localStorage.setItem(
      "narrative-chess:role-catalog",
      JSON.stringify({
        pawn: ["runner", "porter"],
        rook: ["sentinel"],
        knight: ["courier"],
        bishop: ["mediator"],
        queen: ["strategist"],
        king: ["figurehead"]
      })
    );

    const roleCatalog = listRoleCatalog();
    const rolePools = getRolePoolsOverride(roleCatalog);

    expect(rolePools.pawn).toEqual(["runner", "porter"]);
    expect(rolePools.queen).toEqual(["strategist"]);
  });

  it("updates role details and projects them back to piece role pools", () => {
    const initialCatalog = getDefaultRoleCatalog();
    const targetRole = initialCatalog[0];
    if (!targetRole) {
      throw new Error("Expected a default role.");
    }

    const nextCatalog = saveRoleCatalog(
      updateRoleCatalogEntry({
        roleCatalog: initialCatalog,
        roleId: targetRole.id,
        field: "name",
        value: "harbor runner"
      })
    );

    expect(getRolePoolsOverride(nextCatalog)[targetRole.pieceKind]).toContain("harbor runner");
  });

  it("can add, duplicate, and remove entries without breaking the catalog", () => {
    const initialCatalog = getDefaultRoleCatalog();
    const withNewEntry = addRoleCatalogEntry({
      roleCatalog: initialCatalog,
      pieceKind: "bishop"
    });
    const newEntry = withNewEntry.at(-1);
    if (!newEntry) {
      throw new Error("Expected an added role entry.");
    }

    const duplicatedCatalog = duplicateRoleCatalogEntry({
      roleCatalog: withNewEntry,
      roleId: newEntry.id
    });
    expect(duplicatedCatalog.length).toBe(withNewEntry.length + 1);

    const trimmedCatalog = removeRoleCatalogEntry({
      roleCatalog: duplicatedCatalog,
      roleId: newEntry.id
    });
    expect(trimmedCatalog.length).toBe(duplicatedCatalog.length - 1);
  });
});
