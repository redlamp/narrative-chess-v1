import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  title: ReactNode;
  eyebrow?: string;
  leadingAction?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  children: ReactNode;
};

export function Panel({
  title,
  eyebrow,
  leadingAction,
  action,
  footer,
  className,
  bodyClassName,
  collapsed = false,
  onToggleCollapse,
  children
}: PanelProps) {
  const panelTitleId = useId();
  const panelBodyId = useId();
  const accessibleTitle = typeof title === "string" ? title : "panel";
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setIsLandscape(width > height);
  }, []);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setIsLandscape(width > height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Card ref={cardRef} data-landscape={isLandscape} className={cn("panel", collapsed && "panel--collapsed", className)}>
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
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${accessibleTitle}`}
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
          className={cn("panel__body", bodyClassName)}
          id={panelBodyId}
          role="region"
          aria-labelledby={panelTitleId}
        >
          {children}
        </CardContent>
      ) : null}
      {!collapsed && footer ? footer : null}
    </Card>
  );
}
