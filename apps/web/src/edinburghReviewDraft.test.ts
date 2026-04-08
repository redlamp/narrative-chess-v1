import { beforeEach, describe, expect, it } from "vitest";
import { edinburghBoard } from "./edinburghBoard";
import {
  buildEdinburghBoardValidation,
  hydrateEdinburghBoardDraft,
  listEdinburghBoardDraft,
  resetEdinburghBoardDraft,
  saveEdinburghBoardDraft
} from "./edinburghReviewState";

describe("edinburghReviewDraft", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("hydrates partial saved data over the bundled Edinburgh board", () => {
    const hydrated = hydrateEdinburghBoardDraft(
      {
        summary: "Edited city summary",
        districts: [
          {
            id: "edinburgh-cramond",
            square: "a8",
            name: "Edited Cramond",
            locality: "North West",
            descriptors: ["coastal"],
            landmarks: ["Cramond foreshore"],
            dayProfile: "Edited day profile",
            nightProfile: "Edited night profile",
            toneCues: ["reflective"],
            mapAnchor: {
              longitude: -3.3,
              latitude: 55.97
            },
            contentStatus: "authored",
            reviewStatus: "needs review",
            reviewNotes: "Needs another pass",
            lastReviewedAt: "2026-04-05"
          }
        ]
      },
      edinburghBoard
    );

    expect(hydrated.summary).toBe("Edited city summary");
    expect(hydrated.districts[0]?.name).toBe("Edited Cramond");
    expect(hydrated.districts[0]?.mapAnchor).toEqual({
      longitude: -3.3,
      latitude: 55.97
    });
    expect(hydrated.districts[1]?.name).toBe(edinburghBoard.districts[1]?.name);
  });

  it("round-trips the browser draft through localStorage", () => {
    const nextDraft = hydrateEdinburghBoardDraft(
      {
        reviewNotes: "Local working note"
      },
      edinburghBoard
    );

    saveEdinburghBoardDraft(nextDraft);

    expect(listEdinburghBoardDraft().reviewNotes).toBe("Local working note");
    expect(resetEdinburghBoardDraft().reviewNotes).toBe(edinburghBoard.reviewNotes);
  });

  it("reports schema validation issues for invalid district edits", () => {
    const invalidDraft = hydrateEdinburghBoardDraft({}, edinburghBoard);
    invalidDraft.districts[0] = {
      ...invalidDraft.districts[0],
      square: "z9" as (typeof invalidDraft.districts)[number]["square"]
    };

    const validation = buildEdinburghBoardValidation(invalidDraft);

    expect(validation.isValid).toBe(false);
    expect(validation.issues.some((issue) => issue.includes("districts.0.square"))).toBe(true);
  });
});
