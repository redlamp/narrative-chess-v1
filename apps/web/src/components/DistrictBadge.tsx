import { cn } from "@/lib/utils";

type DistrictBadgeProps = {
  name?: string | null;
  square?: string | null;
  className?: string;
};

export function DistrictBadge({ name, square, className }: DistrictBadgeProps) {
  const blankValue = "\u00A0";

  return (
    <div className={cn("district-badge", className)}>
      <p className="district-badge__name">{name || blankValue}</p>
      {square ? <span className="side-pill side-pill--compact side-pill--white side-pill--square">{square}</span> : null}
    </div>
  );
}
