import { createBuild, getProject, listBuilds, listProjectFiles, updateBuildStatus, appendBuildLog } from "@/lib/db";
import { getBuildService } from "@/lib/buildService";
import { buildLogBus } from "@/lib/logBus";
import { jobQueue } from "@/lib/jobQueue";

type Ctx = RouteContext<"/api/projects/[projectId]/builds">;

export async function GET(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  return Response.json({ builds: listBuilds(projectId) });
}

export async function POST(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }

  const build = createBuild(projectId);
  const files = listProjectFiles(projectId).map((file) => ({ path: file.path, content: file.content }));

  jobQueue.enqueue(async () => {
    updateBuildStatus(build.id, "RUNNING", { startedAt: new Date().toISOString() });
    const result = await getBuildService().startBuild(
      {
        buildId: build.id,
        projectId,
        minecraftVersion: project.minecraftVersion,
        yarnMappingsVersion: project.yarnMappingsVersion,
        fabricLoaderVersion: project.fabricLoaderVersion,
        files,
      },
      (line) => {
        appendBuildLog(build.id, line);
        buildLogBus.publishLog(build.id, line);
      },
    );
    updateBuildStatus(build.id, result.status, {
      artifactPath: result.artifactPath ?? null,
      errorMessage: result.errorMessage ?? null,
      finishedAt: new Date().toISOString(),
    });
    buildLogBus.publishDone(build.id);
  });

  return Response.json({ build }, { status: 202 });
}
