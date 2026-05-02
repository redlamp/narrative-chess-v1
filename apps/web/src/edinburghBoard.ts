import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import {
  cityBoardSchema,
  type CityBoard
} from "@narrative-chess/content-schema";

export const edinburghBoard: CityBoard = cityBoardSchema.parse(edinburghBoardData);
