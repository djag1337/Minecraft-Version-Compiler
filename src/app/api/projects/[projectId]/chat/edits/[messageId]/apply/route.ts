import { getMessage, getProject, updateMessageProposedEdits, upsertProjectFile } from "@/lib/db";

type Ctx = RouteContext<"/api/projects/[projectId]/chat/edits/[messageId]/apply">;

export async function POST(request: Request, ctx: Ctx) {
  const { projectId, messageId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const message = getMessage(messageId);
  if (!message || !message.proposedEdits) {
    return Response.json({ error: "message not found or has no proposed edits" }, { status: 404 });
  }

  const body = await request.json();
  const targetPath = typeof body.path === "string" ? body.path : "";
  const action = body.action === "reject" ? "reject" : "accept";
  const edit = message.proposedEdits.find((e) => e.path === targetPath);
  if (!edit) {
    return Response.json({ error: "no proposed edit for that path" }, { status: 404 });
  }

  if (action === "accept") {
    upsertProjectFile({
      projectId,
      path: edit.path,
      content: edit.newContent,
      origin: "AI_GENERATED",
    });
  }

  const updatedEdits = message.proposedEdits.map((e) =>
    e.path === targetPath ? { ...e, status: action === "accept" ? ("applied" as const) : ("rejected" as const) } : e,
  );
  updateMessageProposedEdits(messageId, updatedEdits);

  return Response.json({ proposedEdits: updatedEdits });
}
