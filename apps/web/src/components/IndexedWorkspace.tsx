import type { ReactNode } from "react";

type IndexedWorkspaceProps = {
  intro: ReactNode;
  index: ReactNode;
  detail: ReactNode;
};

export function IndexedWorkspace({ intro, index, detail }: IndexedWorkspaceProps) {
  return (
    <main className="mx-auto flex w-full max-w-[1700px] flex-col gap-6">
      {intro}
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        {index}
        {detail}
      </div>
    </main>
  );
}
