import type { ReactNode } from "react";
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
  action?: ReactNode;
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  action,
  className,
  collapsed = false,
  onToggleCollapse,
  children
}: PanelProps) {
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
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`}
            >
              {collapsed ? <ChevronRight /> : <ChevronDown />}
            </Button>
          ) : null}
          <div className="grid gap-1">
            {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
            <CardTitle className="panel__title">{title}</CardTitle>
          </div>
        </div>
        {action ? <CardAction className="panel__action">{action}</CardAction> : null}
      </CardHeader>
      {!collapsed ? <CardContent className="panel__body">{children}</CardContent> : null}
    </Card>
  );
}
