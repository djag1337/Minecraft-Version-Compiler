import { getBuild } from "@/lib/db";
import { buildLogBus } from "@/lib/logBus";

type Ctx = RouteContext<"/api/projects/[projectId]/builds/[buildId]/logs">;

const TERMINAL_STATUSES = new Set(["SUCCESS", "FAILED", "CANCELLED"]);

export async function GET(_request: Request, ctx: Ctx) {
  const { buildId } = await ctx.params;
  const build = getBuild(buildId);
  if (!build) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      if (build.logs) {
        send("log", { text: build.logs });
      }

      if (TERMINAL_STATUSES.has(build.status)) {
        send("done", { status: build.status });
        controller.close();
        return;
      }

      unsubscribe = buildLogBus.subscribe(buildId, (event) => {
        if (event.type === "log") {
          send("log", { text: event.line });
        } else {
          const finalBuild = getBuild(buildId);
          send("done", { status: finalBuild?.status ?? "UNKNOWN" });
          controller.close();
        }
      });
    },
    cancel() {
      unsubscribe?.();
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
