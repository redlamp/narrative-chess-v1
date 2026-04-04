import { z } from "zod";

export const boardFiles = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const boardRanks = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
export const promotionChoices = ["queen", "rook", "bishop", "knight"] as const;

export const squareSchema = z
  .string()
  .regex(/^[a-h][1-8]$/, "Expected a valid algebraic square.");
export type Square = z.infer<typeof squareSchema>;

export const pieceSideSchema = z.enum(["white", "black"]);
export type PieceSide = z.infer<typeof pieceSideSchema>;

export const pieceKindSchema = z.enum([
  "pawn",
  "rook",
  "knight",
  "bishop",
  "queen",
  "king"
]);
export type PieceKind = z.infer<typeof pieceKindSchema>;

export interface StartingPieceBlueprint {
  pieceId: string;
  side: PieceSide;
  kind: PieceKind;
  square: Square;
}

export const startingPieceBlueprints: StartingPieceBlueprint[] = [
  { pieceId: "white-rook-a", side: "white", kind: "rook", square: "a1" },
  { pieceId: "white-knight-b", side: "white", kind: "knight", square: "b1" },
  { pieceId: "white-bishop-c", side: "white", kind: "bishop", square: "c1" },
  { pieceId: "white-queen", side: "white", kind: "queen", square: "d1" },
  { pieceId: "white-king", side: "white", kind: "king", square: "e1" },
  { pieceId: "white-bishop-f", side: "white", kind: "bishop", square: "f1" },
  { pieceId: "white-knight-g", side: "white", kind: "knight", square: "g1" },
  { pieceId: "white-rook-h", side: "white", kind: "rook", square: "h1" },
  { pieceId: "white-pawn-a", side: "white", kind: "pawn", square: "a2" },
  { pieceId: "white-pawn-b", side: "white", kind: "pawn", square: "b2" },
  { pieceId: "white-pawn-c", side: "white", kind: "pawn", square: "c2" },
  { pieceId: "white-pawn-d", side: "white", kind: "pawn", square: "d2" },
  { pieceId: "white-pawn-e", side: "white", kind: "pawn", square: "e2" },
  { pieceId: "white-pawn-f", side: "white", kind: "pawn", square: "f2" },
  { pieceId: "white-pawn-g", side: "white", kind: "pawn", square: "g2" },
  { pieceId: "white-pawn-h", side: "white", kind: "pawn", square: "h2" },
  { pieceId: "black-rook-a", side: "black", kind: "rook", square: "a8" },
  { pieceId: "black-knight-b", side: "black", kind: "knight", square: "b8" },
  { pieceId: "black-bishop-c", side: "black", kind: "bishop", square: "c8" },
  { pieceId: "black-queen", side: "black", kind: "queen", square: "d8" },
  { pieceId: "black-king", side: "black", kind: "king", square: "e8" },
  { pieceId: "black-bishop-f", side: "black", kind: "bishop", square: "f8" },
  { pieceId: "black-knight-g", side: "black", kind: "knight", square: "g8" },
  { pieceId: "black-rook-h", side: "black", kind: "rook", square: "h8" },
  { pieceId: "black-pawn-a", side: "black", kind: "pawn", square: "a7" },
  { pieceId: "black-pawn-b", side: "black", kind: "pawn", square: "b7" },
  { pieceId: "black-pawn-c", side: "black", kind: "pawn", square: "c7" },
  { pieceId: "black-pawn-d", side: "black", kind: "pawn", square: "d7" },
  { pieceId: "black-pawn-e", side: "black", kind: "pawn", square: "e7" },
  { pieceId: "black-pawn-f", side: "black", kind: "pawn", square: "f7" },
  { pieceId: "black-pawn-g", side: "black", kind: "pawn", square: "g7" },
  { pieceId: "black-pawn-h", side: "black", kind: "pawn", square: "h7" }
];

export const contentStatusSchema = z.enum(["empty", "procedural", "authored"]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;

export const reviewStatusSchema = z.enum([
  "empty",
  "needs review",
  "reviewed",
  "approved"
]);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

export const characterSummarySchema = z.object({
  id: z.string(),
  pieceId: z.string(),
  side: pieceSideSchema,
  pieceKind: pieceKindSchema,
  fullName: z.string(),
  role: z.string(),
  districtOfOrigin: z.string(),
  faction: z.string(),
  traits: z.array(z.string()).min(4).max(6),
  verbs: z.array(z.string()).min(4).max(6),
  oneLineDescription: z.string(),
  generationSource: z.string(),
  generationModel: z.string().nullable(),
  contentStatus: contentStatusSchema,
  reviewStatus: reviewStatusSchema,
  reviewNotes: z.string().nullable(),
  lastReviewedAt: z.string().nullable()
});
export type CharacterSummary = z.infer<typeof characterSummarySchema>;

export const roleDefinitionSchema = z.object({
  id: z.string(),
  pieceKind: pieceKindSchema,
  name: z.string(),
  summary: z.string(),
  traits: z.array(z.string()),
  verbs: z.array(z.string()),
  notes: z.string().nullable(),
  generationSource: z.string(),
  generationModel: z.string().nullable(),
  contentStatus: contentStatusSchema,
  reviewStatus: reviewStatusSchema,
  reviewNotes: z.string().nullable(),
  lastReviewedAt: z.string().nullable()
});
export type RoleDefinition = z.infer<typeof roleDefinitionSchema>;

export const roleCatalogSchema = z.object({
  roles: z.array(roleDefinitionSchema).min(1)
});
export type RoleCatalogRecord = z.infer<typeof roleCatalogSchema>;

export const pieceStateSchema = z.object({
  pieceId: z.string(),
  side: pieceSideSchema,
  kind: pieceKindSchema,
  square: squareSchema.nullable(),
  promotedTo: pieceKindSchema.nullable()
});
export type PieceState = z.infer<typeof pieceStateSchema>;

export const matchOutcomeSchema = z.enum([
  "active",
  "white-win",
  "black-win",
  "draw"
]);
export type MatchOutcome = z.infer<typeof matchOutcomeSchema>;

export const matchStatusSchema = z.object({
  turn: pieceSideSchema,
  isCheck: z.boolean(),
  isCheckmate: z.boolean(),
  isStalemate: z.boolean(),
  outcome: matchOutcomeSchema
});
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const moveRecordSchema = z.object({
  id: z.string(),
  moveNumber: z.number().int().positive(),
  side: pieceSideSchema,
  from: squareSchema,
  to: squareSchema,
  san: z.string(),
  pieceId: z.string(),
  pieceKind: pieceKindSchema,
  capturedPieceId: z.string().nullable(),
  promotion: pieceKindSchema.nullable(),
  isCheck: z.boolean(),
  isCheckmate: z.boolean(),
  isStalemate: z.boolean(),
  fenAfter: z.string()
});
export type MoveRecord = z.infer<typeof moveRecordSchema>;

export const narrativeEventTypeSchema = z.enum([
  "move",
  "capture",
  "check",
  "checkmate",
  "stalemate",
  "promotion"
]);
export type NarrativeEventType = z.infer<typeof narrativeEventTypeSchema>;

export const narrativeEventSchema = z.object({
  id: z.string(),
  moveId: z.string(),
  moveNumber: z.number().int().positive(),
  actorPieceId: z.string(),
  targetPieceId: z.string().nullable(),
  location: squareSchema,
  eventType: narrativeEventTypeSchema,
  headline: z.string(),
  detail: z.string()
});
export type NarrativeEvent = z.infer<typeof narrativeEventSchema>;

export const gameSnapshotSchema = z.object({
  currentFen: z.string(),
  pieces: z.array(pieceStateSchema),
  characters: z.record(z.string(), characterSummarySchema),
  moveHistory: z.array(moveRecordSchema),
  eventHistory: z.array(narrativeEventSchema),
  status: matchStatusSchema
});
export type GameSnapshot = z.infer<typeof gameSnapshotSchema>;

export const referenceLinkSchema = z.object({
  label: z.string(),
  url: z.string().url()
});
export type ReferenceLink = z.infer<typeof referenceLinkSchema>;

export const referenceGameSchema = z.object({
  id: z.string(),
  title: z.string(),
  white: z.string(),
  black: z.string(),
  event: z.string(),
  site: z.string(),
  year: z.number().int(),
  opening: z.string(),
  result: z.string(),
  summary: z.string(),
  historicalSignificance: z.string(),
  teachingFocus: z.array(z.string()).min(1),
  sourceUrl: z.string().url().nullable(),
  detailLinks: z.array(referenceLinkSchema).default([]),
  pgn: z.string(),
  generationSource: z.string(),
  generationModel: z.string().nullable(),
  contentStatus: contentStatusSchema,
  reviewStatus: reviewStatusSchema,
  reviewNotes: z.string().nullable(),
  lastReviewedAt: z.string().nullable()
});
export type ReferenceGame = z.infer<typeof referenceGameSchema>;

export const referenceGameLibrarySchema = z.array(referenceGameSchema);
export type ReferenceGameLibrary = z.infer<typeof referenceGameLibrarySchema>;

export const districtCellSchema = z.object({
  id: z.string(),
  square: squareSchema,
  name: z.string(),
  locality: z.string(),
  descriptors: z.array(z.string()).min(1),
  landmarks: z.array(z.string()).min(1),
  dayProfile: z.string(),
  nightProfile: z.string(),
  toneCues: z.array(z.string()).min(1),
  contentStatus: contentStatusSchema,
  reviewStatus: reviewStatusSchema,
  reviewNotes: z.string().nullable(),
  lastReviewedAt: z.string().nullable()
});
export type DistrictCell = z.infer<typeof districtCellSchema>;

export const cityBoardSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  summary: z.string(),
  boardOrientation: z.string(),
  sourceUrls: z.array(z.string().url()).min(1),
  generationSource: z.string(),
  generationModel: z.string().nullable(),
  contentStatus: contentStatusSchema,
  reviewStatus: reviewStatusSchema,
  reviewNotes: z.string().nullable(),
  lastReviewedAt: z.string().nullable(),
  districts: z.array(districtCellSchema).length(64)
});
export type CityBoard = z.infer<typeof cityBoardSchema>;

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
}

export interface MoveApplication {
  nextState: GameSnapshot;
  move: MoveRecord;
}
