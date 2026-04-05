import { useId, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type PanelProps = {
  title: string;
  eyebrow?: string;
  leadingAction?: ReactNode;
  action?: ReactNode;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  leadingAction,
  action,
  className,
  collapsed = false,
  onToggleCollapse,
  children
}: PanelProps) {
  const panelTitleId = useId();
  const panelBodyId = useId();

  return (
    <Card className={cn("panel", collapsed && "panel--collapsed", className)} size="sm">
      <CardHeader className="panel__header">
        <div className="panel__heading">
          {onToggleCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="panel__toggle"
              onClick={onToggleCollapse}
              aria-controls={panelBodyId}
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
            >
              {collapsed ? <ChevronRight /> : <ChevronDown />}
            </Button>
          ) : null}
          {leadingAction ? <div className="panel__leading-action">{leadingAction}</div> : null}
          <div className="grid gap-1">
            {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
            <CardTitle className="panel__title" id={panelTitleId}>
              {title}
            </CardTitle>
          </div>
        </div>
        {action ? <CardAction className="panel__action">{action}</CardAction> : null}
      </CardHeader>
      {!collapsed ? (
        <CardContent
          className="panel__body"
          id={panelBodyId}
          role="region"
          aria-labelledby={panelTitleId}
        >
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
