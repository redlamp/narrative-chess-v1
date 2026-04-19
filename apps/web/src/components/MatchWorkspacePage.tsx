import { lazy, type ReactNode } from "react";
import type {
  CharacterSummary,
  CityBoard,
  GameSnapshot,
  MoveRecord,
  PieceState,
  ReferenceGame,
  Square
} from "@narrative-chess/content-schema";
import type { NarrativeTonePreset } from "@narrative-chess/narrative-engine";
import type { AppSettings } from "../appSettings";
import type { AnimatedPieceFrame } from "../chessMotion";
import type { SavedMatchRecord } from "../savedMatches";
import { Board } from "./Board";
import { BoardPanel } from "./BoardPanel";
import { CharacterDetailPanel } from "./CharacterDetailPanel";
import { DeferredMapLibreSurface } from "./DeferredMapLibreSurface";
import { IndexedWorkspace, type LayoutNavigation } from "./IndexedWorkspace";
import { MatchHistoryPanel } from "./MatchHistoryPanel";
import { Panel } from "./Panel";
import { RecentGamesPanel } from "./RecentGamesPanel";
import { StoryBeatSection } from "./StoryBeatSection";
import { StoryCityTileSection } from "./StoryCityTileSection";
import { StoryToneSection } from "./StoryToneSection";

const CityMapLibrePanel = lazy(() =>
  import("./CityMapLibrePanel").then((module) => ({ default: module.CityMapLibrePanel }))
);

type MatchWorkspacePageProps = {
  layoutMode: boolean;
  showLayoutGrid: boolean;
  layoutNavigation: LayoutNavigation;
  onToggleLayoutMode: () => void;
  onToggleLayoutGrid: (checked: boolean) => void;
  playHeaderDistrict: CityBoard["districts"][number] | null;
  showDistrictLabels: boolean;
  onShowDistrictLabelsChange: (value: boolean) => void;
  snapshot: GameSnapshot;
  boardSquares: Array<{
    square: Square;
    occupant: PieceState | null;
    isLight: boolean;
  }>;
  selectedSquare: Square | null;
  hoveredSquare: Square | null;
  inspectedSquare: Square | null;
  legalMoves: Square[];
  defaultViewMode: AppSettings["defaultViewMode"];
  playDistrictsBySquare: Map<Square, CityBoard["districts"][number]>;
  animatedPieces: AnimatedPieceFrame[];
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square | null) => void;
  playMapCityMenu: ReactNode;
  playHeaderActions: ReactNode;
  playHeaderDistrictBadge: ReactNode;
  playCityBoard: CityBoard;
  selectedDistrict: CityBoard["districts"][number] | null;
  focusedDistrict: CityBoard["districts"][number] | null;
  lastMoveDistrict: CityBoard["districts"][number] | null;
  lastMove: MoveRecord | null;
  selectedMove: MoveRecord | null;
  selectedEvent: Parameters<typeof StoryBeatSection>[0]["selectedEvent"];
  focusedPiece: PieceState | null;
  focusedCharacter: CharacterSummary | null;
  focusedCharacterMoments: Parameters<typeof CharacterDetailPanel>[0]["focusedCharacterMoments"];
  storyFocusedSquare: Square | null;
  moveHistory: MoveRecord[];
  showRecentCharacterActions: boolean;
  tonePreset: NarrativeTonePreset;
  onToneChange: (tonePreset: NarrativeTonePreset) => void;
  savedMatches: SavedMatchRecord[];
  selectedSavedMatchId: string | null;
  onSelectSavedMatch: (savedMatchId: string | null) => void;
  onLoadSavedMatch: () => void;
  onDeleteSelectedSavedMatch: () => void;
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (referenceGameId: string) => void;
  onLoadReferenceGame: () => void;
  accountEmail: string | null;
  accountUsername: string | null;
  multiplayerCityOptions: Array<{
    id: string;
    label: string;
  }>;
  activeMultiplayerGameId: string | null;
  onLoadActiveGame: (gameId: string) => void;
  selectedPly: number;
  totalPlies: number;
  isHistoryPlaying: boolean;
  onHistoryJumpToStart: () => void;
  onHistoryStepBackward: () => void;
  onToggleHistoryPlayback: () => void;
  onHistoryStepForward: () => void;
  onHistoryJumpToEnd: () => void;
  onHistorySelectPly: (ply: number) => void;
};

export function MatchWorkspacePage({
  layoutMode,
  showLayoutGrid,
  layoutNavigation,
  onToggleLayoutMode,
  onToggleLayoutGrid,
  playHeaderDistrict,
  showDistrictLabels,
  onShowDistrictLabelsChange,
  snapshot,
  boardSquares,
  selectedSquare,
  hoveredSquare,
  inspectedSquare,
  legalMoves,
  defaultViewMode,
  playDistrictsBySquare,
  animatedPieces,
  onSquareClick,
  onSquareHover,
  playMapCityMenu,
  playHeaderActions,
  playHeaderDistrictBadge,
  playCityBoard,
  selectedDistrict,
  focusedDistrict,
  lastMoveDistrict,
  lastMove,
  selectedMove,
  selectedEvent,
  focusedPiece,
  focusedCharacter,
  focusedCharacterMoments,
  storyFocusedSquare,
  moveHistory,
  showRecentCharacterActions,
  tonePreset,
  onToneChange,
  savedMatches,
  selectedSavedMatchId,
  onSelectSavedMatch,
  onLoadSavedMatch,
  onDeleteSelectedSavedMatch,
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame,
  accountEmail,
  accountUsername,
  multiplayerCityOptions,
  activeMultiplayerGameId,
  onLoadActiveGame,
  selectedPly,
  totalPlies,
  isHistoryPlaying,
  onHistoryJumpToStart,
  onHistoryStepBackward,
  onToggleHistoryPlayback,
  onHistoryStepForward,
  onHistoryJumpToEnd,
  onHistorySelectPly
}: MatchWorkspacePageProps) {
  return (
    <IndexedWorkspace
      className="match-workspace"
      layoutMode={layoutMode}
      layoutKey="match-workspace"
      layoutVariant="match"
      showLayoutGrid={showLayoutGrid}
      layoutNavigation={layoutNavigation}
      onToggleLayoutMode={onToggleLayoutMode}
      onToggleLayoutGrid={onToggleLayoutGrid}
      panels={[
        {
          id: "board",
          label: "Board",
          content: (
            <BoardPanel
              districtName={playHeaderDistrict?.name ?? null}
              districtSquare={playHeaderDistrict?.square ?? null}
              showDistrictLabels={showDistrictLabels}
              onShowDistrictLabelsChange={onShowDistrictLabelsChange}
              showPieces={true}
              onShowPiecesChange={null}
              layoutMode={layoutMode}
            >
              <Board
                snapshot={snapshot}
                cells={boardSquares}
                selectedSquare={selectedSquare}
                hoveredSquare={hoveredSquare}
                inspectedSquare={inspectedSquare}
                legalMoves={legalMoves}
                viewMode={defaultViewMode}
                districtsBySquare={playDistrictsBySquare}
                showCoordinates={true}
                showDistrictLabels={showDistrictLabels}
                animatedPieces={animatedPieces}
                onSquareClick={onSquareClick}
                onSquareHover={onSquareHover}
                onSquareLeave={() => onSquareHover(null)}
              />
            </BoardPanel>
          )
        },
        {
          id: "moves",
          label: "Match History",
          content: (
            <MatchHistoryPanel
              moves={moveHistory}
              characters={snapshot.characters}
              selectedPly={selectedPly}
              totalPlies={totalPlies}
              onJumpToStart={onHistoryJumpToStart}
              onStepBackward={onHistoryStepBackward}
              isPlaying={isHistoryPlaying}
              onTogglePlayback={onToggleHistoryPlayback}
              onStepForward={onHistoryStepForward}
              onJumpToEnd={onHistoryJumpToEnd}
              onSelectPly={onHistorySelectPly}
            />
          )
        },
        {
          id: "city-map-maplibre",
          label: "Map",
          content: (
            <Panel title={playMapCityMenu} action={playHeaderActions}>
              <DeferredMapLibreSurface
                title="City map"
                description="Street and satellite view for districts and pieces."
                loadingLabel="Loading city map..."
              >
                <CityMapLibrePanel
                  cityBoard={playCityBoard}
                  pieces={animatedPieces}
                  selectedDistrict={selectedDistrict}
                  hoveredDistrict={hoveredSquare ? focusedDistrict : null}
                  lastMoveDistrict={lastMoveDistrict}
                  lastMove={lastMove}
                  onPieceSquareHover={onSquareHover}
                />
              </DeferredMapLibreSurface>
            </Panel>
          )
        },
        {
          id: "story-beat",
          label: "Story Beat",
          content: (
            <Panel title="Story Beat">
              <StoryBeatSection
                selectedMove={selectedMove}
                selectedEvent={selectedEvent}
                showLabel={false}
              />
            </Panel>
          )
        },
        {
          id: "story-tile",
          label: "District",
          content: (
            <Panel title="District" action={playHeaderDistrictBadge}>
              <StoryCityTileSection
                cityBoard={playCityBoard}
                focusedDistrict={focusedDistrict}
                selectedDistrict={selectedDistrict}
                focusedPiece={focusedPiece}
                focusedCharacter={focusedCharacter}
                isHoverPreview={Boolean(hoveredSquare)}
                showLabel={false}
              />
            </Panel>
          )
        },
        {
          id: "story-character",
          label: "Character",
          content: (
            <CharacterDetailPanel
              focusedSquare={storyFocusedSquare}
              focusedPiece={focusedPiece}
              focusedCharacter={focusedCharacter}
              focusedCharacterMoments={focusedCharacterMoments}
              moveHistory={moveHistory}
              showRecentCharacterActions={showRecentCharacterActions}
            />
          )
        },
        {
          id: "story-tone",
          label: "Narrative Tone",
          content: (
            <Panel
              title="Narrative Tone"
              action={
                <StoryToneSection
                  tonePreset={tonePreset}
                  onToneChange={onToneChange}
                  showLabel={false}
                  inline
                />
              }
            >
              <p className="muted">Set the narration style for generated beats and summaries.</p>
            </Panel>
          )
        },
        {
          id: "recent-games",
          label: "Games",
          content: (
            <Panel title="Games">
              <RecentGamesPanel
                savedMatches={savedMatches}
                selectedSavedMatchId={selectedSavedMatchId}
                onSelectSavedMatch={onSelectSavedMatch}
                onLoadSavedMatch={onLoadSavedMatch}
                onDeleteSelectedSavedMatch={onDeleteSelectedSavedMatch}
                referenceGames={referenceGames}
                selectedReferenceGameId={selectedReferenceGameId}
                onSelectReferenceGame={onSelectReferenceGame}
                onLoadReferenceGame={onLoadReferenceGame}
                accountEmail={accountEmail}
                accountUsername={accountUsername}
                multiplayerCityOptions={multiplayerCityOptions}
                activeMultiplayerGameId={activeMultiplayerGameId}
                onLoadActiveGame={onLoadActiveGame}
              />
            </Panel>
          )
        }
      ]}
    />
  );
}
