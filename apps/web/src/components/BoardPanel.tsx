import type { ReactNode } from "react";
import type { Square } from "@narrative-chess/content-schema";
import { DistrictBadge } from "./DistrictBadge";
import { Panel } from "./Panel";
import { Checkbox } from "@/components/ui/checkbox";

type BoardPanelProps = {
  // Toggle state (for footer)
  showDistrictLabels: boolean;
  onShowDistrictLabelsChange?: ((value: boolean) => void) | null;
  showPieces?: boolean;
  onShowPiecesChange?: ((value: boolean) => void) | null;
  // Header badge
  districtName?: string | null;
  districtSquare?: Square | null;
  // Layout
  layoutMode?: boolean;
  className?: string;
  // Content (should be <Board> or a component that renders <Board> without a wrapper div)
  children: ReactNode;
};

export function BoardPanel({
  showDistrictLabels,
  onShowDistrictLabelsChange,
  showPieces = true,
  onShowPiecesChange,
  districtName,
  districtSquare,
  layoutMode = false,
  className,
  children,
}: BoardPanelProps) {
  const hasToggles =
    !layoutMode &&
    (onShowDistrictLabelsChange != null || onShowPiecesChange != null);

  const footer: ReactNode = hasToggles ? (
    <div className="board-panel__footer-toggles">
      {onShowDistrictLabelsChange != null ? (
        <label className="board-panel__footer-toggle">
          <span className="board-panel__footer-toggle-text">Districts</span>
          <Checkbox
            checked={showDistrictLabels}
            onCheckedChange={(checked) => onShowDistrictLabelsChange(checked === true)}
          />
        </label>
      ) : null}
      {onShowPiecesChange != null ? (
        <label className="board-panel__footer-toggle">
          <span className="board-panel__footer-toggle-text">Pieces</span>
          <Checkbox
            checked={showPieces}
            onCheckedChange={(checked) => onShowPiecesChange(checked === true)}
          />
        </label>
      ) : null}
    </div>
  ) : null;

  return (
    <Panel
      className={["board-panel", className].filter(Boolean).join(" ")}
      bodyClassName="board-panel__content"
      title="Board"
      action={
        <DistrictBadge
          name={districtName ?? null}
          square={districtSquare ?? null}
          className="district-badge--header"
        />
      }
      footer={footer}
    >
      {children}
    </Panel>
  );
}
