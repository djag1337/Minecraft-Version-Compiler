"use client";

import { useEffect, useMemo, useState } from "react";
import type { ProjectFile, DecompiledSourceCache } from "@/lib/db";
import SectionHeader from "./SectionHeader";

export type FileSelection =
  | { source: "project"; file: ProjectFile }
  | { source: "vanilla"; path: string };

const CATEGORY_LABELS: Record<string, string> = {
  block: "Blocks",
  item: "Items",
  entity: "Entities",
  util: "Util",
  world: "World",
  server: "Server",
  client: "Client",
  network: "Network",
  registry: "Registry",
  nbt: "NBT",
  text: "Text",
  sound: "Sound",
  component: "Components",
};

function categoryKey(path: string): string {
  const parts = path.split("/");
  const idx = parts.indexOf("minecraft");
  return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : "other";
}

function categoryLabel(key: string): string {
  return CATEGORY_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function groupByCategory(paths: string[]): Array<[string, string[]]> {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const key = categoryKey(path);
    const list = groups.get(key) ?? [];
    list.push(path);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).sort((a, b) => categoryLabel(a[0]).localeCompare(categoryLabel(b[0])));
}

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  function toggleCategory(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const vanillaGroups = useMemo(() => groupByCategory(vanillaPaths), [vanillaPaths]);

  return (
    <div className="flex h-full min-w-0 flex-col">
      <SectionHeader title="Files" />
      <div className="flex border-b border-zinc-200 text-xs dark:border-zinc-800">
        <button
          className={`flex-1 truncate border-b-2 px-2 py-2 transition-colors ${
            tab === "project"
              ? "border-emerald-500 font-medium text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setTab("project")}
        >
          My Files
        </button>
        <button
          className={`flex-1 truncate border-b-2 px-2 py-2 transition-colors ${
            tab === "vanilla"
              ? "border-emerald-500 font-medium text-zinc-900 dark:text-zinc-100"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
          onClick={() => setTab("vanilla")}
        >
          Vanilla
        </button>
      </div>
      <div className="min-w-0 flex-1 overflow-y-auto p-2 text-sm">
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
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
                onClick={triggerDecompile}
              >
                {cache?.status === "FAILED" ? "Retry decompile" : "Decompile vanilla source"}
              </button>
            )}
            {cache?.status === "IN_PROGRESS" && <p className="text-zinc-400">Decompiling…</p>}
            {cache?.status === "FAILED" && <p className="text-red-500">{cache.errorMessage}</p>}
            <div className="flex flex-col gap-1">
              {vanillaGroups.map(([key, paths]) => (
                <div key={key}>
                  <button
                    className="flex w-full items-center gap-1 rounded px-2 py-1 text-left text-[11px] font-semibold tracking-wide text-zinc-500 uppercase hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                    onClick={() => toggleCategory(key)}
                  >
                    <span className="inline-block w-3 text-zinc-400">{collapsed.has(key) ? "▸" : "▾"}</span>
                    {categoryLabel(key)}
                    <span className="ml-auto font-normal normal-case text-zinc-400">{paths.length}</span>
                  </button>
                  {!collapsed.has(key) && (
                    <ul className="flex flex-col gap-0.5 pl-4">
                      {paths.map((path) => (
                        <li key={path}>
                          <button
                            className="w-full truncate rounded px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900"
                            onClick={() => onSelect({ source: "vanilla", path })}
                            title={path}
                          >
                            {path.split("/").pop()}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
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
