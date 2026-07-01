import { describe, expect, it } from "vitest";
import {
  addMessage,
  createBuild,
  createProject,
  deleteProjectFile,
  getBuild,
  getOrCreateConversation,
  getOrCreateDecompiledSourceCache,
  getProject,
  getProjectFileByPath,
  listMessages,
  listProjectFiles,
  updateBuildStatus,
  updateDecompiledSourceCache,
  upsertProjectFile,
} from "@/lib/db";

function makeProject() {
  return createProject({
    name: "Test Mod",
    minecraftVersion: "1.21.1",
    yarnMappingsVersion: "1.21.1+build.3",
    fabricLoaderVersion: "0.16.9",
  });
}

describe("projects", () => {
  it("creates and retrieves a project", () => {
    const project = makeProject();
    expect(getProject(project.id)).toEqual(project);
  });
});

describe("project files", () => {
  it("upserts and updates a file by path", () => {
    const project = makeProject();
    const file = upsertProjectFile({
      projectId: project.id,
      path: "src/main/java/Foo.java",
      content: "class Foo {}",
      origin: "USER_AUTHORED",
    });
    expect(listProjectFiles(project.id)).toHaveLength(1);

    const updated = upsertProjectFile({
      projectId: project.id,
      path: "src/main/java/Foo.java",
      content: "class Foo { void bar() {} }",
      origin: "AI_GENERATED",
    });
    expect(updated.id).toBe(file.id);
    expect(updated.content).toContain("bar");
    expect(listProjectFiles(project.id)).toHaveLength(1);
  });

  it("deletes a file", () => {
    const project = makeProject();
    const file = upsertProjectFile({
      projectId: project.id,
      path: "a.java",
      content: "x",
      origin: "USER_AUTHORED",
    });
    deleteProjectFile(file.id);
    expect(getProjectFileByPath(project.id, "a.java")).toBeNull();
  });
});

describe("decompiled source cache", () => {
  it("is created once per (mcVersion, yarnVersion) pair", () => {
    const first = getOrCreateDecompiledSourceCache("1.21.1", "1.21.1+build.3");
    const second = getOrCreateDecompiledSourceCache("1.21.1", "1.21.1+build.3");
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("PENDING");
  });

  it("updates status and storage path", () => {
    const cache = getOrCreateDecompiledSourceCache("1.20.1", "1.20.1+build.10");
    updateDecompiledSourceCache(cache.id, { status: "READY", storagePath: "/tmp/foo" });
    expect(getOrCreateDecompiledSourceCache("1.20.1", "1.20.1+build.10").status).toBe("READY");
  });
});

describe("ai conversation", () => {
  it("returns the same conversation for repeated calls", () => {
    const project = makeProject();
    const c1 = getOrCreateConversation(project.id);
    const c2 = getOrCreateConversation(project.id);
    expect(c2.id).toBe(c1.id);
  });

  it("stores messages with proposed edits", () => {
    const project = makeProject();
    const conversation = getOrCreateConversation(project.id);
    addMessage({ conversationId: conversation.id, role: "USER", content: "make a sword" });
    const assistant = addMessage({
      conversationId: conversation.id,
      role: "ASSISTANT",
      content: "done",
      proposedEdits: [{ path: "a.java", newContent: "x", status: "pending" }],
    });
    const messages = listMessages(conversation.id);
    expect(messages).toHaveLength(2);
    expect(messages[1].proposedEdits?.[0].path).toBe("a.java");
    expect(assistant.proposedEdits?.[0].status).toBe("pending");
  });
});

describe("builds", () => {
  it("tracks status transitions and logs", () => {
    const project = makeProject();
    const build = createBuild(project.id);
    expect(build.status).toBe("QUEUED");

    updateBuildStatus(build.id, "RUNNING", { startedAt: new Date().toISOString() });
    expect(getBuild(build.id)?.status).toBe("RUNNING");

    updateBuildStatus(build.id, "SUCCESS", { artifactPath: "/tmp/out.jar", finishedAt: new Date().toISOString() });
    const finished = getBuild(build.id);
    expect(finished?.status).toBe("SUCCESS");
    expect(finished?.artifactPath).toBe("/tmp/out.jar");
  });
});
