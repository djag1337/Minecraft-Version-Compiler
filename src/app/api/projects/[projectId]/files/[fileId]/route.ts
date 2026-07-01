import { deleteProjectFile, getProjectFile, upsertProjectFile } from "@/lib/db";

type Ctx = RouteContext<"/api/projects/[projectId]/files/[fileId]">;

export async function GET(_request: Request, ctx: Ctx) {
  const { fileId } = await ctx.params;
  const file = getProjectFile(fileId);
  if (!file) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ file });
}

export async function PUT(request: Request, ctx: Ctx) {
  const { projectId, fileId } = await ctx.params;
  const existing = getProjectFile(fileId);
  if (!existing || existing.projectId !== projectId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  const body = await request.json();
  const content = typeof body.content === "string" ? body.content : existing.content;
  const file = upsertProjectFile({
    projectId,
    path: existing.path,
    content,
    origin: "USER_AUTHORED",
  });
  return Response.json({ file });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { projectId, fileId } = await ctx.params;
  const existing = getProjectFile(fileId);
  if (!existing || existing.projectId !== projectId) {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  deleteProjectFile(fileId);
  return new Response(null, { status: 204 });
}
