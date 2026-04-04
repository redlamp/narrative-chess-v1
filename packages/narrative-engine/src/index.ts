import narrativeData from "../../../content/templates/narrative-data.json";
import {
  boardFiles,
  characterSummarySchema,
  promotionChoices,
  narrativeEventSchema,
  type CharacterSummary,
  type PieceSide,
  type MoveRecord,
  type NarrativeEvent,
  type StartingPieceBlueprint,
  startingPieceBlueprints
} from "@narrative-chess/content-schema";

type EventType = "move" | "capture" | "check" | "checkmate" | "stalemate" | "promotion";

type EventTemplateSet = Record<
  EventType,
  {
    headlines: string[];
    details: string[];
  }
>;

const rosterConfig = narrativeData.roster;
const eventConfig = narrativeData.events as EventTemplateSet;
const pieceKindToRole = rosterConfig.pieceRoles as Record<string, string>;
const sideFactions = rosterConfig.sideFactions as Record<PieceSide, string>;

function selectWindow(values: string[], seed: number, count: number): string[] {
  if (values.length === 0) {
    return [];
  }

  const normalizedSeed = ((seed % values.length) + values.length) % values.length;
  const result: string[] = [];

  for (let index = 0; index < count; index += 1) {
    result.push(values[(normalizedSeed + index) % values.length]);
  }

  return result;
}

function formatPieceLabel(promotion: MoveRecord["promotion"]): string {
  if (!promotion) {
    return "queen";
  }

  return promotionChoices.includes(promotion as (typeof promotionChoices)[number])
    ? promotion
    : "queen";
}

function pickTemplateEntry(values: string[], seed: number): string {
  if (values.length === 0) {
    return "";
  }

  const index = ((seed % values.length) + values.length) % values.length;
  return values[index];
}

function templateFill(
  template: string,
  replacements: Record<string, string>
): string {
  return template.replace(/\{([a-z]+)\}/g, (_match, key: string) => {
    return replacements[key] ?? "";
  });
}

function buildCharacterSummary(
  blueprint: StartingPieceBlueprint,
  seed: number
): CharacterSummary {
  const firstNames = rosterConfig.firstNames as string[];
  const lastNames = rosterConfig.lastNames as string[];
  const traits = rosterConfig.traits as string[];
  const verbs = rosterConfig.verbs as string[];
  const districtIndex = boardFiles.indexOf(
    blueprint.square[0] as (typeof boardFiles)[number]
  );
  const traitCount = 4 + (seed % 3 === 0 ? 1 : 0);
  const verbCount = 4 + (seed % 4 === 0 ? 1 : 0);
  const district =
    rosterConfig.districts[districtIndex % rosterConfig.districts.length] ?? "North Gate";

  const summary = {
    id: blueprint.pieceId,
    pieceId: blueprint.pieceId,
    side: blueprint.side,
    pieceKind: blueprint.kind,
    fullName: `${pickTemplateEntry(firstNames, seed)} ${pickTemplateEntry(lastNames, seed * 3 + 1)}`,
    role: pieceKindToRole[blueprint.kind] ?? blueprint.kind,
    districtOfOrigin: district,
    faction: sideFactions[blueprint.side],
    traits: selectWindow(traits, seed, traitCount),
    verbs: selectWindow(verbs, seed * 2 + 1, verbCount),
    oneLineDescription: `${pieceKindToRole[blueprint.kind] ?? blueprint.kind} from ${district} who ${
      selectWindow(verbs, seed * 2 + 1, verbCount)[0] ?? "moves"
    } with purpose.`,
    generationSource: "curated-template-data",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "reviewed",
    reviewNotes: "Placeholder first-playable roster derived from editable template data.",
    lastReviewedAt: null
  };

  return characterSummarySchema.parse(summary);
}

function inferEventType(move: MoveRecord): EventType {
  if (move.isCheckmate) {
    return "checkmate";
  }

  if (move.isStalemate) {
    return "stalemate";
  }

  if (move.promotion) {
    return "promotion";
  }

  if (move.isCheck) {
    return "check";
  }

  if (move.capturedPieceId) {
    return "capture";
  }

  return "move";
}

function selectEventTemplate(eventType: EventType, seed: number): string {
  const templates = eventConfig[eventType].details as string[];
  return pickTemplateEntry(templates, seed);
}

function selectEventHeadline(eventType: EventType, seed: number): string {
  const templates = eventConfig[eventType].headlines as string[];
  return pickTemplateEntry(templates, seed);
}

export function createInitialCharacterRoster(): Record<string, CharacterSummary> {
  const roster: Record<string, CharacterSummary> = {};

  for (let index = 0; index < startingPieceBlueprints.length; index += 1) {
    const blueprint = startingPieceBlueprints[index];
    roster[blueprint.pieceId] = buildCharacterSummary(blueprint, index + 1);
  }

  return roster;
}

export function createNarrativeEvent(input: {
  move: MoveRecord;
  actor: CharacterSummary;
  target?: CharacterSummary | null;
}): NarrativeEvent {
  const eventType = inferEventType(input.move);
  const promotionLabel = formatPieceLabel(input.move.promotion);
  const headline = templateFill(selectEventHeadline(eventType, input.move.moveNumber), {
    actor: input.actor.fullName,
    target: input.target?.fullName ?? "their opponent",
    from: input.move.from,
    to: input.move.to,
    promotion: promotionLabel,
    verb: input.actor.verbs[(input.move.moveNumber - 1) % input.actor.verbs.length] ?? "moves"
  });

  const detail = templateFill(selectEventTemplate(eventType, input.move.moveNumber), {
    actor: input.actor.fullName,
    target: input.target?.fullName ?? "their opponent",
    from: input.move.from,
    to: input.move.to,
    promotion: promotionLabel,
    verb: input.actor.verbs[(input.move.moveNumber - 1) % input.actor.verbs.length] ?? "moves"
  });

  return narrativeEventSchema.parse({
    id: `event-${input.move.id}`,
    moveId: input.move.id,
    moveNumber: input.move.moveNumber,
    actorPieceId: input.actor.pieceId,
    targetPieceId: input.target?.pieceId ?? null,
    location: input.move.to,
    eventType,
    headline,
    detail
  });
}

export function createNarrativeHistory(input: {
  moves: MoveRecord[];
  characters: Record<string, CharacterSummary>;
}): NarrativeEvent[] {
  return input.moves.map((move) => {
    const actor =
      input.characters[move.pieceId] ??
      characterSummarySchema.parse({
        id: move.pieceId,
        pieceId: move.pieceId,
        side: move.side,
        pieceKind: move.pieceKind,
        fullName: `${move.side} ${move.pieceKind}`,
        role: move.pieceKind,
        districtOfOrigin: "Unknown district",
        faction: `${move.side} cohort`,
        traits: ["steady", "practical", "watchful", "resolute"],
        verbs: ["advance", "watch", "hold", "press"],
        oneLineDescription: "Fallback roster entry for imported games.",
        generationSource: "narrative-engine fallback",
        generationModel: null,
        contentStatus: "procedural",
        reviewStatus: "needs review",
        reviewNotes: null,
        lastReviewedAt: null
      });
    const target = move.capturedPieceId
      ? input.characters[move.capturedPieceId] ?? null
      : null;

    return createNarrativeEvent({
      move,
      actor,
      target
    });
  });
}
