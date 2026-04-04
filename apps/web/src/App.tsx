import { useState } from "react";
import { getPieceAtSquare } from "@narrative-chess/game-core";
import { getCharacterEventHistory } from "@narrative-chess/narrative-engine";
import type { PieceKind, Square } from "@narrative-chess/content-schema";
import { edinburghDistrictsBySquare, getDistrictForSquare } from "./edinburghBoard";
import { getPieceDisplayName, getPieceGlyph, getPieceKindLabel } from "./chessPresentation";
import { referenceGames } from "./referenceGames";
import { Board } from "./components/Board";
import { Panel } from "./components/Panel";
import { RoleCatalogPage } from "./components/RoleCatalogPage";
import { StudyPanel } from "./components/StudyPanel";
import { useChessMatch } from "./hooks/useChessMatch";
import {
  listRoleCatalog,
  resetRoleCatalog,
  saveRoleCatalog,
  updateRoleCatalogEntry
} from "./roleCatalog";

type AppPage = "match" | "roles";

function statusLabel(isCheck: boolean, isCheckmate: boolean, isStalemate: boolean) {
  if (isCheckmate) {
    return "Checkmate";
  }

  if (isStalemate) {
    return "Stalemate";
  }

  if (isCheck) {
    return "Check";
  }

  return "In play";
}

function turnLabel(turn: "white" | "black") {
  return turn === "white" ? "White to move" : "Black to move";
}

function toneLabel(tonePreset: "grounded" | "civic-noir" | "dark-comedy") {
  switch (tonePreset) {
    case "civic-noir":
      return "Civic noir";
    case "dark-comedy":
      return "Dark comedy";
    default:
      return "Grounded";
  }
}

function formatSavedAt(savedAt: string) {
  return new Date(savedAt).toLocaleString();
}

export default function App() {
  const [page, setPage] = useState<AppPage>("match");
  const [selectedReferenceGameId, setSelectedReferenceGameId] = useState(referenceGames[0]?.id ?? "");
  const [pastedPgn, setPastedPgn] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "map">("board");
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [roleCatalog, setRoleCatalog] = useState(() => listRoleCatalog());
  const {
    snapshot,
    boardSquares,
    selectedSquare,
    savedMatches,
    legalMoves,
    canSave,
    canUndo,
    isStudyMode,
    tonePreset,
    studySession,
    canStepBackward,
    canStepForward,
    importError,
    lastMove,
    handleSquareClick,
    handleUndo,
    loadReferenceGame,
    loadPgnStudy,
    exitStudyMode,
    jumpToStart,
    stepBackward,
    stepForward,
    jumpToEnd,
    updateTonePreset,
    saveCurrentMatch,
    loadSavedMatch,
    removeSavedMatch
  } = useChessMatch({
    roleCatalog
  });

  const status = snapshot.status;
  const moveHistory = [...snapshot.moveHistory].reverse();
  const narrativeHistory = [...snapshot.eventHistory].reverse();
  const eventByMoveId = new Map(snapshot.eventHistory.map((event) => [event.moveId, event] as const));
  const moveById = new Map(snapshot.moveHistory.map((move) => [move.id, move] as const));
  const focusedSquare = hoveredSquare ?? selectedSquare ?? (lastMove?.to ?? null);
  const focusedDistrict = getDistrictForSquare(focusedSquare);
  const focusedPiece = focusedSquare ? getPieceAtSquare(snapshot, focusedSquare) : null;
  const focusedCharacter = focusedPiece ? snapshot.characters[focusedPiece.pieceId] ?? null : null;
  const focusedCharacterMoments = focusedCharacter
    ? getCharacterEventHistory({
        events: snapshot.eventHistory,
        pieceId: focusedCharacter.pieceId,
        limit: 3
      })
    : [];
  const selectedReferenceGame =
    referenceGames.find((game) => game.id === selectedReferenceGameId) ?? referenceGames[0] ?? null;

  const handleLoadReferenceGame = () => {
    if (!selectedReferenceGame) {
      return;
    }

    loadReferenceGame(selectedReferenceGame);
  };

  const handleImportPgn = () => {
    if (!pastedPgn.trim()) {
      return;
    }

    loadPgnStudy(pastedPgn);
  };

  const handleRoleCatalogChange = (pieceKind: PieceKind, value: string) => {
    setRoleCatalog((current) =>
      saveRoleCatalog(
        updateRoleCatalogEntry({
          roleCatalog: current,
          pieceKind,
          value
        })
      )
    );
  };

  const handleRoleCatalogReset = () => {
    setRoleCatalog(resetRoleCatalog());
  };

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--left" />
      <div className="app-shell__glow app-shell__glow--right" />

      <header className="app-header">
        <div className="app-header__brand">
          <div>
            <p className="hero__eyebrow">Narrative Chess</p>
            <h1>Narrative Chess</h1>
          </div>
          <div className="page-switcher">
            <button
              type="button"
              className={`button button--ghost ${page === "match" ? "button--active" : ""}`}
              onClick={() => setPage("match")}
            >
              Match
            </button>
            <button
              type="button"
              className={`button button--ghost ${page === "roles" ? "button--active" : ""}`}
              onClick={() => setPage("roles")}
            >
              Role Catalog
            </button>
          </div>
        </div>

        <div className="hero__status app-header__status">
          <div className="status-card">
            <span className="status-card__label">Turn</span>
            <span className="status-card__value">{turnLabel(status.turn)}</span>
          </div>
          <div className="status-card">
            <span className="status-card__label">State</span>
            <span className="status-card__value">{statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}</span>
          </div>
          <div className="status-card">
            <span className="status-card__label">Moves</span>
            <span className="status-card__value">{snapshot.moveHistory.length}</span>
          </div>
          <div className="status-card">
            <span className="status-card__label">Tone</span>
            <span className="status-card__value">{toneLabel(tonePreset)}</span>
          </div>
        </div>
      </header>

      {page === "roles" ? (
        <RoleCatalogPage
          roleCatalog={roleCatalog}
          onRoleCatalogChange={handleRoleCatalogChange}
          onRoleCatalogReset={handleRoleCatalogReset}
        />
      ) : (
        <main className="workspace-grid">
          <section className="board-panel workspace-grid__board">
            <div className="board-panel__header">
              <div>
                <p className="section-eyebrow">Board</p>
                <h2>{isStudyMode ? "Study replay board" : "Edinburgh play surface"}</h2>
              </div>
              <div className="board-panel__actions">
                <button
                  type="button"
                  className={`button button--ghost ${viewMode === "board" ? "button--active" : ""}`}
                  onClick={() => setViewMode("board")}
                >
                  Board
                </button>
                <button
                  type="button"
                  className={`button button--ghost ${viewMode === "map" ? "button--active" : ""}`}
                  onClick={() => setViewMode("map")}
                >
                  Map
                </button>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={handleUndo}
                  disabled={!canUndo}
                >
                  {isStudyMode ? "Undo disabled" : "Undo"}
                </button>
              </div>
            </div>

            <Board
              snapshot={snapshot}
              cells={boardSquares}
              selectedSquare={selectedSquare}
              hoveredSquare={hoveredSquare}
              legalMoves={legalMoves}
              viewMode={viewMode}
              districtsBySquare={edinburghDistrictsBySquare}
              onSquareClick={handleSquareClick}
              onSquareHover={setHoveredSquare}
              onSquareLeave={() => setHoveredSquare(null)}
            />

            <div className="board-panel__footer">
              <p>
                {focusedSquare
                  ? `Focused ${focusedSquare}`
                  : "Hover any square for city and character context, or click a piece to move."}
              </p>
              {lastMove ? <p>Last move: {lastMove.san}</p> : <p>No moves yet.</p>}
            </div>

            <div className="hover-panel">
              <div className="hover-card">
                <p className="field-label">City Tile</p>
                {focusedDistrict ? (
                  <div className="detail-card">
                    <div className="detail-card__title-row">
                      <h3>{focusedDistrict.name}</h3>
                      <span className="side-pill side-pill--white">
                        {focusedDistrict.square}
                      </span>
                    </div>
                    <p className="detail-card__description">
                      {focusedDistrict.locality} | {focusedDistrict.dayProfile}
                    </p>
                    <div className="chip-row">
                      {focusedDistrict.descriptors.map((descriptor) => (
                        <span key={descriptor} className="chip">
                          {descriptor}
                        </span>
                      ))}
                    </div>
                    <div className="chip-row">
                      {focusedDistrict.landmarks.map((landmark) => (
                        <span key={landmark} className="chip chip--soft">
                          {landmark}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="muted">Hover a square to inspect the mapped district.</p>
                )}
              </div>

              <div className="hover-card">
                <p className="field-label">Character on Tile</p>
                {focusedCharacter && focusedPiece ? (
                  <div className="detail-card">
                    <div className="piece-badge">
                      <span className={`piece-badge__icon piece-badge__icon--${focusedPiece.side}`}>
                        {getPieceGlyph({ side: focusedPiece.side, kind: focusedPiece.kind })}
                      </span>
                      <div>
                        <p className="piece-badge__label">
                          {getPieceDisplayName({ side: focusedPiece.side, kind: focusedPiece.kind })}
                        </p>
                        <p className="muted">{getPieceKindLabel(focusedPiece.kind)} piece</p>
                      </div>
                    </div>
                    <h3>{focusedCharacter.fullName}</h3>
                    <p className="detail-card__description">{focusedCharacter.oneLineDescription}</p>
                    <dl className="detail-grid">
                      <div>
                        <dt>Role</dt>
                        <dd>{focusedCharacter.role}</dd>
                      </div>
                      <div>
                        <dt>Origin</dt>
                        <dd>{focusedCharacter.districtOfOrigin}</dd>
                      </div>
                      <div>
                        <dt>Faction</dt>
                        <dd>{focusedCharacter.faction}</dd>
                      </div>
                      <div>
                        <dt>Square</dt>
                        <dd>{focusedSquare ?? "None"}</dd>
                      </div>
                    </dl>
                    <div className="chip-row">
                      {focusedCharacter.traits.map((trait) => (
                        <span key={trait} className="chip">
                          {trait}
                        </span>
                      ))}
                    </div>
                    {focusedCharacterMoments.length ? (
                      <div className="memory-list">
                        <p className="memory-list__label">Recent actions</p>
                        {focusedCharacterMoments.map((event) => (
                          <article key={event.id} className="memory-item">
                            <span className="memory-item__meta">
                              Move {event.moveNumber} | {event.eventType}
                            </span>
                            <p className="memory-item__headline">{event.headline}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : focusedSquare ? (
                  <p className="muted">No active piece is standing on this tile right now.</p>
                ) : (
                  <p className="muted">Hover a square to inspect the piece standing there.</p>
                )}
              </div>
            </div>
          </section>

          <section className="workspace-grid__moves">
            <Panel title="Move History" eyebrow="Rules">
              <div className="timeline timeline--match-log">
                {moveHistory.length ? (
                  moveHistory.map((move) => {
                    const linkedEvent = eventByMoveId.get(move.id) ?? null;

                    return (
                      <article key={move.id} className="timeline__item timeline__item--move">
                        <div className="timeline__meta">
                          <span className="timeline__turn">
                            {move.moveNumber}. {move.side}
                          </span>
                          <span className="timeline__san">{move.san}</span>
                        </div>
                        <p className="timeline__text">
                          {move.from} to {move.to}
                          {move.isCheckmate ? " with checkmate" : move.isCheck ? " with check" : ""}
                          {move.capturedPieceId ? " and a capture" : ""}
                        </p>
                        {linkedEvent ? (
                          <p className="timeline__link">
                            Story beat: {linkedEvent.headline}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="muted">The game log will appear here as soon as the first move lands.</p>
                )}
              </div>
            </Panel>
          </section>

          <section className="workspace-grid__narrative">
            <Panel
              title="Narrative Log"
              eyebrow="Story"
              action={
                <div className="tone-switcher">
                  <button
                    type="button"
                    className={`button button--ghost ${tonePreset === "grounded" ? "button--active" : ""}`}
                    onClick={() => updateTonePreset("grounded")}
                  >
                    Grounded
                  </button>
                  <button
                    type="button"
                    className={`button button--ghost ${tonePreset === "civic-noir" ? "button--active" : ""}`}
                    onClick={() => updateTonePreset("civic-noir")}
                  >
                    Civic noir
                  </button>
                  <button
                    type="button"
                    className={`button button--ghost ${tonePreset === "dark-comedy" ? "button--active" : ""}`}
                    onClick={() => updateTonePreset("dark-comedy")}
                  >
                    Dark comedy
                  </button>
                </div>
              }
            >
              <div className="timeline timeline--narrative">
                {narrativeHistory.length ? (
                  narrativeHistory.map((event) => {
                    const linkedMove = moveById.get(event.moveId) ?? null;

                    return (
                      <article key={event.id} className="timeline__item timeline__item--narrative">
                        <div className="timeline__meta">
                          <span className="timeline__turn">
                            Move {event.moveNumber}
                          </span>
                          <span className="timeline__san">{event.eventType}</span>
                        </div>
                        <h3 className="timeline__headline">{event.headline}</h3>
                        <p className="timeline__text">{event.detail}</p>
                        {linkedMove ? (
                          <p className="timeline__link">
                            Board action: {linkedMove.san} | {linkedMove.from} to {linkedMove.to}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <p className="muted">Each move will add a lightweight narrative beat here.</p>
                )}
              </div>
            </Panel>
          </section>

          <section className="workspace-grid__saved">
            <Panel
              title="Saved Matches"
              eyebrow="Local"
              action={
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => saveCurrentMatch()}
                  disabled={!canSave}
                >
                  Save current match
                </button>
              }
            >
              {savedMatches.length ? (
                <div className="saved-match-list">
                  {savedMatches.map((savedMatch) => (
                    <article key={savedMatch.id} className="saved-match">
                      <div>
                        <h3 className="saved-match__title">{savedMatch.name}</h3>
                        <p className="saved-match__meta">
                          {formatSavedAt(savedMatch.savedAt)} | {savedMatch.moveCount} moves
                        </p>
                      </div>
                      <div className="saved-match__actions">
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => loadSavedMatch(savedMatch.id)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => removeSavedMatch(savedMatch.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  {isStudyMode
                    ? "Local save is disabled in study mode. Resume local play to save a match."
                    : "No saved matches yet. Save the current local game to keep your place."}
                </p>
              )}
            </Panel>
          </section>

          <section className="workspace-grid__study">
            <StudyPanel
              referenceGames={referenceGames}
              selectedReferenceGameId={selectedReferenceGameId}
              onSelectReferenceGame={setSelectedReferenceGameId}
              onLoadReferenceGame={handleLoadReferenceGame}
              pastedPgn={pastedPgn}
              onPgnChange={setPastedPgn}
              onImportPgn={handleImportPgn}
              importError={importError}
              studySession={studySession}
              canStepBackward={canStepBackward}
              canStepForward={canStepForward}
              onJumpToStart={jumpToStart}
              onStepBackward={stepBackward}
              onStepForward={stepForward}
              onJumpToEnd={jumpToEnd}
              onExitStudy={exitStudyMode}
            />
          </section>

          <section className="workspace-grid__status">
            <Panel title="Match State" eyebrow="Status">
              <div className="state-list">
                <div className="state-list__row">
                  <span>Current turn</span>
                  <strong>{turnLabel(status.turn)}</strong>
                </div>
                <div className="state-list__row">
                  <span>Mode</span>
                  <strong>{isStudyMode ? "Study replay" : "Local play"}</strong>
                </div>
                <div className="state-list__row">
                  <span>Board state</span>
                  <strong>{statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}</strong>
                </div>
                <div className="state-list__row">
                  <span>Focused square</span>
                  <strong>{focusedSquare ?? "None"}</strong>
                </div>
                <div className="state-list__row">
                  <span>Legal targets</span>
                  <strong>{legalMoves.length}</strong>
                </div>
                <div className="state-list__row">
                  <span>Hovered district</span>
                  <strong>{focusedDistrict?.name ?? "None"}</strong>
                </div>
              </div>
            </Panel>
          </section>
        </main>
      )}
    </div>
  );
}
