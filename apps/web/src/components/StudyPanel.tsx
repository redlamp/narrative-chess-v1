import type { ChangeEvent } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import { Panel } from "./Panel";

type StudySession = {
  title: string;
  subtitle: string;
  summary: string;
  sourceUrl: string | null;
  currentPly: number;
  totalPlies: number;
};

type StudyPanelProps = {
  referenceGames: ReferenceGame[];
  selectedReferenceGameId: string;
  onSelectReferenceGame: (value: string) => void;
  onLoadReferenceGame: () => void;
  pastedPgn: string;
  onPgnChange: (value: string) => void;
  onImportPgn: () => void;
  importError: string | null;
  isStudyMode: boolean;
  studySession: StudySession | null;
  canStepBackward: boolean;
  canStepForward: boolean;
  onJumpToStart: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onExitStudy: () => void;
};

export function StudyPanel({
  referenceGames,
  selectedReferenceGameId,
  onSelectReferenceGame,
  onLoadReferenceGame,
  pastedPgn,
  onPgnChange,
  onImportPgn,
  importError,
  isStudyMode,
  studySession,
  canStepBackward,
  canStepForward,
  onJumpToStart,
  onStepBackward,
  onStepForward,
  onJumpToEnd,
  onExitStudy
}: StudyPanelProps) {
  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelectReferenceGame(event.currentTarget.value);
  };

  const handlePgnChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onPgnChange(event.currentTarget.value);
  };

  return (
    <Panel title="Study Games" eyebrow="Import">
      <div className="study-panel">
        <div className="study-panel__block">
          <label className="field-label" htmlFor="reference-game-select">
            Built-in reference game
          </label>
          <div className="study-panel__row">
            <select
              id="reference-game-select"
              className="field-input"
              value={selectedReferenceGameId}
              onChange={handleSelectChange}
            >
              {referenceGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title} ({game.white} vs {game.black})
                </option>
              ))}
            </select>
            <button type="button" className="button button--ghost" onClick={onLoadReferenceGame}>
              Load
            </button>
          </div>
        </div>

        <div className="study-panel__block">
          <label className="field-label" htmlFor="pgn-input">
            Paste PGN
          </label>
          <textarea
            id="pgn-input"
            className="field-textarea"
            value={pastedPgn}
            onChange={handlePgnChange}
            placeholder="Paste a PGN here to load a classic game or opening line."
            rows={8}
          />
          <div className="study-panel__actions">
            <button type="button" className="button button--ghost" onClick={onImportPgn}>
              Import PGN
            </button>
            {isStudyMode ? (
              <button type="button" className="button button--ghost" onClick={onExitStudy}>
                Resume local game
              </button>
            ) : null}
          </div>
          {importError ? <p className="field-error">{importError}</p> : null}
        </div>

        {studySession ? (
          <div className="study-panel__block study-panel__block--session">
            <div className="study-panel__session-header">
              <div>
                <p className="section-eyebrow">Current study</p>
                <h3>{studySession.title}</h3>
                <p className="muted">{studySession.subtitle}</p>
              </div>
              <span className="side-pill side-pill--white">
                Ply {studySession.currentPly} / {studySession.totalPlies}
              </span>
            </div>
            <p className="study-panel__summary">{studySession.summary}</p>
            {studySession.sourceUrl ? (
              <p className="study-panel__source">
                <a href={studySession.sourceUrl} target="_blank" rel="noreferrer">
                  Historical reference
                </a>
              </p>
            ) : null}
            <div className="study-panel__actions">
              <button type="button" className="button button--ghost" onClick={onJumpToStart} disabled={!canStepBackward}>
                Start
              </button>
              <button type="button" className="button button--ghost" onClick={onStepBackward} disabled={!canStepBackward}>
                Prev
              </button>
              <button type="button" className="button button--ghost" onClick={onStepForward} disabled={!canStepForward}>
                Next
              </button>
              <button type="button" className="button button--ghost" onClick={onJumpToEnd} disabled={!canStepForward}>
                End
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
