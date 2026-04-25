import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CityBoard, PieceSide, Square } from "@narrative-chess/content-schema";
import { getCityBoardDefinition } from "./cityBoards";
import type { PlayCityContext } from "./playCityContext";
import { getDefaultRoleCatalog } from "./roleCatalog";
import { useChessMatch } from "./hooks/useChessMatch";

vi.mock("./auth", () => ({
  subscribeToAuthChanges: () => () => undefined
}));

vi.mock("./savedMatchesCloud", () => ({
  deleteSavedMatchFromSupabase: vi.fn(async () => undefined),
  listSavedMatchesFromSupabase: vi.fn(() => new Promise<null>(() => undefined)),
  saveSavedMatchToSupabase: vi.fn(async () => null)
}));

type HookResult = ReturnType<typeof useChessMatch>;

type HarnessProps = {
  localMoveSide?: PieceSide | null;
  cityBoard?: CityBoard;
};

const testRoleCatalog = getDefaultRoleCatalog();
const edinburghBoard = getCityBoardDefinition("edinburgh")!.board;
const londonBoard = getCityBoardDefinition("london")!.board;

let latestHookResult: HookResult | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function createPlayCityContext(cityBoard: CityBoard): PlayCityContext {
  return {
    boardId: cityBoard.id,
    displayLabel: cityBoard.name,
    source: "fallback",
    publishedEditionId: null,
    previewMode: "published",
    board: cityBoard
  };
}

function Harness({ localMoveSide, cityBoard = edinburghBoard }: HarnessProps) {
  latestHookResult = useChessMatch({
    roleCatalog: testRoleCatalog,
    playCityContext: createPlayCityContext(cityBoard),
    localMoveSide
  });

  return null;
}

function currentHook() {
  if (!latestHookResult) {
    throw new Error("Hook was not rendered.");
  }

  return latestHookResult;
}

function renderChessHook(props: HarnessProps) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<Harness {...props} />);
  });

  return {
    current: currentHook,
    rerender(nextProps: HarnessProps) {
      act(() => {
        root?.render(<Harness {...nextProps} />);
      });
    }
  };
}

function clickSquare(square: Square) {
  act(() => {
    currentHook().handleSquareClick(square);
  });
}

describe("useChessMatch multiplayer side enforcement", () => {
  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    latestHookResult = null;
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
    latestHookResult = null;
  });

  it("does not select or show moves for the opponent side", () => {
    renderChessHook({ localMoveSide: "white" });

    clickSquare("e7");

    expect(currentHook().selectedSquare).toBeNull();
    expect(currentHook().legalMoves).toEqual([]);
  });

  it("allows moves only for the configured player side", () => {
    const hook = renderChessHook({ localMoveSide: "white" });

    clickSquare("e2");

    expect(currentHook().selectedSquare).toBe("e2");
    expect(currentHook().legalMoves).toContain("e4");

    clickSquare("e4");

    expect(currentHook().snapshot.moveHistory).toHaveLength(1);
    expect(currentHook().snapshot.moveHistory[0]).toMatchObject({
      side: "white",
      from: "e2",
      to: "e4"
    });

    hook.rerender({ localMoveSide: "black" });
    clickSquare("e7");

    expect(currentHook().selectedSquare).toBe("e7");
    expect(currentHook().legalMoves).toContain("e5");
  });

  it("locks all piece selection when no local side may move", () => {
    renderChessHook({ localMoveSide: null });

    clickSquare("e2");
    expect(currentHook().selectedSquare).toBeNull();

    clickSquare("e7");
    expect(currentHook().selectedSquare).toBeNull();
  });

  it("rebuilds character origins from the active play city", () => {
    const hook = renderChessHook({ cityBoard: edinburghBoard });
    const edinburghQueenDistrict = edinburghBoard.districts.find((district) => district.square === "d1")?.name;
    const londonQueenDistrict = londonBoard.districts.find((district) => district.square === "d1")?.name;

    expect(currentHook().snapshot.characters["white-queen"]?.districtOfOrigin).toBe(edinburghQueenDistrict);

    hook.rerender({ cityBoard: londonBoard });

    expect(currentHook().snapshot.characters["white-queen"]?.districtOfOrigin).toBe(londonQueenDistrict);
    expect(londonQueenDistrict).not.toBe(edinburghQueenDistrict);
  });
});
