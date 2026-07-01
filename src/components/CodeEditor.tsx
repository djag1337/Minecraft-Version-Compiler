"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { githubDarkInit, githubLightInit } from "@uiw/codemirror-theme-github";
import type { FileSelection } from "./FileTree";
import { useIsDarkMode } from "@/lib/useIsDarkMode";

export default function CodeEditor({
  projectId,
  selection,
}: {
  projectId: string;
  selection: FileSelection | null;
}) {
  const [content, setContent] = useState(() => (selection?.source === "project" ? selection.file.content : ""));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const isDark = useIsDarkMode();

  // Parent remounts this component (via `key`) whenever `selection` changes
  // identity, so `content`/`dirty` above already reset on file switch — this
  // effect only needs to handle the async fetch for read-only vanilla source.
  useEffect(() => {
    if (selection?.source === "vanilla") {
      fetch(`/api/projects/${projectId}/vanilla-source/file?path=${encodeURIComponent(selection.path)}`)
        .then((res) => res.json())
        .then((data) => setContent(data.content ?? ""));
    }
  }, [projectId, selection]);

  async function save() {
    if (!selection || selection.source !== "project") return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/files/${selection.file.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const readOnly = !selection || selection.source === "vanilla";
  const path = selection ? (selection.source === "project" ? selection.file.path : selection.path) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs dark:border-zinc-800 dark:bg-zinc-950">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Editor
          </span>
          <span className="truncate font-mono text-zinc-500 dark:text-zinc-400">{path ?? "No file selected"}</span>
        </span>
        {selection?.source === "project" && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="shrink-0 rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {path && (
          <CodeMirror
            value={content}
            height="100%"
            readOnly={readOnly}
            theme={isDark ? githubDarkInit({ settings: { background: "#0a0a0a" } }) : githubLightInit({})}
            extensions={[java()]}
            onChange={(value) => {
              setContent(value);
              setDirty(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
