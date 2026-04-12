import { cn } from "@/lib/utils";
import { getSquareTone } from "./cityMapShared";

type DistrictBadgeProps = {
  name?: string | null;
  square?: string | null;
  className?: string;
};

export function DistrictBadge({ name, square, className }: DistrictBadgeProps) {
  const blankValue = "\u00A0";
  const squareTone = square ? getSquareTone(square) : null;

  return (
    <div className={cn("district-badge", className)}>
      <p className="district-badge__name">{name || blankValue}</p>
      {square ? (
        <span
          className={cn(
            "cities-page__district-square-pill",
            squareTone ? `cities-page__district-square-pill--${squareTone}` : null
          )}
        >
          {square}
        </span>
      ) : null}
    </div>
  );
}
