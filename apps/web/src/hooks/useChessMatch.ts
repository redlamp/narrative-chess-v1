import { startTransition, useEffect, useState } from "react";
import {
  applyMove,
  createInitialGameSnapshot,
  createReplayFromPgn,
  getBoardSquares,
  getPieceAtSquare,
  listLegalMoves,
  undoLastMove
} from "@narrative-chess/game-core";
import {
  createInitialCharacterRoster,
  createNarrativeHistory,
  getCharacterEventHistory,
  type NarrativeTonePreset
} from "@narrative-chess/narrative-engine";
import type {
  GameSnapshot,
  PieceState,
  ReferenceGame,
  Square
} from "@narrative-chess/content-schema";
import { edinburghBoard } from "../edinburghBoard";
import {
  deleteSavedMatch as deleteSavedMatchRecord,
  getSavedMatch,
  listSavedMatches,
  saveMatch,
  type SavedMatchRecord
} from "../savedMatches";
import { getRolePoolsOverride, type RoleCatalog } from "../roleCatalog";

type UseChessMatchOptions = {
  roleCatalog: RoleCatalog;
};

type StudyReplay = {
  title: string;
  subtitle: string;
  summary: string;
  sourceUrl: string | null;
  snapshots: GameSnapshot[];
  pgn: string;
};

function isPromotionMove(piece: PieceState | null, to: Square): boolean {
  if (!piece || piece.kind !== "pawn") {
    return false;
  }

  return (piece.side === "white" && to.endsWith("8")) || (piece.side === "black" && to.endsWith("1"));
}

function createCharacters(roleCatalog: RoleCatalog) {
  return createInitialCharacterRoster({
    cityBoard: edinburghBoard,
    rolePoolsOverride: getRolePoolsOverride(roleCatalog)
  });
}

function rebuildSnapshot(input: {
  snapshot: GameSnapshot;
  roleCatalog: RoleCatalog;
  tonePreset: NarrativeTonePreset;
}) {
  const nextCharacters = createCharacters(input.roleCatalog);

  return {
    ...input.snapshot,
    characters: nextCharacters,
    eventHistory: createNarrativeHistory({
      moves: input.snapshot.moveHistory,
      characters: nextCharacters,
      tonePreset: input.tonePreset
    })
  };
}

function createSnapshot(roleCatalog: RoleCatalog): GameSnapshot {
  return createInitialGameSnapshot(createCharacters(roleCatalog));
}

function withNarrativeHistory(input: {
  snapshots: GameSnapshot[];
  roleCatalog: RoleCatalog;
  tonePreset: NarrativeTonePreset;
}) {
  return input.snapshots.map((snapshot) =>
    rebuildSnapshot({
      snapshot,
      roleCatalog: input.roleCatalog,
      tonePreset: input.tonePreset
    })
  );
}

export function useChessMatch({ roleCatalog }: UseChessMatchOptions) {
  const [localSnapshot, setLocalSnapshot] = useState<GameSnapshot>(() => createSnapshot(roleCatalog));
  const [studyReplay, setStudyReplay] = useState<StudyReplay | null>(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [tonePreset, setTonePreset] = useState<NarrativeTonePreset>("grounded");
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>(() => listSavedMatches());

  const snapshot = studyReplay ? studyReplay.snapshots[studyIndex] : localSnapshot;
  const isStudyMode = studyReplay !== null;
  const selectedPiece = selectedSquare ? getPieceAtSquare(snapshot, selectedSquare) : null;
  const selectedCharacter = selectedPiece ? snapshot.characters[selectedPiece.pieceId] ?? null : null;
  const selectedCharacterMoments = selectedCharacter
    ? getCharacterEventHistory({
        events: snapshot.eventHistory,
        pieceId: selectedCharacter.pieceId,
        limit: 3
      })
    : [];
  const legalMoves = selectedSquare ? listLegalMoves(snapshot, selectedSquare) : [];
  const boardSquares = getBoardSquares(snapshot);
  const canUndo = !isStudyMode && snapshot.moveHistory.length > 0;
  const canSave = !isStudyMode;
  const canStepBackward = isStudyMode && studyIndex > 0;
  const canStepForward =
    isStudyMode && studyReplay !== null && studyIndex < studyReplay.snapshots.length - 1;
  const lastMove = snapshot.moveHistory.at(-1) ?? null;

  useEffect(() => {
    setLocalSnapshot((current) =>
      rebuildSnapshot({
        snapshot: current,
        roleCatalog,
        tonePreset
      })
    );
    setStudyReplay((current) =>
      current
        ? {
            ...current,
            snapshots: withNarrativeHistory({
              snapshots: current.snapshots,
              roleCatalog,
              tonePreset
            })
          }
        : null
    );
  }, [roleCatalog, tonePreset]);

  const loadStudyReplay = (input: {
    pgn: string;
    title: string;
    subtitle: string;
    summary: string;
    sourceUrl: string | null;
  }) => {
    try {
      const replay = createReplayFromPgn(input.pgn, createCharacters(roleCatalog));
      const snapshots = withNarrativeHistory({
        snapshots: replay.snapshots,
        roleCatalog,
        tonePreset
      });

      startTransition(() => {
        setStudyReplay({
          title: input.title,
          subtitle: input.subtitle,
          summary: input.summary,
          sourceUrl: input.sourceUrl,
          snapshots,
          pgn: input.pgn
        });
        setStudyIndex(0);
        setSelectedSquare(null);
        setImportError(null);
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to import PGN.";
      setImportError(message);
      return false;
    }
  };

  const commitMove = (from: Square, to: Square) => {
    const movingPiece = getPieceAtSquare(snapshot, from);
    if (!movingPiece) {
      return false;
    }

    const appliedMove = applyMove(snapshot, {
      from,
      to,
      promotion: isPromotionMove(movingPiece, to) ? "q" : undefined
    });

    if (!appliedMove) {
      return false;
    }

    setLocalSnapshot(
      rebuildSnapshot({
        snapshot: appliedMove.nextState,
        roleCatalog,
        tonePreset
      })
    );
    setSelectedSquare(null);
    return true;
  };

  const handleSquareClick = (square: Square) => {
    if (selectedSquare && !isStudyMode) {
      const legalTarget = legalMoves.includes(square);
      if (legalTarget) {
        commitMove(selectedSquare, square);
        return;
      }
    }

    if (selectedSquare === square) {
      setSelectedSquare(null);
      return;
    }

    const piece = getPieceAtSquare(snapshot, square);
    if (piece) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(square);
  };

  const handleUndo = () => {
    if (isStudyMode) {
      return;
    }

    const previous = undoLastMove(snapshot);
    if (!previous) {
      return;
    }

    setLocalSnapshot(
      rebuildSnapshot({
        snapshot: previous,
        roleCatalog,
        tonePreset
      })
    );
    setSelectedSquare(null);
  };

  const loadReferenceGame = (game: ReferenceGame) => {
    return loadStudyReplay({
      pgn: game.pgn,
      title: game.title,
      subtitle: `${game.white} vs ${game.black} | ${game.year}`,
      summary: game.summary,
      sourceUrl: game.sourceUrl
    });
  };

  const loadPgnStudy = (pgn: string) => {
    return loadStudyReplay({
      pgn,
      title: "Imported PGN",
      subtitle: "Custom study line",
      summary: "Imported from pasted PGN for step-through review.",
      sourceUrl: null
    });
  };

  const exitStudyMode = () => {
    setStudyReplay(null);
    setStudyIndex(0);
    setSelectedSquare(null);
    setImportError(null);
  };

  const jumpToStart = () => {
    if (!studyReplay) {
      return;
    }

    setStudyIndex(0);
    setSelectedSquare(null);
  };

  const stepBackward = () => {
    if (!studyReplay) {
      return;
    }

    setStudyIndex((current) => Math.max(0, current - 1));
    setSelectedSquare(null);
  };

  const stepForward = () => {
    if (!studyReplay) {
      return;
    }

    setStudyIndex((current) => Math.min(studyReplay.snapshots.length - 1, current + 1));
    setSelectedSquare(null);
  };

  const jumpToEnd = () => {
    if (!studyReplay) {
      return;
    }

    setStudyIndex(studyReplay.snapshots.length - 1);
    setSelectedSquare(null);
  };

  const updateTonePreset = (nextTonePreset: NarrativeTonePreset) => {
    startTransition(() => {
      setTonePreset(nextTonePreset);
    });
  };

  const saveCurrentMatch = () => {
    if (isStudyMode) {
      return false;
    }

    const nextSavedMatches = saveMatch(localSnapshot);
    setSavedMatches(nextSavedMatches);
    return true;
  };

  const loadSavedMatch = (savedMatchId: string) => {
    const savedMatch = getSavedMatch(savedMatchId);
    if (!savedMatch) {
      setSavedMatches(listSavedMatches());
      return false;
    }

    startTransition(() => {
      setStudyReplay(null);
      setStudyIndex(0);
      setImportError(null);
      setSelectedSquare(null);
      setLocalSnapshot(
        rebuildSnapshot({
          snapshot: savedMatch.snapshot,
          roleCatalog,
          tonePreset
        })
      );
      setSavedMatches(listSavedMatches());
    });

    return true;
  };

  const removeSavedMatch = (savedMatchId: string) => {
    setSavedMatches(deleteSavedMatchRecord(savedMatchId));
  };

  return {
    snapshot,
    boardSquares,
    selectedSquare,
    selectedPiece,
    selectedCharacter,
    selectedCharacterMoments,
    savedMatches,
    legalMoves,
    canSave,
    canUndo,
    isStudyMode,
    tonePreset,
    studySession: studyReplay
      ? {
          title: studyReplay.title,
          subtitle: studyReplay.subtitle,
          summary: studyReplay.summary,
          sourceUrl: studyReplay.sourceUrl,
          currentPly: studyIndex,
          totalPlies: Math.max(0, studyReplay.snapshots.length - 1)
        }
      : null,
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
  };
}
