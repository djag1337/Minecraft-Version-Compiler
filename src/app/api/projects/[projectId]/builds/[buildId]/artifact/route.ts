import fs from "node:fs/promises";
import path from "node:path";
import { getBuild } from "@/lib/db";

type Ctx = RouteContext<"/api/projects/[projectId]/builds/[buildId]/artifact">;

export async function GET(_request: Request, ctx: Ctx) {
  const { buildId } = await ctx.params;
  const build = getBuild(buildId);
  if (!build || build.status !== "SUCCESS" || !build.artifactPath) {
    return Response.json({ error: "artifact not available" }, { status: 404 });
  }

  const data = await fs.readFile(build.artifactPath);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/java-archive",
      "Content-Disposition": `attachment; filename="${path.basename(build.artifactPath)}"`,
    },
  });
}
