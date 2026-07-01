import { getOrCreateDecompiledSourceCache, getProject, updateDecompiledSourceCache } from "@/lib/db";
import { getDecompileService } from "@/lib/decompileService";
import { decompileLogBus } from "@/lib/logBus";
import { jobQueue } from "@/lib/jobQueue";

type Ctx = RouteContext<"/api/projects/[projectId]/decompile">;

export async function GET(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const cache = getOrCreateDecompiledSourceCache(project.minecraftVersion, project.yarnMappingsVersion);
  return Response.json({ cache });
}

export async function POST(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }

  const cache = getOrCreateDecompiledSourceCache(project.minecraftVersion, project.yarnMappingsVersion);
  if (cache.status === "READY" || cache.status === "IN_PROGRESS") {
    return Response.json({ cache });
  }

  updateDecompiledSourceCache(cache.id, { status: "IN_PROGRESS" });

  jobQueue.enqueue(async () => {
    const result = await getDecompileService().decompile(
      { minecraftVersion: project.minecraftVersion, yarnMappingsVersion: project.yarnMappingsVersion },
      (line) => decompileLogBus.publishLog(cache.id, line),
    );
    if (result.status === "READY") {
      updateDecompiledSourceCache(cache.id, { status: "READY", storagePath: result.storagePath });
    } else {
      updateDecompiledSourceCache(cache.id, { status: "FAILED", errorMessage: result.errorMessage });
    }
    decompileLogBus.publishDone(cache.id);
  });

  return Response.json({ cache: { ...cache, status: "IN_PROGRESS" } }, { status: 202 });
}
