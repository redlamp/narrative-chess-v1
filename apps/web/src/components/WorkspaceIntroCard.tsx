import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WorkspaceNotice = {
  tone: "neutral" | "success" | "error";
  text: string;
};

type WorkspaceIntroCardProps = {
  badgeRow?: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  status?: WorkspaceNotice | null;
  children?: ReactNode;
  className?: string;
};

export function WorkspaceIntroCard({
  badgeRow,
  title,
  actions,
  status,
  children,
  className
}: WorkspaceIntroCardProps) {
  return (
    <Card className={cn("page-card page-card--intro workspace-intro-card", className)}>
      <CardHeader className="workspace-intro-card__header">
        <div className="workspace-intro-card__layout">
          <div className="workspace-intro-card__main">
            <CardTitle className="workspace-intro-card__title">{title}</CardTitle>
            {badgeRow ? <div className="workspace-intro-card__badges">{badgeRow}</div> : null}
          </div>
          {actions ? <div className="workspace-intro-card__actions">{actions}</div> : null}
        </div>
      </CardHeader>
      {status || children ? (
        <CardContent className="grid gap-3">
          {status ? (
            <div
              aria-live="polite"
              role="status"
              className={cn(
                "rounded-lg border p-3 text-sm",
                status.tone === "error"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "bg-muted/30 text-muted-foreground"
              )}
            >
              {status.text}
            </div>
          ) : null}
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
