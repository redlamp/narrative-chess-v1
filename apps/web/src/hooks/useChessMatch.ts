import { startTransition, useState } from "react";
import {
  applyMove,
  createReplayFromPgn,
  createInitialGameSnapshot,
  getBoardSquares,
  getPieceAtSquare,
  listLegalMoves,
  undoLastMove
} from "@narrative-chess/game-core";
import {
  createInitialCharacterRoster,
  createNarrativeHistory,
  createNarrativeEvent
} from "@narrative-chess/narrative-engine";
import type {
  CharacterSummary,
  GameSnapshot,
  MoveRecord,
  PieceState,
  ReferenceGame,
  Square
} from "@narrative-chess/content-schema";

function createFallbackCharacter(piece: PieceState): CharacterSummary {
  const sideLabel = piece.side === "white" ? "North" : "South";

  return {
    id: piece.pieceId,
    pieceId: piece.pieceId,
    side: piece.side,
    pieceKind: piece.kind,
    fullName: `${sideLabel} ${piece.kind[0].toUpperCase()}${piece.kind.slice(1)}`,
    role: piece.kind,
    districtOfOrigin: "Central Ward",
    faction: piece.side === "white" ? "White Directorate" : "Black Assembly",
    traits: ["focused", "observant", "steady", "guarded"],
    verbs: ["advance", "hold", "pressure", "defend"],
    oneLineDescription: "A lightweight fallback character for local play.",
    generationSource: "web-fallback",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "empty",
    reviewNotes: null,
    lastReviewedAt: null
  };
}

function isPromotionMove(piece: PieceState | null, to: Square): boolean {
  if (!piece || piece.kind !== "pawn") {
    return false;
  }

  return (piece.side === "white" && to.endsWith("8")) || (piece.side === "black" && to.endsWith("1"));
}

function createSnapshot(): GameSnapshot {
  const characters = createInitialCharacterRoster();
  return createInitialGameSnapshot(characters);
}

type StudyReplay = {
  title: string;
  subtitle: string;
  summary: string;
  sourceUrl: string | null;
  snapshots: GameSnapshot[];
  pgn: string;
};

function withNarrativeHistory(snapshots: GameSnapshot[]) {
  const finalSnapshot = snapshots.at(-1);
  if (!finalSnapshot) {
    return snapshots;
  }

  const events = createNarrativeHistory({
    moves: finalSnapshot.moveHistory,
    characters: finalSnapshot.characters
  });

  return snapshots.map((snapshot) => ({
    ...snapshot,
    eventHistory: events.slice(0, snapshot.moveHistory.length)
  }));
}

export function useChessMatch() {
  const [localSnapshot, setLocalSnapshot] = useState<GameSnapshot>(() => createSnapshot());
  const [studyReplay, setStudyReplay] = useState<StudyReplay | null>(null);
  const [studyIndex, setStudyIndex] = useState(0);
  const [importError, setImportError] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const snapshot = studyReplay ? studyReplay.snapshots[studyIndex] : localSnapshot;
  const isStudyMode = studyReplay !== null;
  const selectedPiece = selectedSquare ? getPieceAtSquare(snapshot, selectedSquare) : null;
  const selectedCharacter = selectedPiece ? snapshot.characters[selectedPiece.pieceId] ?? null : null;
  const legalMoves = selectedSquare ? listLegalMoves(snapshot, selectedSquare) : [];
  const boardSquares = getBoardSquares(snapshot);
  const canUndo = !isStudyMode && snapshot.moveHistory.length > 0;
  const canStepBackward = isStudyMode && studyIndex > 0;
  const canStepForward = isStudyMode && studyReplay !== null && studyIndex < studyReplay.snapshots.length - 1;
  const lastMove = snapshot.moveHistory.at(-1) ?? null;

  const loadStudyReplay = (input: {
    pgn: string;
    title: string;
    subtitle: string;
    summary: string;
    sourceUrl: string | null;
  }) => {
    try {
      const characters = createInitialCharacterRoster();
      const replay = createReplayFromPgn(input.pgn, characters);
      const snapshots = withNarrativeHistory(replay.snapshots);

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

    const actor = snapshot.characters[movingPiece.pieceId] ?? createFallbackCharacter(movingPiece);
    const targetPiece = appliedMove.move.capturedPieceId
      ? snapshot.characters[appliedMove.move.capturedPieceId] ?? null
      : null;

    const event = createNarrativeEvent({
      move: appliedMove.move as MoveRecord,
      actor,
      target: targetPiece
    });

    setLocalSnapshot({
      ...appliedMove.nextState,
      eventHistory: [...snapshot.eventHistory, event]
    });
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

    setSelectedSquare(null);
  };

  const handleUndo = () => {
    if (isStudyMode) {
      return;
    }

    const previous = undoLastMove(snapshot);
    if (!previous) {
      return;
    }

    setLocalSnapshot(previous);
    setSelectedSquare(null);
  };

  const loadReferenceGame = (game: ReferenceGame) => {
    return loadStudyReplay({
      pgn: game.pgn,
      title: game.title,
      subtitle: `${game.white} vs ${game.black} · ${game.year}`,
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

  return {
    snapshot,
    boardSquares,
    selectedSquare,
    selectedPiece,
    selectedCharacter,
    legalMoves,
    canUndo,
    isStudyMode,
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
    jumpToEnd
  };
}
