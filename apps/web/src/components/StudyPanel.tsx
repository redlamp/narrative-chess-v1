import { useState, type ChangeEvent } from "react";
import type { ReferenceGame } from "@narrative-chess/content-schema";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
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
  studySession: StudySession | null;
  canStepBackward: boolean;
  canStepForward: boolean;
  onJumpToStart: () => void;
  onStepBackward: () => void;
  onStepForward: () => void;
  onJumpToEnd: () => void;
  onExitStudy: () => void;
  embedded?: boolean;
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
  studySession,
  canStepBackward,
  canStepForward,
  onJumpToStart,
  onStepBackward,
  onStepForward,
  onJumpToEnd,
  onExitStudy,
  embedded = false
}: StudyPanelProps) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const shouldShowImport = isImportOpen || Boolean(importError);

  const handleSelectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onSelectReferenceGame(event.currentTarget.value);
  };

  const handlePgnChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onPgnChange(event.currentTarget.value);
  };

  const content = (
    <div className="study-panel">
      <div className="study-panel__block">
        <label className="field-label" htmlFor="reference-game-select">
          Built-in reference game
        </label>
        <div className="study-panel__row">
          <select
            id="reference-game-select"
            className="field-select"
            value={selectedReferenceGameId}
            onChange={handleSelectChange}
          >
            {referenceGames.map((game) => (
              <option key={game.id} value={game.id}>
                {game.title} ({game.white} vs {game.black})
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={onLoadReferenceGame}>
            Load
          </Button>
        </div>
      </div>

      <Collapsible
        className="study-panel__block study-panel__disclosure"
        open={shouldShowImport}
        onOpenChange={setIsImportOpen}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="study-panel__summary-toggle">
            <span>PGN Import</span>
            <span className="study-panel__summary-copy">
              {shouldShowImport ? "Hide import" : "Paste a line or full game"}
            </span>
            <ChevronDown
              className={`study-panel__summary-icon ${shouldShowImport ? "is-open" : ""}`}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="study-panel__disclosure-body">
          {shouldShowImport ? (
            <>
            <label className="field-label" htmlFor="pgn-input">
              Paste PGN
            </label>
            <Textarea
              id="pgn-input"
              value={pastedPgn}
              onChange={handlePgnChange}
              placeholder="Paste a PGN here to load a classic game or opening line."
              rows={8}
            />
            <div className="study-panel__actions">
              <Button type="button" variant="outline" size="sm" onClick={onImportPgn}>
                Import PGN
              </Button>
            </div>
            {importError ? <p className="field-error">{importError}</p> : null}
            </>
          ) : null}
        </CollapsibleContent>
      </Collapsible>

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
            <Button type="button" variant="outline" size="sm" onClick={onJumpToStart} disabled={!canStepBackward}>
              Start
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onStepBackward} disabled={!canStepBackward}>
              Prev
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onStepForward} disabled={!canStepForward}>
              Next
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onJumpToEnd} disabled={!canStepForward}>
              End
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onExitStudy}>
              Resume local game
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Panel title="Study Games" eyebrow="Reference">
      {content}
    </Panel>
  );
}
