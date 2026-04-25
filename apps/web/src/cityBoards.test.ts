import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCityBoardDefinition,
  saveCityBoardDraftToSupabase
} from "./cityBoards";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn()
}));

vi.mock("./lib/supabase", () => ({
  hasSupabaseConfig: true,
  getSupabaseClient: () => ({
    rpc: rpcMock
  })
}));

describe("cityBoards Supabase adapters", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("saves remote city drafts through the transactional RPC", async () => {
    const definition = getCityBoardDefinition("edinburgh");
    expect(definition).toBeTruthy();
    if (!definition) {
      return;
    }

    rpcMock.mockResolvedValue({
      data: {
        city_edition_id: "edinburgh-modern",
        version_id: "version-1",
        version_number: 7
      },
      error: null
    });

    const result = await saveCityBoardDraftToSupabase(definition, definition.board);

    expect(rpcMock).toHaveBeenCalledWith("save_city_draft_version", {
      p_city_edition_id: "edinburgh-modern",
      p_payload: definition.board,
      p_content_status: definition.board.contentStatus,
      p_review_status: definition.board.reviewStatus,
      p_review_notes: definition.board.reviewNotes,
      p_last_reviewed_at: definition.board.lastReviewedAt,
      p_notes: "Draft saved from Edinburgh editor"
    });
    expect(result).toEqual({
      cityEditionId: "edinburgh-modern",
      versionId: "version-1",
      versionNumber: 7
    });
  });

  it("surfaces remote draft save RPC failures", async () => {
    const definition = getCityBoardDefinition("edinburgh");
    expect(definition).toBeTruthy();
    if (!definition) {
      return;
    }

    rpcMock.mockResolvedValue({
      data: null,
      error: new Error("Author role required to save city drafts.")
    });

    await expect(saveCityBoardDraftToSupabase(definition, definition.board)).rejects.toThrow(
      "Author role required to save city drafts."
    );
  });
});
