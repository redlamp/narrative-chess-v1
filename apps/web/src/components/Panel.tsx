import type { ReactNode } from "react";

type PanelProps = {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
  collapsed?: boolean;
  children: ReactNode;
};

export function Panel({ title, eyebrow, action, className, collapsed = false, children }: PanelProps) {
  return (
    <section className={["panel", collapsed ? "panel--collapsed" : "", className ?? ""].filter(Boolean).join(" ")}>
      <div className="panel__header">
        <div>
          {eyebrow ? <p className="panel__eyebrow">{eyebrow}</p> : null}
          <h2 className="panel__title">{title}</h2>
        </div>
        {action ? <div className="panel__action">{action}</div> : null}
      </div>
      {!collapsed ? <div className="panel__body">{children}</div> : null}
    </section>
  );
}
