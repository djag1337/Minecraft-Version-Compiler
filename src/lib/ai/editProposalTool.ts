import type Anthropic from "@anthropic-ai/sdk";

export const PROPOSE_FILE_EDIT_TOOL_NAME = "propose_file_edit";

/** Claude calls this instead of putting code in prose, so edits parse as structured data, not markdown fences. */
export const proposeFileEditTool: Anthropic.Tool = {
  name: PROPOSE_FILE_EDIT_TOOL_NAME,
  description:
    "Propose creating or overwriting a project file with new, complete file contents. " +
    "Call once per file that needs to change. Always send the FULL file contents, not a diff.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "Project-relative file path, e.g. src/main/java/com/example/examplemod/ExampleMod.java",
      },
      content: {
        type: "string",
        description: "The complete new contents of the file.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
};

export interface ProposeFileEditInput {
  path: string;
  content: string;
}

function isProposeFileEditInput(value: unknown): value is ProposeFileEditInput {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).path === "string" &&
    typeof (value as Record<string, unknown>).content === "string"
  );
}

/** Extracts propose_file_edit tool calls from a completed message's content blocks. */
export function extractProposedEdits(content: Anthropic.ContentBlock[]): ProposeFileEditInput[] {
  const edits: ProposeFileEditInput[] = [];
  for (const block of content) {
    if (block.type === "tool_use" && block.name === PROPOSE_FILE_EDIT_TOOL_NAME) {
      if (isProposeFileEditInput(block.input)) {
        edits.push(block.input);
      }
    }
  }
  return edits;
}

/** Concatenates the text blocks of a completed message for display as the assistant's chat bubble. */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
