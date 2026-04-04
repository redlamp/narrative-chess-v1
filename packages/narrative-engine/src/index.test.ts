import { describe, expect, it } from "vitest";
import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import {
  createInitialCharacterRoster,
  createNarrativeHistory,
  createNarrativeEvent,
  getCharacterEventHistory
} from "./index";
import type {
  CharacterSummary,
  MoveRecord
} from "@narrative-chess/content-schema";
import { cityBoardSchema } from "@narrative-chess/content-schema";

const edinburghBoard = cityBoardSchema.parse(edinburghBoardData);

function makeActor(overrides: Partial<CharacterSummary> = {}): CharacterSummary {
  return {
    id: "white-pawn-a",
    pieceId: "white-pawn-a",
    side: "white",
    pieceKind: "pawn",
    fullName: "Avery Ash",
    role: "runner",
    districtOfOrigin: "North Gate",
    faction: "Harbor Union",
    traits: ["steady", "alert", "patient", "resourceful"],
    verbs: ["patrols", "threads", "presses", "guards"],
    oneLineDescription: "A runner from North Gate who moves with purpose.",
    generationSource: "curated-template-data",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "reviewed",
    reviewNotes: null,
    lastReviewedAt: null,
    ...overrides
  };
}

function makeMove(overrides: Partial<MoveRecord> = {}): MoveRecord {
  return {
    id: "move-1",
    moveNumber: 1,
    side: "white",
    from: "e2",
    to: "e4",
    san: "e4",
    pieceId: "white-pawn-e",
    pieceKind: "pawn",
    capturedPieceId: null,
    promotion: null,
    isCheck: false,
    isCheckmate: false,
    isStalemate: false,
    fenAfter: "stub",
    ...overrides
  };
}

describe("createInitialCharacterRoster", () => {
  it("creates a stable 32-piece roster with lightweight summaries", () => {
    const roster = createInitialCharacterRoster();
    const entries = Object.values(roster);

    expect(entries).toHaveLength(32);
    expect(roster["white-king"]?.fullName).toBeDefined();
    expect(roster["black-queen"]?.faction).toBe("Iron Accord");
    expect(new Set(entries.map((character) => character.fullName)).size).toBe(32);

    for (const character of entries) {
      expect(character.traits.length).toBeGreaterThanOrEqual(4);
      expect(character.traits.length).toBeLessThanOrEqual(6);
      expect(character.verbs.length).toBeGreaterThanOrEqual(4);
      expect(character.verbs.length).toBeLessThanOrEqual(6);
      expect(character.reviewStatus).toBe("reviewed");
    }
  });

  it("uses city board districts and descriptors when a board is provided", () => {
    const roster = createInitialCharacterRoster({
      cityBoard: edinburghBoard
    });

    expect(roster["white-king"]?.districtOfOrigin).toBe("Alnwickhill");
    expect(roster["black-queen"]?.districtOfOrigin).toBe("Trinity");
    expect(roster["black-pawn-h"]?.traits).toContain("watchful");
    expect(roster["white-queen"]?.oneLineDescription).toContain("Kaimes");
    expect(roster["white-queen"]?.generationSource).toContain("reviewed city board");
  });

  it("accepts role pool overrides for editable role catalogs", () => {
    const roster = createInitialCharacterRoster({
      cityBoard: edinburghBoard,
      rolePoolsOverride: {
        queen: ["councillor"],
        knight: ["bike courier"]
      }
    });

    expect(roster["white-queen"]?.role).toBe("councillor");
    expect(roster["black-knight-b"]?.role).toBe("bike courier");
  });
});

describe("createNarrativeEvent", () => {
  it("builds a standard move event", () => {
    const event = createNarrativeEvent({
      move: makeMove(),
      actor: makeActor()
    });

    expect(event.eventType).toBe("move");
    expect(event.headline).toContain("Avery Ash");
    expect(event.detail).toContain("e2");
    expect(event.detail).toContain("e4");
  });

  it("uses capture when a target piece is present", () => {
    const event = createNarrativeEvent({
      move: makeMove({
        capturedPieceId: "black-pawn-e"
      }),
      actor: makeActor(),
      target: makeActor({
        id: "black-pawn-e",
        pieceId: "black-pawn-e",
        side: "black",
        pieceKind: "pawn",
        fullName: "Morgan Vale",
        faction: "Iron Accord"
      })
    });

    expect(event.eventType).toBe("capture");
    expect(event.detail).toContain("Morgan Vale");
  });

  it("varies capture narration by tone and remembers prior action counts", () => {
    const actor = makeActor();
    const target = makeActor({
      id: "black-pawn-e",
      pieceId: "black-pawn-e",
      side: "black",
      pieceKind: "pawn",
      fullName: "Morgan Vale",
      faction: "Iron Accord"
    });
    const priorCapture = createNarrativeEvent({
      move: makeMove({
        id: "move-1a",
        moveNumber: 1,
        capturedPieceId: "black-pawn-d",
        to: "d5"
      }),
      actor,
      target: makeActor({
        id: "black-pawn-d",
        pieceId: "black-pawn-d",
        side: "black",
        pieceKind: "pawn",
        fullName: "Taylor North",
        faction: "Iron Accord"
      })
    });
    const grounded = createNarrativeEvent({
      move: makeMove({
        id: "move-2",
        moveNumber: 2,
        capturedPieceId: "black-pawn-e"
      }),
      actor,
      target,
      priorEvents: [priorCapture],
      tonePreset: "grounded"
    });
    const noir = createNarrativeEvent({
      move: makeMove({
        id: "move-2b",
        moveNumber: 2,
        capturedPieceId: "black-pawn-e"
      }),
      actor,
      target,
      priorEvents: [priorCapture],
      tonePreset: "civic-noir"
    });

    expect(grounded.detail).toContain("2nd decisive removal");
    expect(noir.detail).toContain("The board is now keeping count");
    expect(grounded.detail).not.toBe(noir.detail);
  });

  it("prioritizes checkmate and promotion state correctly", () => {
    const promotionEvent = createNarrativeEvent({
      move: makeMove({
        id: "move-7",
        moveNumber: 7,
        to: "a8",
        promotion: "queen"
      }),
      actor: makeActor({
        pieceId: "white-pawn-a",
        id: "white-pawn-a",
        oneLineDescription: "A runner ready to rise."
      })
    });

    const checkmateEvent = createNarrativeEvent({
      move: makeMove({
        id: "move-8",
        moveNumber: 8,
        isCheckmate: true
      }),
      actor: makeActor()
    });

    const stalemateEvent = createNarrativeEvent({
      move: makeMove({
        id: "move-9",
        moveNumber: 9,
        isStalemate: true
      }),
      actor: makeActor()
    });

    const checkEvent = createNarrativeEvent({
      move: makeMove({
        id: "move-10",
        moveNumber: 10,
        isCheck: true
      }),
      actor: makeActor()
    });

    expect(promotionEvent.eventType).toBe("promotion");
    expect(promotionEvent.detail).toContain("queen");
    expect(checkmateEvent.eventType).toBe("checkmate");
    expect(stalemateEvent.eventType).toBe("stalemate");
    expect(checkEvent.eventType).toBe("check");
  });

  it("builds a narrative history for a move list", () => {
    const roster = createInitialCharacterRoster();
    const events = createNarrativeHistory({
      characters: roster,
      moves: [
        makeMove({
          id: "move-1",
          moveNumber: 1,
          pieceId: "white-pawn-e",
          from: "e2",
          to: "e4"
        }),
        makeMove({
          id: "move-2",
          moveNumber: 2,
          side: "black",
          pieceId: "black-pawn-e",
          from: "e7",
          to: "e5"
        })
      ]
    });

    expect(events).toHaveLength(2);
    expect(events[0].moveId).toBe("move-1");
    expect(events[1].moveNumber).toBe(2);
  });

  it("returns recent character events for UI memory hooks", () => {
    const actor = makeActor({
      pieceId: "white-pawn-e",
      id: "white-pawn-e"
    });
    const events = createNarrativeHistory({
      characters: {
        "white-pawn-e": actor,
        "black-pawn-e": makeActor({
          id: "black-pawn-e",
          pieceId: "black-pawn-e",
          side: "black",
          fullName: "Morgan Vale",
          faction: "Iron Accord"
        })
      },
      moves: [
        makeMove({
          id: "move-1",
          moveNumber: 1,
          pieceId: "white-pawn-e"
        }),
        makeMove({
          id: "move-2",
          moveNumber: 2,
          pieceId: "white-pawn-e",
          capturedPieceId: "black-pawn-e",
          to: "e5"
        })
      ],
      tonePreset: "dark-comedy"
    });

    const recentEvents = getCharacterEventHistory({
      events,
      pieceId: "white-pawn-e",
      limit: 2
    });

    expect(recentEvents).toHaveLength(2);
    expect(recentEvents[0]?.moveNumber).toBe(2);
    expect(recentEvents[1]?.moveNumber).toBe(1);
  });
});
