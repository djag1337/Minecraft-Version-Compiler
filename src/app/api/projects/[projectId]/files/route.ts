import { getProject, listProjectFiles, upsertProjectFile } from "@/lib/db";

export async function GET(_request: Request, ctx: RouteContext<"/api/projects/[projectId]/files">) {
  const { projectId } = await ctx.params;
  if (!getProject(projectId)) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  return Response.json({ files: listProjectFiles(projectId) });
}

export async function POST(request: Request, ctx: RouteContext<"/api/projects/[projectId]/files">) {
  const { projectId } = await ctx.params;
  if (!getProject(projectId)) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const body = await request.json();
  const filePath = typeof body.path === "string" ? body.path : "";
  const content = typeof body.content === "string" ? body.content : "";
  if (!filePath) {
    return Response.json({ error: "path is required" }, { status: 400 });
  }
  const file = upsertProjectFile({ projectId, path: filePath, content, origin: "USER_AUTHORED" });
  return Response.json({ file }, { status: 201 });
}
