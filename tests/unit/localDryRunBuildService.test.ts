import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import { LocalDryRunBuildService } from "@/lib/buildService/localDryRunBuildService";

describe("LocalDryRunBuildService", () => {
  it("succeeds and writes a placeholder artifact for syntactically balanced files", async () => {
    const service = new LocalDryRunBuildService();
    const lines: string[] = [];
    const result = await service.startBuild(
      {
        buildId: "build-1",
        projectId: "project-1",
        minecraftVersion: "1.21.1",
        yarnMappingsVersion: "1.21.1+build.3",
        fabricLoaderVersion: "0.16.9",
        files: [{ path: "src/main/java/Foo.java", content: "class Foo { void bar() {} }" }],
      },
      (line) => lines.push(line),
    );

    expect(result.status).toBe("SUCCESS");
    expect(result.artifactPath).toBeDefined();
    expect(lines.some((l) => l.includes("BUILD SUCCESSFUL"))).toBe(true);

    const artifact = await fs.readFile(result.artifactPath!, "utf8");
    expect(artifact).toContain("Dry-run placeholder artifact");
  });

  it("fails when a file has unbalanced braces", async () => {
    const service = new LocalDryRunBuildService();
    const result = await service.startBuild(
      {
        buildId: "build-2",
        projectId: "project-1",
        minecraftVersion: "1.21.1",
        yarnMappingsVersion: "1.21.1+build.3",
        fabricLoaderVersion: "0.16.9",
        files: [{ path: "src/main/java/Bad.java", content: "class Bad { void bar() {}" }],
      },
      () => undefined,
    );

    expect(result.status).toBe("FAILED");
    expect(result.errorMessage).toContain("Bad.java");
  });
});
