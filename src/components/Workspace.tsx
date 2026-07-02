"use client";

import { useState } from "react";
import FileTree, { type FileSelection } from "./FileTree";
import CodeEditor from "./CodeEditor";
import ChatPanel from "./ChatPanel";
import BuildPanel from "./BuildPanel";

export default function Workspace({ projectId }: { projectId: string }) {
  const [selection, setSelection] = useState<FileSelection | null>(null);
  const [filesVersion, setFilesVersion] = useState(0);

  return (
    <div className="grid h-full w-full grid-cols-[200px_minmax(0,1fr)_300px] divide-x divide-zinc-200 overflow-hidden dark:divide-zinc-800">
      <div className="h-full min-w-0">
        <FileTree key={filesVersion} projectId={projectId} onSelect={setSelection} />
      </div>
      <div className="h-full min-w-0">
        <CodeEditor
          key={selection ? `${selection.source}:${selection.source === "project" ? selection.file.id : selection.path}` : "none"}
          projectId={projectId}
          selection={selection}
        />
      </div>
      <div className="grid min-w-0 grid-rows-[1fr_260px] divide-y divide-zinc-200 dark:divide-zinc-800">
        <ChatPanel projectId={projectId} onFilesChanged={() => setFilesVersion((v) => v + 1)} />
        <BuildPanel projectId={projectId} />
      </div>
    </div>
  );
}
