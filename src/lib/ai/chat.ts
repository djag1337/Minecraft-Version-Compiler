import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_MODEL } from "@/lib/anthropic";
import type { AiMessage, Project, ProjectFile, ProposedEdit } from "@/lib/db";
import { retrieveVanillaContext } from "./contextRetrieval";
import { extractProposedEdits, extractText, proposeFileEditTool } from "./editProposalTool";

export interface ChatTurnResult {
  assistantText: string;
  proposedEdits: ProposedEdit[];
}

function buildSystemPrompt(
  project: Project,
  projectFiles: ProjectFile[],
  vanillaSnippets: Awaited<ReturnType<typeof retrieveVanillaContext>>,
): string {
  const fileList = projectFiles.length
    ? projectFiles
        .map((file) => `--- ${file.path} (${file.origin}) ---\n${file.content}`)
        .join("\n\n")
    : "(no files yet)";

  const vanillaContext = vanillaSnippets.length
    ? vanillaSnippets
        .map((snippet) => `--- Vanilla source: ${snippet.relativePath} (${snippet.fqcn}) ---\n${snippet.content}`)
        .join("\n\n")
    : "(no relevant vanilla source found for this message)";

  return `You are an expert Minecraft Fabric mod developer helping a user build a mod.

Project: Minecraft ${project.minecraftVersion}, Fabric Loader ${project.fabricLoaderVersion}, Yarn mappings ${project.yarnMappingsVersion}.

Current project files:
${fileList}

Relevant decompiled vanilla source (for reference/grounding only — do not modify these; use them to understand how to hook into vanilla behavior):
${vanillaContext}

When the user asks for a mod feature or a code change, use the ${proposeFileEditTool.name} tool to propose the full contents of each file that needs to be created or changed. Always send complete file contents, not a diff. Briefly explain what you're doing in your text response, but put all code exclusively through the tool. Do not propose edits to files under net/minecraft/ (vanilla source is read-only reference).`;
}

function toAnthropicHistory(messages: AiMessage[]): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
  }));
}

export async function runChatTurn(params: {
  project: Project;
  projectFiles: ProjectFile[];
  conversationHistory: AiMessage[];
  userMessage: string;
  onTextDelta?: (delta: string) => void;
}): Promise<ChatTurnResult> {
  const { project, projectFiles, conversationHistory, userMessage, onTextDelta } = params;

  const vanillaSnippets = await retrieveVanillaContext(
    project.minecraftVersion,
    project.yarnMappingsVersion,
    `${userMessage}\n${projectFiles.map((f) => f.content).join("\n")}`,
  );

  const messages: Anthropic.MessageParam[] = [
    ...toAnthropicHistory(conversationHistory),
    { role: "user", content: userMessage },
  ];

  const stream = anthropic.messages.stream({
    model: CHAT_MODEL,
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: buildSystemPrompt(project, projectFiles, vanillaSnippets),
    tools: [proposeFileEditTool],
    messages,
  });

  if (onTextDelta) {
    stream.on("text", (delta) => onTextDelta(delta));
  }

  const finalMessage = await stream.finalMessage();

  if (finalMessage.stop_reason === "refusal") {
    return {
      assistantText:
        "I'm not able to help with that request (the request was declined by safety checks). Try rephrasing.",
      proposedEdits: [],
    };
  }

  const assistantText = extractText(finalMessage.content);
  const proposedEdits: ProposedEdit[] = extractProposedEdits(finalMessage.content).map((edit) => ({
    path: edit.path,
    newContent: edit.content,
    status: "pending",
  }));

  return { assistantText, proposedEdits };
}
