import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type WorkspaceListItemProps = {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  leading?: ReactNode;
  selected?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title">;

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
        "workspace-list-item grid gap-1.5 border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-foreground/15 bg-muted" : "bg-background hover:bg-muted/50",
        className
      )}
    >
      <div className="workspace-list-item__header flex items-start justify-between gap-3">
        <div className="workspace-list-item__title-row flex min-w-0 items-center gap-3">
          {leading ? (
            <span aria-hidden="true" className="workspace-list-item__leading text-lg leading-none">
              {leading}
            </span>
          ) : null}
          <span className="workspace-list-item__title min-w-0 font-medium">{title}</span>
        </div>
        {meta ? <div className="workspace-list-item__meta flex flex-wrap justify-end gap-2">{meta}</div> : null}
      </div>
      {description ? (
        <p className="workspace-list-item__description text-sm text-muted-foreground">{description}</p>
      ) : null}
    </button>
  );
}
