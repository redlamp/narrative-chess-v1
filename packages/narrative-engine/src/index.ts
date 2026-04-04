import narrativeData from "../../../content/templates/narrative-data.json";
import {
  boardFiles,
  characterSummarySchema,
  promotionChoices,
  narrativeEventSchema,
  type CharacterSummary,
  type CityBoard,
  type DistrictCell,
  type MoveRecord,
  type NarrativeEvent,
  type PieceSide,
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

type BiasMap = Record<string, string[]>;

type RosterConfig = {
  sideFactions: Record<PieceSide, string>;
  districts: string[];
  rolePools: Record<string, string[]>;
  firstNames: string[];
  lastNames: string[];
  traits: string[];
  verbs: string[];
  pieceTraitBiases: BiasMap;
  pieceVerbBiases: BiasMap;
  descriptorTraitBiases: BiasMap;
  descriptorVerbBiases: BiasMap;
};

const rosterConfig = narrativeData.roster as RosterConfig;
const eventConfig = narrativeData.events as EventTemplateSet;
const rolePools = rosterConfig.rolePools;
const sideFactions = rosterConfig.sideFactions;

function selectWindow(values: string[], seed: number, count: number): string[] {
  if (values.length === 0 || count <= 0) {
    return [];
  }

  const normalizedSeed = ((seed % values.length) + values.length) % values.length;
  const result: string[] = [];

  for (let index = 0; index < count; index += 1) {
    result.push(values[(normalizedSeed + index) % values.length]);
  }

  return result;
}

function appendUnique(target: string[], values: string[]) {
  for (const value of values) {
    if (value && !target.includes(value)) {
      target.push(value);
    }
  }
}

function hashText(value: string): number {
  let hash = 17;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 2147483647;
  }

  return hash;
}

function normalizeDescriptorKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreDescriptorMatch(input: string, candidate: string): number {
  if (!input || !candidate) {
    return 0;
  }

  if (input === candidate) {
    return 100;
  }

  if (input.includes(candidate) || candidate.includes(input)) {
    return 50;
  }

  const inputTokens = new Set(input.split(" ").filter(Boolean));
  let overlap = 0;

  for (const token of candidate.split(" ").filter(Boolean)) {
    if (inputTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap;
}

function collectDescriptorBiases(descriptors: string[], biasMap: BiasMap): string[] {
  const entries = Object.entries(biasMap).map(([key, values]) => ({
    normalized: normalizeDescriptorKey(key),
    values
  }));
  const collected: string[] = [];

  for (const descriptor of descriptors) {
    const normalizedDescriptor = normalizeDescriptorKey(descriptor);
    const bestMatch = entries
      .map((entry) => ({
        ...entry,
        score: scoreDescriptorMatch(normalizedDescriptor, entry.normalized)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)[0];

    if (bestMatch) {
      appendUnique(collected, bestMatch.values);
    }
  }

  return collected;
}

function buildBiasedSelection(
  basePool: string[],
  favoredValues: string[],
  seed: number,
  count: number
): string[] {
  const allowedValues = new Set(basePool);
  const filteredFavoredValues = favoredValues.filter((value) => allowedValues.has(value));
  const result: string[] = [];

  appendUnique(result, filteredFavoredValues);
  appendUnique(result, selectWindow(basePool, seed * 2 + 1, basePool.length));

  return result.slice(0, Math.min(count, result.length));
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

function toSentenceCase(value: string): string {
  if (!value) {
    return value;
  }

  return `${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;
}

function buildFallbackDistrictName(blueprint: StartingPieceBlueprint): string {
  const fileIndex = boardFiles.indexOf(
    blueprint.square[0] as (typeof boardFiles)[number]
  );

  return rosterConfig.districts[fileIndex % rosterConfig.districts.length] ?? "North Gate";
}

function buildCharacterSummary(input: {
  blueprint: StartingPieceBlueprint;
  index: number;
  district: DistrictCell | null;
}): CharacterSummary {
  const {
    blueprint,
    index,
    district
  } = input;
  const seed = index + 1;
  const districtName = district?.name ?? buildFallbackDistrictName(blueprint);
  const districtLocality = district?.locality ?? null;
  const districtDescriptors = district?.descriptors ?? [];
  const districtSeed = hashText(
    district ? `${district.id}:${district.name}` : `${blueprint.pieceId}:${districtName}`
  );
  const rolePool = rolePools[blueprint.kind] ?? [blueprint.kind];
  const traitCount = 4 + (seed % 3 === 0 ? 1 : 0);
  const verbCount = 4 + (seed % 4 === 0 ? 1 : 0);
  const descriptorTraitBiases = collectDescriptorBiases(
    districtDescriptors,
    rosterConfig.descriptorTraitBiases
  );
  const descriptorVerbBiases = collectDescriptorBiases(
    districtDescriptors,
    rosterConfig.descriptorVerbBiases
  );
  const firstName =
    rosterConfig.firstNames[index % rosterConfig.firstNames.length] ??
    pickTemplateEntry(rosterConfig.firstNames, districtSeed + seed);
  const lastName = pickTemplateEntry(
    rosterConfig.lastNames,
    hashText(`${blueprint.pieceId}:${districtName}:${seed}`)
  );
  const role = pickTemplateEntry(rolePool, districtSeed + seed * 5);
  const traits = buildBiasedSelection(
    rosterConfig.traits,
    [
      ...descriptorTraitBiases,
      ...(rosterConfig.pieceTraitBiases[blueprint.kind] ?? [])
    ],
    seed + districtSeed,
    traitCount
  );
  const verbs = buildBiasedSelection(
    rosterConfig.verbs,
    [
      ...descriptorVerbBiases,
      ...(rosterConfig.pieceVerbBiases[blueprint.kind] ?? [])
    ],
    seed * 2 + districtSeed,
    verbCount
  );
  const localityFragment = districtLocality ? ` in ${districtLocality}` : "";
  const descriptorFragment = districtDescriptors[0]
    ? ` through a ${districtDescriptors[0]} district`
    : " across the board";
  const primaryVerb = verbs[0] ?? "moves";
  const primaryTrait = traits[0] ?? "steady";

  return characterSummarySchema.parse({
    id: blueprint.pieceId,
    pieceId: blueprint.pieceId,
    side: blueprint.side,
    pieceKind: blueprint.kind,
    fullName: `${firstName} ${lastName}`,
    role,
    districtOfOrigin: districtName,
    faction: sideFactions[blueprint.side],
    traits,
    verbs,
    oneLineDescription: `${toSentenceCase(role)} from ${districtName}${localityFragment} who ${primaryVerb} with ${primaryTrait} instincts${descriptorFragment}.`,
    generationSource: district
      ? "curated-template-data + reviewed city board"
      : "curated-template-data",
    generationModel: null,
    contentStatus: "procedural",
    reviewStatus: "reviewed",
    reviewNotes: district
      ? "City-aware procedural roster derived from editable template data and reviewed district descriptors."
      : "Procedural roster derived from editable template data.",
    lastReviewedAt: null
  });
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
  const templates = eventConfig[eventType].details;
  return pickTemplateEntry(templates, seed);
}

function selectEventHeadline(eventType: EventType, seed: number): string {
  const templates = eventConfig[eventType].headlines;
  return pickTemplateEntry(templates, seed);
}

export function createInitialCharacterRoster(options?: {
  cityBoard?: CityBoard;
}): Record<string, CharacterSummary> {
  const roster: Record<string, CharacterSummary> = {};
  const districtsBySquare = options?.cityBoard
    ? new Map(options.cityBoard.districts.map((districtCell) => [districtCell.square, districtCell] as const))
    : null;

  for (let index = 0; index < startingPieceBlueprints.length; index += 1) {
    const blueprint = startingPieceBlueprints[index];
    roster[blueprint.pieceId] = buildCharacterSummary({
      blueprint,
      index,
      district: districtsBySquare?.get(blueprint.square) ?? null
    });
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
