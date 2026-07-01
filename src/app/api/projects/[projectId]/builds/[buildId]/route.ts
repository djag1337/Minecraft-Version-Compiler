import { getBuild } from "@/lib/db";

type Ctx = RouteContext<"/api/projects/[projectId]/builds/[buildId]">;

export async function GET(_request: Request, ctx: Ctx) {
  const { buildId } = await ctx.params;
  const build = getBuild(buildId);
  if (!build) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ build });
}
