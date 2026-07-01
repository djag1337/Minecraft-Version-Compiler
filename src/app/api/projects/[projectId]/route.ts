import { deleteProject, getProject } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ project });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[projectId]">) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  deleteProject(projectId);
  return new Response(null, { status: 204 });
}
