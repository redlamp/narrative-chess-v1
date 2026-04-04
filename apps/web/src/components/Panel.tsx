import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
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
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  action,
  className,
  collapsed = false,
  children
}: PanelProps) {
  return (
    <Card className={cn("panel", collapsed && "panel--collapsed", className)} size="sm">
      <CardHeader className="panel__header">
        <div className="grid gap-1">
          {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
          <CardTitle className="panel__title">{title}</CardTitle>
        </div>
        {action ? <CardAction className="panel__action">{action}</CardAction> : null}
      </CardHeader>
      {!collapsed ? <CardContent className="panel__body">{children}</CardContent> : null}
    </Card>
  );
}
