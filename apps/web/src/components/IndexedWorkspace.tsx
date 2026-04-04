import type { ReactNode } from "react";

type IndexedWorkspaceProps = {
  intro: ReactNode;
  index: ReactNode;
  detail: ReactNode;
};

export function IndexedWorkspace({ intro, index, detail }: IndexedWorkspaceProps) {
  return (
    <main className="indexed-workspace">
      <div className="indexed-workspace__intro">{intro}</div>
      <div className="indexed-workspace__columns">
        <div className="indexed-workspace__index">{index}</div>
        <div className="indexed-workspace__detail">{detail}</div>
      </div>
    </main>
  );
}
