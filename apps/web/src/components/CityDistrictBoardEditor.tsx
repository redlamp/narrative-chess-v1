import { useMemo } from "react";
import { createSnapshotFromFen, getBoardSquares } from "@narrative-chess/game-core";
import type { CityBoard, DistrictCell, Square } from "@narrative-chess/content-schema";
import { Board } from "./Board";

type CityDistrictBoardEditorProps = {
  cityBoard: CityBoard;
  selectedDistrict: DistrictCell | null;
  highlightedDistrict: DistrictCell | null;
  hoveredSquare: Square | null;
  isEditable?: boolean;
  showDistrictLabels?: boolean;
  showPieces?: boolean;
  onHoveredSquareChange: (square: Square | null) => void;
  onSquareChange: (square: Square) => void;
  onSelectDistrict: (districtId: string) => void;
  onSquareSwap?: (fromSquare: Square, toSquare: Square) => void;
};

const previewBoardFen = "4k3/8/8/8/8/8/8/4K3 w - - 0 1";

export function CityDistrictBoardEditor({
  cityBoard,
  selectedDistrict,
  highlightedDistrict,
  hoveredSquare,
  isEditable = true,
  showDistrictLabels = true,
  showPieces = false,
  onHoveredSquareChange,
  onSquareChange,
  onSelectDistrict,
  onSquareSwap
}: CityDistrictBoardEditorProps) {
  const previewSnapshot = useMemo(() => createSnapshotFromFen(previewBoardFen), []);
  const previewCells = useMemo(() => getBoardSquares(previewSnapshot), [previewSnapshot]);
  const districtsBySquare = useMemo(
    () => new Map(cityBoard.districts.map((district) => [district.square, district] as const)),
    [cityBoard.districts]
  );
  const activeDistrict = highlightedDistrict ?? selectedDistrict;

  return (
    <Board
      snapshot={previewSnapshot}
      cells={previewCells}
      selectedSquare={selectedDistrict?.square ?? null}
      hoveredSquare={hoveredSquare}
      inspectedSquare={activeDistrict?.square ?? null}
      legalMoves={[]}
      viewMode="board"
      districtsBySquare={districtsBySquare}
      showCoordinates={true}
      showDistrictLabels={showDistrictLabels}
      showActiveSquareLabel={false}
      showSquareLabels={false}
      showPieces={showPieces}
      onSquareClick={(square) => {
        const district = districtsBySquare.get(square);

        if (district) {
          onSelectDistrict(district.id);
          return;
        }

        if (selectedDistrict && isEditable) {
          onSquareChange(square);
        }
      }}
      onSquareHover={(square) => onHoveredSquareChange(square)}
      onSquareLeave={() => onHoveredSquareChange(null)}
      onSquareDrop={isEditable ? onSquareSwap : undefined}
    />
  );
}
