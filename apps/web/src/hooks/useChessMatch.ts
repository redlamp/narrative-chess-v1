import { startTransition, useEffect, useMemo, useState } from "react";
import {
  applyMove,
  createInitialGameSnapshot,
  createSnapshotFromFen,
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
  PieceSide,
  ReferenceGame,
  Square
} from "@narrative-chess/content-schema";
import { edinburghBoard } from "../edinburghBoard";
import {
  deleteSavedMatch as deleteSavedMatchRecord,
  getSavedMatch,
  listSavedMatches,
  replaceSavedMatches,
  saveMatch,
  type SavedMatchRecord
} from "../savedMatches";
import {
  deleteSavedMatchFromSupabase,
  listSavedMatchesFromSupabase,
  saveSavedMatchToSupabase
} from "../savedMatchesCloud";
import { subscribeToAuthChanges } from "../auth";
import { getRolePoolsOverride, type RoleCatalog } from "../roleCatalog";

type UseChessMatchOptions = {
  roleCatalog: RoleCatalog;
  moveInteractionLocked?: boolean;
  localControlsLocked?: boolean;
  localMoveSide?: PieceSide | null;
  canCommitLocalMove?: (snapshot: GameSnapshot) => boolean;
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

function buildLocalTimelineSnapshots(snapshot: GameSnapshot) {
  const timeline: GameSnapshot[] = [createInitialGameSnapshot(snapshot.characters)];

  snapshot.moveHistory.forEach((move, index) => {
    timeline.push(
      createSnapshotFromFen(
        move.fenAfter,
        snapshot.characters,
        snapshot.moveHistory.slice(0, index + 1),
        snapshot.eventHistory.slice(0, index + 1)
      )
    );
  });

  return timeline;
}

export function useChessMatch({
  roleCatalog,
  moveInteractionLocked = false,
  localControlsLocked = false,
  localMoveSide,
  canCommitLocalMove
}: UseChessMatchOptions) {
  const [localSnapshot, setLocalSnapshot] = useState<GameSnapshot>(() => createSnapshot(roleCatalog));
  const [studyReplay, setStudyReplay] = useState<StudyReplay | null>(null);
  const [localPly, setLocalPly] = useState(0);
  const [studyPly, setStudyPly] = useState(0);
  const [timelineKey, setTimelineKey] = useState(0);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [tonePreset, setTonePreset] = useState<NarrativeTonePreset>("grounded");
  const [savedMatches, setSavedMatches] = useState<SavedMatchRecord[]>(() => listSavedMatches());

  const isStudyMode = studyReplay !== null;
  const localTimelineSnapshots = useMemo(
    () => buildLocalTimelineSnapshots(localSnapshot),
    [localSnapshot]
  );
  const historySnapshots = isStudyMode ? studyReplay.snapshots : localTimelineSnapshots;
  const selectedPly = isStudyMode ? studyPly : localPly;
  const totalPlies = Math.max(0, historySnapshots.length - 1);
  const snapshot = historySnapshots[selectedPly] ?? historySnapshots.at(-1) ?? localSnapshot;
  const historyMoves = historySnapshots.at(-1)?.moveHistory ?? [];
  const historyEvents = historySnapshots.at(-1)?.eventHistory ?? [];
  const isViewingLatestPosition = selectedPly === totalPlies;
  const selectedPiece = selectedSquare ? getPieceAtSquare(snapshot, selectedSquare) : null;
  const selectedCharacter = selectedPiece ? snapshot.characters[selectedPiece.pieceId] ?? null : null;
  const selectedCharacterMoments = selectedCharacter
    ? getCharacterEventHistory({
        events: snapshot.eventHistory,
        pieceId: selectedCharacter.pieceId,
        limit: 3
      })
    : [];
  const canSelectPieceForLocalMove = (piece: PieceState | null) =>
    Boolean(piece && (localMoveSide === undefined || piece.side === localMoveSide));
  const legalMoves =
    selectedSquare && canSelectPieceForLocalMove(selectedPiece)
      ? listLegalMoves(snapshot, selectedSquare)
      : [];
  const canInteractWithCurrentPosition = !canCommitLocalMove || canCommitLocalMove(snapshot);
  const boardSquares = getBoardSquares(snapshot);
  const canUndo = !isStudyMode && !localControlsLocked && localSnapshot.moveHistory.length > 0;
  const canSave = !isStudyMode && !localControlsLocked;
  const canStepBackward = selectedPly > 0;
  const canStepForward = selectedPly < totalPlies;
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

  useEffect(() => {
    let cancelled = false;

    const syncSavedMatches = async () => {
      try {
        const remoteMatches = await listSavedMatchesFromSupabase();
        if (cancelled) {
          return;
        }

        if (remoteMatches) {
          const nextMatches = replaceSavedMatches(remoteMatches);
          setSavedMatches(nextMatches);
          return;
        }

        setSavedMatches(listSavedMatches());
      } catch (error) {
        if (!cancelled) {
          console.warn("[supabase] Could not sync saved matches.", error);
          setSavedMatches(listSavedMatches());
        }
      }
    };

    void syncSavedMatches();

    const unsubscribe = subscribeToAuthChanges(() => {
      void syncSavedMatches();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

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
        setStudyPly(0);
        setSelectedSquare(null);
        setTimelineKey((current) => current + 1);
      });

      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const commitMove = (from: Square, to: Square) => {
    if (canCommitLocalMove && !canCommitLocalMove(snapshot)) {
      return false;
    }

    const movingPiece = getPieceAtSquare(snapshot, from);
    if (!canSelectPieceForLocalMove(movingPiece)) {
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
    setLocalPly(appliedMove.nextState.moveHistory.length);
    setSelectedSquare(null);
    return true;
  };

  const handleSquareClick = (square: Square) => {
    if (moveInteractionLocked || isStudyMode || !canInteractWithCurrentPosition) {
      return;
    }

    if (selectedSquare && isViewingLatestPosition) {
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
      setSelectedSquare(canSelectPieceForLocalMove(piece) ? square : null);
      return;
    }

    setSelectedSquare(localMoveSide === undefined ? square : null);
  };

  const handleUndo = () => {
    if (isStudyMode || localControlsLocked) {
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
    setLocalPly(previous.moveHistory.length);
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

  const exitStudyMode = () => {
    setStudyReplay(null);
    setStudyPly(0);
    setSelectedSquare(null);
  };

  const jumpToStart = () => {
    if (isStudyMode) {
      setStudyPly(0);
    } else {
      setLocalPly(0);
    }
    setSelectedSquare(null);
  };

  const stepBackward = () => {
    if (isStudyMode) {
      setStudyPly((current) => Math.max(0, current - 1));
    } else {
      setLocalPly((current) => Math.max(0, current - 1));
    }
    setSelectedSquare(null);
  };

  const stepForward = () => {
    if (isStudyMode) {
      setStudyPly((current) => Math.min(totalPlies, current + 1));
    } else {
      setLocalPly((current) => Math.min(totalPlies, current + 1));
    }
    setSelectedSquare(null);
  };

  const jumpToEnd = () => {
    if (isStudyMode) {
      setStudyPly(totalPlies);
    } else {
      setLocalPly(totalPlies);
    }
    setSelectedSquare(null);
  };

  const goToPly = (nextPly: number) => {
    const clampedPly = Math.max(0, Math.min(totalPlies, nextPly));
    if (isStudyMode) {
      setStudyPly(clampedPly);
    } else {
      setLocalPly(clampedPly);
    }
    setSelectedSquare(null);
  };

  const updateTonePreset = (nextTonePreset: NarrativeTonePreset) => {
    startTransition(() => {
      setTonePreset(nextTonePreset);
    });
  };

  const saveCurrentMatch = () => {
    if (isStudyMode || localControlsLocked) {
      return false;
    }

    const nextSavedMatches = saveMatch(localSnapshot);
    setSavedMatches(nextSavedMatches);
    const nextSavedMatch = nextSavedMatches[0] ?? null;
    if (nextSavedMatch) {
      void saveSavedMatchToSupabase(nextSavedMatch).catch((error) => {
        console.warn("[supabase] Could not save match to cloud.", error);
      });
    }
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
      setStudyPly(0);
      setSelectedSquare(null);
      setLocalSnapshot(
        rebuildSnapshot({
          snapshot: savedMatch.snapshot,
          roleCatalog,
          tonePreset
        })
      );
      setLocalPly(savedMatch.snapshot.moveHistory.length);
      setSavedMatches(listSavedMatches());
      setTimelineKey((current) => current + 1);
    });

    return true;
  };

  const removeSavedMatch = (savedMatchId: string) => {
    setSavedMatches(deleteSavedMatchRecord(savedMatchId));
    void deleteSavedMatchFromSupabase(savedMatchId).catch((error) => {
      console.warn("[supabase] Could not delete cloud saved match.", error);
    });
  };

  const loadSnapshot = (nextSnapshot?: GameSnapshot | null) => {
    const snapshotToLoad = nextSnapshot ?? createSnapshot(roleCatalog);

    startTransition(() => {
      setStudyReplay(null);
      setStudyPly(0);
      setSelectedSquare(null);
      setLocalSnapshot(
        rebuildSnapshot({
          snapshot: snapshotToLoad,
          roleCatalog,
          tonePreset
        })
      );
      setLocalPly(snapshotToLoad.moveHistory.length);
      setTimelineKey((current) => current + 1);
    });
  };

  return {
    snapshot,
    timelineKey,
    historySnapshots,
    historyMoves,
    historyEvents,
    selectedPly,
    totalPlies,
    isViewingLatestPosition,
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
          currentPly: studyPly,
          totalPlies
        }
      : null,
    canStepBackward,
    canStepForward,
    lastMove,
    handleSquareClick,
    handleUndo,
    goToPly,
    loadReferenceGame,
    exitStudyMode,
    jumpToStart,
    stepBackward,
    stepForward,
    jumpToEnd,
    updateTonePreset,
    saveCurrentMatch,
    loadSavedMatch,
    removeSavedMatch,
    loadSnapshot
  };
}
