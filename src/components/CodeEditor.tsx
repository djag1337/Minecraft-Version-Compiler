"use client";

import { useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { java } from "@codemirror/lang-java";
import { githubDarkInit, githubLightInit } from "@uiw/codemirror-theme-github";
import type { FileSelection } from "./FileTree";

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
      <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-1.5 text-xs dark:border-zinc-800">
        <span className="truncate text-zinc-500">{path ?? "No file selected"}</span>
        {selection?.source === "project" && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="rounded bg-zinc-900 px-2 py-1 text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
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
            theme={typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
              ? githubDarkInit({ settings: { background: "#0a0a0a" } })
              : githubLightInit({})}
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
