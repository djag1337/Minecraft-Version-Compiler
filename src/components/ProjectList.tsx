"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { MinecraftVersionOption } from "@/lib/minecraftVersions";
import type { Project } from "@/lib/db";

export default function ProjectList() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [versions, setVersions] = useState<MinecraftVersionOption[]>([]);
  const [name, setName] = useState("");
  const [minecraftVersion, setMinecraftVersion] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => setProjects(data.projects ?? []));
    fetch("/api/minecraft-versions")
      .then((res) => res.json())
      .then((data) => {
        const opts: MinecraftVersionOption[] = data.versions ?? [];
        setVersions(opts);
        if (opts.length > 0) setMinecraftVersion(opts[0].minecraftVersion);
      });
  }, []);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !minecraftVersion) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, minecraftVersion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "failed to create project");
      }
      const data = await res.json();
      router.push(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to create project");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Minecraft Version Compiler</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe a Fabric mod in plain English, or browse decompiled vanilla source for reference.
        </p>
      </div>

      <form
        onSubmit={createProject}
        className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-medium">New project</h2>
        <input
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none dark:border-zinc-700"
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none dark:border-zinc-700"
          value={minecraftVersion}
          onChange={(e) => setMinecraftVersion(e.target.value)}
        >
          {versions.map((v) => (
            <option key={v.minecraftVersion} value={v.minecraftVersion}>
              Minecraft {v.minecraftVersion} (Fabric Loader {v.fabricLoaderVersion})
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={creating}
          className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          {creating ? "Creating…" : "Create project"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-zinc-500">Your projects</h2>
        {projects.length === 0 && <p className="text-sm text-zinc-400">No projects yet.</p>}
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm transition-colors hover:border-emerald-500/60 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-emerald-500/60"
              >
                <span className="font-medium">{project.name}</span>
                <span className="ml-2 text-zinc-500">Minecraft {project.minecraftVersion}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
