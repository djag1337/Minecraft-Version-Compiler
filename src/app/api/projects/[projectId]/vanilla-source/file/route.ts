import fs from "node:fs/promises";
import path from "node:path";
import { getDecompiledSourceCache, getProject } from "@/lib/db";

type Ctx = RouteContext<"/api/projects/[projectId]/vanilla-source/file">;

export async function GET(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const cache = getDecompiledSourceCache(project.minecraftVersion, project.yarnMappingsVersion);
  if (!cache || cache.status !== "READY" || !cache.storagePath) {
    return Response.json({ error: "decompiled source not ready" }, { status: 409 });
  }

  const relativePath = new URL(request.url).searchParams.get("path");
  if (!relativePath) {
    return Response.json({ error: "path query param is required" }, { status: 400 });
  }

  const root = path.resolve(cache.storagePath);
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return Response.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const content = await fs.readFile(resolved, "utf8");
    return Response.json({ path: relativePath, content });
  } catch {
    return Response.json({ error: "file not found" }, { status: 404 });
  }
}
