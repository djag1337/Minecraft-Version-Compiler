import { addMessage, getOrCreateConversation, getProject, listMessages, listProjectFiles } from "@/lib/db";
import { runChatTurn } from "@/lib/ai/chat";

type Ctx = RouteContext<"/api/projects/[projectId]/chat">;

export async function GET(_request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }
  const conversation = getOrCreateConversation(projectId);
  return Response.json({ messages: listMessages(conversation.id) });
}

export async function POST(request: Request, ctx: Ctx) {
  const { projectId } = await ctx.params;
  const project = getProject(projectId);
  if (!project) {
    return Response.json({ error: "project not found" }, { status: 404 });
  }

  const body = await request.json();
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!userMessage) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  const conversation = getOrCreateConversation(projectId);
  const history = listMessages(conversation.id);
  addMessage({ conversationId: conversation.id, role: "USER", content: userMessage });
  const projectFiles = listProjectFiles(projectId);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        const result = await runChatTurn({
          project,
          projectFiles,
          conversationHistory: history,
          userMessage,
          onTextDelta: (delta) => send("delta", { text: delta }),
        });
        const assistantMessage = addMessage({
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: result.assistantText,
          proposedEdits: result.proposedEdits,
        });
        send("done", { message: assistantMessage });
      } catch (err) {
        const errorText = err instanceof Error ? err.message : String(err);
        const assistantMessage = addMessage({
          conversationId: conversation.id,
          role: "ASSISTANT",
          content: `Error: ${errorText}`,
        });
        send("error", { message: errorText, message_row: assistantMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
