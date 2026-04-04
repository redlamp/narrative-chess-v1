import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type IndexedWorkspaceProps = {
  intro: ReactNode;
  index: ReactNode;
  secondaryIndex?: ReactNode;
  detail: ReactNode;
  className?: string;
  scrollMode?: "panel" | "page";
};

export function IndexedWorkspace({
  intro,
  index,
  secondaryIndex,
  detail,
  className,
  scrollMode = "panel"
}: IndexedWorkspaceProps) {
  return (
    <main
      className={cn(
        "indexed-workspace",
        secondaryIndex ? "indexed-workspace--three-pane" : null,
        scrollMode === "page" ? "indexed-workspace--page-scroll" : null,
        className
      )}
    >
      <div className="indexed-workspace__intro">{intro}</div>
      <div
        className={cn(
          "indexed-workspace__columns",
          secondaryIndex ? "indexed-workspace__columns--three-pane" : null
        )}
      >
        <div className="indexed-workspace__index">{index}</div>
        {secondaryIndex ? (
          <div className="indexed-workspace__secondary-index">{secondaryIndex}</div>
        ) : null}
        <div className="indexed-workspace__detail">{detail}</div>
      </div>
    </main>
  );
}
