"use client";

import { useEffect, useState } from "react";
import type { ProjectFile, DecompiledSourceCache } from "@/lib/db";

export type FileSelection =
  | { source: "project"; file: ProjectFile }
  | { source: "vanilla"; path: string };

export default function FileTree({
  projectId,
  onSelect,
}: {
  projectId: string;
  onSelect: (selection: FileSelection) => void;
}) {
  const [tab, setTab] = useState<"project" | "vanilla">("project");
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [cache, setCache] = useState<DecompiledSourceCache | null>(null);
  const [vanillaPaths, setVanillaPaths] = useState<string[]>([]);

  const loadProjectFiles = () => {
    fetch(`/api/projects/${projectId}/files`)
      .then((res) => res.json())
      .then((data) => setProjectFiles(data.files ?? []));
  };

  useEffect(loadProjectFiles, [projectId]);

  useEffect(() => {
    if (tab !== "vanilla") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = () => {
      fetch(`/api/projects/${projectId}/decompile`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled) return;
          setCache(data.cache);
          if (data.cache?.status === "READY") {
            fetch(`/api/projects/${projectId}/vanilla-source/tree`)
              .then((res) => res.json())
              .then((treeData) => setVanillaPaths(treeData.paths ?? []));
          } else if (data.cache?.status === "IN_PROGRESS" || data.cache?.status === "PENDING") {
            timer = setTimeout(poll, 2000);
          }
        });
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, projectId]);

  function triggerDecompile() {
    fetch(`/api/projects/${projectId}/decompile`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => setCache(data.cache));
  }

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 dark:border-zinc-800">
      <div className="flex border-b border-zinc-200 text-xs dark:border-zinc-800">
        <button
          className={`flex-1 px-3 py-2 ${tab === "project" ? "bg-zinc-100 font-medium dark:bg-zinc-900" : ""}`}
          onClick={() => setTab("project")}
        >
          My Files
        </button>
        <button
          className={`flex-1 px-3 py-2 ${tab === "vanilla" ? "bg-zinc-100 font-medium dark:bg-zinc-900" : ""}`}
          onClick={() => setTab("vanilla")}
        >
          Vanilla Source
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 text-sm">
        {tab === "project" && (
          <ul className="flex flex-col gap-0.5">
            {projectFiles.map((file) => (
              <li key={file.id}>
                <button
                  className="w-full truncate rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  onClick={() => onSelect({ source: "project", file })}
                  title={file.path}
                >
                  {file.path}
                </button>
              </li>
            ))}
            {projectFiles.length === 0 && <p className="px-2 text-zinc-400">No files yet.</p>}
          </ul>
        )}
        {tab === "vanilla" && (
          <div className="flex flex-col gap-2">
            {(!cache || cache.status === "PENDING" || cache.status === "FAILED") && (
              <button
                className="rounded bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                onClick={triggerDecompile}
              >
                {cache?.status === "FAILED" ? "Retry decompile" : "Decompile vanilla source"}
              </button>
            )}
            {cache?.status === "IN_PROGRESS" && <p className="text-zinc-400">Decompiling…</p>}
            {cache?.status === "FAILED" && <p className="text-red-500">{cache.errorMessage}</p>}
            <ul className="flex flex-col gap-0.5">
              {vanillaPaths.map((path) => (
                <li key={path}>
                  <button
                    className="w-full truncate rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                    onClick={() => onSelect({ source: "vanilla", path })}
                    title={path}
                  >
                    {path}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <button
        className="border-t border-zinc-200 px-3 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-900"
        onClick={loadProjectFiles}
      >
        Refresh files
      </button>
    </div>
  );
}
