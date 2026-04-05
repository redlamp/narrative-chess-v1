import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceListItemProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  selected?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function WorkspaceListItem({
  title,
  description,
  meta,
  leading,
  selected = false,
  className,
  type = "button",
  ...buttonProps
}: WorkspaceListItemProps) {
  return (
    <button
      type={type}
      {...buttonProps}
      aria-pressed={selected}
      className={cn(
        "workspace-list-item grid gap-2 border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-foreground/15 bg-muted" : "bg-background hover:bg-muted/50",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {leading ? <span aria-hidden="true" className="text-lg leading-none">{leading}</span> : null}
          <span className="min-w-0 font-medium">{title}</span>
        </div>
        {meta ? <div className="flex flex-wrap justify-end gap-2">{meta}</div> : null}
      </div>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </button>
  );
}
