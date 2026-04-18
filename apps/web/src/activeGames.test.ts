import { describe, expect, it } from "vitest";
import { getSupabaseMovePromotion } from "./activeGames";

describe("activeGames append move helpers", () => {
  it("maps chess promotion pieces to Supabase move notation", () => {
    expect(getSupabaseMovePromotion("queen")).toBe("q");
    expect(getSupabaseMovePromotion("rook")).toBe("r");
    expect(getSupabaseMovePromotion("bishop")).toBe("b");
    expect(getSupabaseMovePromotion("knight")).toBe("n");
  });

  it("omits non-promotion pieces from Supabase move payloads", () => {
    expect(getSupabaseMovePromotion(null)).toBeNull();
    expect(getSupabaseMovePromotion("pawn")).toBeNull();
    expect(getSupabaseMovePromotion("king")).toBeNull();
  });
});
