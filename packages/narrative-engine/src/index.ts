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
  type PieceKind,
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

export type NarrativeTonePreset = "grounded" | "civic-noir" | "dark-comedy";

const rosterConfig = narrativeData.roster as RosterConfig;
const eventConfig = narrativeData.events as EventTemplateSet;
const rolePools = rosterConfig.rolePools;
const sideFactions = rosterConfig.sideFactions;

const toneCodaByEventType: Record<NarrativeTonePreset, Record<EventType, string[]>> = {
  grounded: {
    move: [
      "The position stays legible.",
      "The line remains under control."
    ],
    capture: [
      "The board tightens around the exchange.",
      "Space opens on the file immediately."
    ],
    check: [
      "The pressure is obvious now.",
      "The defense has to respond at once."
    ],
    checkmate: [
      "There is no clean reply left.",
      "Every escape route is closed."
    ],
    stalemate: [
      "No side can make a useful move now.",
      "The board runs out of legal air."
    ],
    promotion: [
      "The promotion changes the tempo of the board.",
      "The file now carries a different kind of threat."
    ]
  },
  "civic-noir": {
    move: [
      "The district feels the shift straight away.",
      "The lane goes tense for a beat."
    ],
    capture: [
      "Everyone nearby understands what just changed.",
      "The square keeps the mark of it."
    ],
    check: [
      "The pressure lands like a warning siren.",
      "The king is left in a very public light."
    ],
    checkmate: [
      "By the end, the whole block can read the verdict.",
      "The finish lands with city-hall certainty."
    ],
    stalemate: [
      "The streetlights stay on, but nothing else moves.",
      "The city exhales into a dead stop."
    ],
    promotion: [
      "The promotion feels like a name change under sodium light.",
      "The square suddenly belongs to someone new."
    ]
  },
  "dark-comedy": {
    move: [
      "Everyone acts as if this was the sensible option.",
      "The board pretends not to enjoy the drama."
    ],
    capture: [
      "The spectators find a way to gasp and gossip at the same time.",
      "Somewhere, a rumor gets promoted ahead of schedule."
    ],
    check: [
      "Nobody on the board can convincingly call this subtle.",
      "The threat arrives with all the grace of a thrown chair."
    ],
    checkmate: [
      "The ending is so clean it almost feels rude.",
      "That is the sort of finish people retell badly on purpose."
    ],
    stalemate: [
      "Every plan reaches the same awkward shrug.",
      "The position gives up before anyone does."
    ],
    promotion: [
      "Reinvention arrives suspiciously well-timed.",
      "Nothing says upward mobility like a queen on short notice."
    ]
  }
};

const captureInterpretations: Record<NarrativeTonePreset, Record<PieceKind, string[]>> = {
  grounded: {
    pawn: ["presses out", "forces off", "shoulders past"],
    rook: ["locks out", "drives back", "closes down"],
    knight: ["cuts off", "outflanks", "jars loose"],
    bishop: ["exposes", "angles out", "crossfires"],
    queen: ["outmaneuvers", "commands off", "sweeps aside"],
    king: ["leans on", "forces back", "ushers aside"]
  },
  "civic-noir": {
    pawn: ["grinds down", "leans through", "works over"],
    rook: ["shuts out", "bars off", "pins in place before removing"],
    knight: ["slips past and strips out", "catches on the turn and removes", "arrives from the blind side to take"],
    bishop: ["exposes and removes", "cuts a diagonal through and takes", "draws into the open before removing"],
    queen: ["owns the square away from", "presses the district clean out of", "makes an example of"],
    king: ["steps through and takes", "forces the issue against", "closes the distance on"]
  },
  "dark-comedy": {
    pawn: ["politely evicts", "bumps off the route of", "outlasts the patience of"],
    rook: ["files paperwork against", "shuts the gate on", "makes an administrative problem for"],
    knight: ["appears inconveniently beside", "shows up at exactly the wrong angle for", "turns the corner on"],
    bishop: ["finds the worst possible angle for", "offers a sermon to before removing", "makes a doctrinal case against"],
    queen: ["runs a full campaign against", "arrives with terrible timing for", "treats as a scheduling error"],
    king: ["personally intervenes against", "makes everyone watch the removal of", "decides enough is enough for"]
  }
};

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

function toOrdinal(value: number): string {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
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
  rolePoolOverride?: string[];
}): CharacterSummary {
  const {
    blueprint,
    index,
    district,
    rolePoolOverride
  } = input;
  const seed = index + 1;
  const districtName = district?.name ?? buildFallbackDistrictName(blueprint);
  const districtLocality = district?.locality ?? null;
  const districtDescriptors = district?.descriptors ?? [];
  const districtSeed = hashText(
    district ? `${district.id}:${district.name}` : `${blueprint.pieceId}:${districtName}`
  );
  const rolePool =
    rolePoolOverride && rolePoolOverride.length > 0
      ? rolePoolOverride
      : rolePools[blueprint.kind] ?? [blueprint.kind];
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
  return pickTemplateEntry(eventConfig[eventType].details, seed);
}

function selectEventHeadline(eventType: EventType, seed: number): string {
  return pickTemplateEntry(eventConfig[eventType].headlines, seed);
}

function selectToneCoda(
  tonePreset: NarrativeTonePreset,
  eventType: EventType,
  seed: number
): string {
  return pickTemplateEntry(toneCodaByEventType[tonePreset][eventType], seed);
}

function buildCaptureDetail(input: {
  move: MoveRecord;
  actor: CharacterSummary;
  target?: CharacterSummary | null;
  tonePreset: NarrativeTonePreset;
}): string {
  const targetLabel = input.target?.fullName ?? "their opponent";
  const interpretation = pickTemplateEntry(
    captureInterpretations[input.tonePreset][input.actor.pieceKind],
    input.move.moveNumber + input.actor.fullName.length
  );

  return `${input.actor.fullName} ${interpretation} ${targetLabel} from ${input.move.from} to ${input.move.to}.`;
}

function buildMemoryNote(input: {
  eventType: EventType;
  actor: CharacterSummary;
  priorEvents: NarrativeEvent[];
  tonePreset: NarrativeTonePreset;
}): string {
  const priorActorEvents = input.priorEvents.filter(
    (event) => event.actorPieceId === input.actor.pieceId
  );

  if (input.eventType === "capture") {
    const priorCaptures = priorActorEvents.filter((event) => event.eventType === "capture").length;
    if (priorCaptures > 0) {
      const totalCaptures = priorCaptures + 1;

      switch (input.tonePreset) {
        case "grounded":
          return `It is their ${toOrdinal(totalCaptures)} decisive removal of the match.`;
        case "civic-noir":
          return `The board is now keeping count: ${toOrdinal(totalCaptures)} removal, same operator.`;
        case "dark-comedy":
          return `At this point, even the gossip has learned their pattern.`;
      }
    }
  }

  if (priorActorEvents.length > 0) {
    const totalActions = priorActorEvents.length + 1;

    switch (input.tonePreset) {
      case "grounded":
        return `It marks their ${toOrdinal(totalActions)} intervention of the game.`;
      case "civic-noir":
        return `The city has seen them here before; this is intervention ${totalActions}.`;
      case "dark-comedy":
        return `Their ${toOrdinal(totalActions)} appearance somehow feels less surprising than it should.`;
    }
  }

  return "";
}

function buildEventDetail(input: {
  eventType: EventType;
  move: MoveRecord;
  actor: CharacterSummary;
  target?: CharacterSummary | null;
  tonePreset: NarrativeTonePreset;
  priorEvents: NarrativeEvent[];
}): string {
  const promotionLabel = formatPieceLabel(input.move.promotion);
  const baseDetail =
    input.eventType === "capture"
      ? buildCaptureDetail(input)
      : templateFill(selectEventTemplate(input.eventType, input.move.moveNumber), {
          actor: input.actor.fullName,
          target: input.target?.fullName ?? "their opponent",
          from: input.move.from,
          to: input.move.to,
          promotion: promotionLabel,
          verb:
            input.actor.verbs[(input.move.moveNumber - 1) % input.actor.verbs.length] ??
            "moves"
        });
  const toneCoda = selectToneCoda(
    input.tonePreset,
    input.eventType,
    input.move.moveNumber + hashText(input.actor.pieceId)
  );
  const memoryNote = buildMemoryNote({
    eventType: input.eventType,
    actor: input.actor,
    priorEvents: input.priorEvents,
    tonePreset: input.tonePreset
  });

  return [baseDetail, toneCoda, memoryNote].filter(Boolean).join(" ");
}

export function createInitialCharacterRoster(options?: {
  cityBoard?: CityBoard;
  rolePoolsOverride?: Partial<Record<PieceKind, string[]>>;
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
      district: districtsBySquare?.get(blueprint.square) ?? null,
      rolePoolOverride: options?.rolePoolsOverride?.[blueprint.kind]
    });
  }

  return roster;
}

export function createNarrativeEvent(input: {
  move: MoveRecord;
  actor: CharacterSummary;
  target?: CharacterSummary | null;
  tonePreset?: NarrativeTonePreset;
  priorEvents?: NarrativeEvent[];
}): NarrativeEvent {
  const eventType = inferEventType(input.move);
  const tonePreset = input.tonePreset ?? "grounded";
  const promotionLabel = formatPieceLabel(input.move.promotion);
  const headline = templateFill(selectEventHeadline(eventType, input.move.moveNumber), {
    actor: input.actor.fullName,
    target: input.target?.fullName ?? "their opponent",
    from: input.move.from,
    to: input.move.to,
    promotion: promotionLabel,
    verb: input.actor.verbs[(input.move.moveNumber - 1) % input.actor.verbs.length] ?? "moves"
  });
  const detail = buildEventDetail({
    eventType,
    move: input.move,
    actor: input.actor,
    target: input.target,
    tonePreset,
    priorEvents: input.priorEvents ?? []
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
  tonePreset?: NarrativeTonePreset;
}): NarrativeEvent[] {
  const events: NarrativeEvent[] = [];

  for (const move of input.moves) {
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

    events.push(
      createNarrativeEvent({
        move,
        actor,
        target,
        tonePreset: input.tonePreset,
        priorEvents: events
      })
    );
  }

  return events;
}

export function getCharacterEventHistory(input: {
  events: NarrativeEvent[];
  pieceId: string;
  limit?: number;
}): NarrativeEvent[] {
  const relevantEvents = input.events.filter(
    (event) => event.actorPieceId === input.pieceId || event.targetPieceId === input.pieceId
  );
  const limit = input.limit ?? 3;

  return relevantEvents.slice(-limit).reverse();
}
