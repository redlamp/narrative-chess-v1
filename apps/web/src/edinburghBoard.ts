import edinburghBoardData from "../../../content/cities/edinburgh-board.json";
import {
  cityBoardSchema,
  type CityBoard,
  type DistrictCell,
  type Square
} from "@narrative-chess/content-schema";

export const edinburghBoard: CityBoard = cityBoardSchema.parse(edinburghBoardData);

export const edinburghDistrictsBySquare = new Map<Square, DistrictCell>(
  edinburghBoard.districts.map((district) => [district.square, district] as const)
);

export function getDistrictForSquare(square: Square | null) {
  if (!square) {
    return null;
  }

  return edinburghDistrictsBySquare.get(square) ?? null;
}

export function abbreviateDistrictName(name: string) {
  return name.length <= 11 ? name : `${name.slice(0, 10)}...`;
}
