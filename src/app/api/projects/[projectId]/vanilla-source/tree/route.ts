import fs from "node:fs/promises";
import path from "node:path";
import { getDecompiledSourceCache, getProject } from "@/lib/db";
import type { SourceManifest } from "@/lib/decompileService";

type Ctx = RouteContext<"/api/projects/[projectId]/vanilla-source/tree">;

export async function GET(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const cache = getDecompiledSourceCache(project.minecraftVersion, project.yarnMappingsVersion);
  if (!cache || cache.status !== "READY" || !cache.storagePath) {
    return Response.json({ error: "decompiled source not ready", status: cache?.status ?? "PENDING" }, { status: 409 });
  }

  const manifestPath = path.join(cache.storagePath, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as SourceManifest;
  const paths = Object.values(manifest).sort();
  return Response.json({ paths });
}
