import classicGamesData from "../../../content/games/classic-games.json";
import {
  referenceGameLibrarySchema,
  type ReferenceGame
} from "@narrative-chess/content-schema";

export const referenceGames: ReferenceGame[] = referenceGameLibrarySchema.parse(
  classicGamesData
);
