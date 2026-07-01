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
    <div className="grid h-screen grid-cols-[220px_1fr_360px]">
      <FileTree key={filesVersion} projectId={projectId} onSelect={setSelection} />
      <CodeEditor
        key={selection ? `${selection.source}:${selection.source === "project" ? selection.file.id : selection.path}` : "none"}
        projectId={projectId}
        selection={selection}
      />
      <div className="grid grid-rows-[1fr_260px]">
        <ChatPanel projectId={projectId} onFilesChanged={() => setFilesVersion((v) => v + 1)} />
        <BuildPanel projectId={projectId} />
      </div>
    </div>
  );
}
