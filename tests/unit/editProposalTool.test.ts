import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { extractProposedEdits, extractText } from "@/lib/ai/editProposalTool";

describe("extractText", () => {
  it("concatenates text blocks and ignores tool_use blocks", () => {
    const content = [
      { type: "text", text: "Here you go: " } as Anthropic.TextBlock,
      { type: "tool_use", id: "1", name: "propose_file_edit", input: {} } as Anthropic.ToolUseBlock,
      { type: "text", text: "done." } as Anthropic.TextBlock,
    ] as Anthropic.ContentBlock[];
    expect(extractText(content)).toBe("Here you go: done.");
  });
});

describe("extractProposedEdits", () => {
  it("extracts well-formed propose_file_edit tool calls", () => {
    const content = [
      { type: "text", text: "Adding a sword." } as Anthropic.TextBlock,
      {
        type: "tool_use",
        id: "1",
        name: "propose_file_edit",
        input: { path: "src/main/java/Sword.java", content: "class Sword {}" },
      } as Anthropic.ToolUseBlock,
    ] as Anthropic.ContentBlock[];

    const edits = extractProposedEdits(content);
    expect(edits).toEqual([{ path: "src/main/java/Sword.java", content: "class Sword {}" }]);
  });

  it("ignores tool_use blocks for other tools or malformed input", () => {
    const content = [
      { type: "tool_use", id: "1", name: "some_other_tool", input: { foo: "bar" } } as Anthropic.ToolUseBlock,
      { type: "tool_use", id: "2", name: "propose_file_edit", input: { path: "x" } } as Anthropic.ToolUseBlock,
    ] as Anthropic.ContentBlock[];

    expect(extractProposedEdits(content)).toEqual([]);
  });
});
