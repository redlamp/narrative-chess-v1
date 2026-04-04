import { useState } from "react";
import { edinburghBoard, edinburghDistrictsBySquare, getDistrictForSquare } from "./edinburghBoard";
import { referenceGames } from "./referenceGames";
import { Board } from "./components/Board";
import { Panel } from "./components/Panel";
import { StudyPanel } from "./components/StudyPanel";
import { useChessMatch } from "./hooks/useChessMatch";

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
  const [selectedReferenceGameId, setSelectedReferenceGameId] = useState(referenceGames[0]?.id ?? "");
  const [pastedPgn, setPastedPgn] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "map">("board");
  const {
    snapshot,
    boardSquares,
    selectedSquare,
    selectedCharacter,
    selectedCharacterMoments,
    selectedPiece,
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
  } = useChessMatch();

  const status = snapshot.status;
  const lastEvent = snapshot.eventHistory.at(-1) ?? null;
  const moveHistory = [...snapshot.moveHistory].reverse();
  const narrativeHistory = [...snapshot.eventHistory].reverse();
  const eventByMoveId = new Map(snapshot.eventHistory.map((event) => [event.moveId, event] as const));
  const moveById = new Map(snapshot.moveHistory.map((move) => [move.id, move] as const));
  const inspectedSquare = selectedSquare ?? (lastMove?.to ?? null);
  const selectedDistrict = getDistrictForSquare(inspectedSquare);
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

  return (
    <div className="app-shell">
      <div className="app-shell__glow app-shell__glow--left" />
      <div className="app-shell__glow app-shell__glow--right" />

      <header className="hero">
        <div className="hero__copy">
          <p className="hero__eyebrow">Narrative Chess</p>
          <h1>Play the board first. Let the story follow.</h1>
        </div>

        <div className="hero__status">
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
            <span className="status-card__label">Mode</span>
            <span className="status-card__value">{isStudyMode ? "Study replay" : "Local play"}</span>
          </div>
        </div>
      </header>

      <main className="layout">
        <section className="board-panel">
          <div className="board-panel__header">
            <div>
              <p className="section-eyebrow">Board</p>
              <h2>{isStudyMode ? "Study replay board" : "2D Edinburgh play surface"}</h2>
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
              <button type="button" className="button button--ghost" onClick={handleUndo} disabled={!canUndo}>
                {isStudyMode ? "Undo disabled" : "Undo"}
              </button>
            </div>
          </div>

          <Board
            snapshot={snapshot}
            cells={boardSquares}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            viewMode={viewMode}
            districtsBySquare={edinburghDistrictsBySquare}
            onSquareClick={handleSquareClick}
          />

          <div className="board-panel__footer">
            <p>
              {selectedSquare
                ? `Selected ${selectedSquare}`
                : isStudyMode
                  ? "Study mode is read-only. Select any square to inspect the position and district."
                  : "Select a piece to move, or any square to inspect its Edinburgh district."}
            </p>
            {lastMove ? <p>Last move: {lastMove.san}</p> : <p>No moves yet.</p>}
          </div>
        </section>

        <aside className="sidebar">
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

          <Panel title="Selected District" eyebrow="Edinburgh">
            {selectedDistrict ? (
              <div className="detail-card">
                <div className="detail-card__title-row">
                  <h3>{selectedDistrict.name}</h3>
                  <span className="side-pill side-pill--white">{selectedDistrict.square}</span>
                </div>
                <p className="detail-card__description">{edinburghBoard.summary}</p>
                <dl className="detail-grid">
                  <div>
                    <dt>Locality</dt>
                    <dd>{selectedDistrict.locality}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{viewMode === "map" ? "Map view" : "Board view"}</dd>
                  </div>
                  <div>
                    <dt>Day</dt>
                    <dd>{selectedDistrict.dayProfile}</dd>
                  </div>
                  <div>
                    <dt>Night</dt>
                    <dd>{selectedDistrict.nightProfile}</dd>
                  </div>
                </dl>
                <div className="chip-row">
                  {selectedDistrict.descriptors.map((descriptor) => (
                    <span key={descriptor} className="chip">
                      {descriptor}
                    </span>
                  ))}
                </div>
                <div className="chip-row">
                  {selectedDistrict.landmarks.map((landmark) => (
                    <span key={landmark} className="chip chip--soft">
                      {landmark}
                    </span>
                  ))}
                </div>
                <div className="chip-row">
                  {selectedDistrict.toneCues.map((cue) => (
                    <span key={cue} className="chip chip--soft">
                      {cue}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="muted">
                Select any square to inspect the Edinburgh district mapped to that board cell.
              </p>
            )}
          </Panel>

          <Panel title="Selected Piece" eyebrow="Character">
            {selectedCharacter ? (
              <div className="detail-card">
                <div className="detail-card__title-row">
                  <h3>{selectedCharacter.fullName}</h3>
                  <span className={`side-pill side-pill--${selectedCharacter.side}`}>
                    {selectedCharacter.side}
                  </span>
                </div>
                <p className="detail-card__description">{selectedCharacter.oneLineDescription}</p>
                <dl className="detail-grid">
                  <div>
                    <dt>Role</dt>
                    <dd>{selectedCharacter.role}</dd>
                  </div>
                  <div>
                    <dt>Origin</dt>
                    <dd>{selectedCharacter.districtOfOrigin}</dd>
                  </div>
                  <div>
                    <dt>Faction</dt>
                    <dd>{selectedCharacter.faction}</dd>
                  </div>
                  <div>
                    <dt>Square</dt>
                    <dd>{selectedSquare ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{selectedCharacter.generationSource}</dd>
                  </div>
                  <div>
                    <dt>Review</dt>
                    <dd>{selectedCharacter.reviewStatus}</dd>
                  </div>
                </dl>
                <div className="chip-row">
                  {selectedCharacter.traits.map((trait) => (
                    <span key={trait} className="chip">
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="chip-row">
                  {selectedCharacter.verbs.map((verb) => (
                    <span key={verb} className="chip chip--soft">
                      {verb}
                    </span>
                  ))}
                </div>
                <div className="memory-list">
                  <p className="memory-list__label">Recent actions</p>
                  {selectedCharacterMoments.length ? (
                    selectedCharacterMoments.map((event) => (
                      <article key={event.id} className="memory-item">
                        <span className="memory-item__meta">
                          Move {event.moveNumber} | {event.eventType}
                        </span>
                        <p className="memory-item__headline">{event.headline}</p>
                      </article>
                    ))
                  ) : (
                    <p className="muted">No recorded actions for this piece yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="muted">
                {selectedPiece
                  ? "The selected square does not currently map to a character."
                  : "Select any piece to inspect its role, origin, and narrative tags."}
              </p>
            )}
          </Panel>

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
                <span>Narrative tone</span>
                <strong>{toneLabel(tonePreset)}</strong>
              </div>
              <div className="state-list__row">
                <span>Board state</span>
                <strong>{statusLabel(status.isCheck, status.isCheckmate, status.isStalemate)}</strong>
              </div>
              <div className="state-list__row">
                <span>Selected square</span>
                <strong>{selectedSquare ?? "None"}</strong>
              </div>
              <div className="state-list__row">
                <span>Legal targets</span>
                <strong>{legalMoves.length}</strong>
              </div>
              <div className="state-list__row">
                <span>Last event</span>
                <strong>{lastEvent ? lastEvent.headline : "None yet"}</strong>
              </div>
            </div>
          </Panel>
        </aside>
      </main>

      <section className="history-grid">
        <Panel title="Move History" eyebrow="Rules">
          <div className="timeline">
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
    </div>
  );
}
