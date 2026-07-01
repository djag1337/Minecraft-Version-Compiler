import fs from "node:fs/promises";
import path from "node:path";
import { buildArtifactDir } from "@/lib/paths";
import type { BuildLogCallback, BuildRequest, BuildResult, BuildService } from "./types";

const STEP_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Naive sanity check standing in for "does this compile": balanced braces. */
function looksSyntacticallyValid(files: BuildRequest["files"]): { ok: boolean; badFile?: string } {
  for (const file of files) {
    if (!file.path.endsWith(".java")) continue;
    let depth = 0;
    for (const char of file.content) {
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth < 0) return { ok: false, badFile: file.path };
    }
    if (depth !== 0) return { ok: false, badFile: file.path };
  }
  return { ok: true };
}

/**
 * Stand-in for DockerBuildService: no Docker daemon required. Emits realistic
 * log lines and a deterministic result so the queue, DB status transitions,
 * SSE log streaming, and frontend can be exercised without Docker/Gradle/Fabric
 * Maven access. Selected by default and whenever BUILD_SERVICE=dryrun.
 */
export class LocalDryRunBuildService implements BuildService {
  async startBuild(request: BuildRequest, onLog: BuildLogCallback): Promise<BuildResult> {
    const emit = (line: string) => onLog(line.endsWith("\n") ? line : `${line}\n`);

    emit(`> Configuring project (dry run, no Docker daemon in this environment)`);
    emit(`> Minecraft ${request.minecraftVersion}, Yarn ${request.yarnMappingsVersion}, Fabric Loader ${request.fabricLoaderVersion}`);
    await sleep(STEP_DELAY_MS);

    emit(`> Task :compileJava`);
    for (const file of request.files) {
      emit(`  compiling ${file.path}`);
      await sleep(30);
    }
    await sleep(STEP_DELAY_MS);

    const check = looksSyntacticallyValid(request.files);
    if (!check.ok) {
      emit(`> Task :compileJava FAILED`);
      emit(`error: unbalanced braces in ${check.badFile}`);
      return {
        status: "FAILED",
        errorMessage: `Compilation failed: unbalanced braces in ${check.badFile}`,
      };
    }

    emit(`> Task :processResources`);
    await sleep(STEP_DELAY_MS);
    emit(`> Task :jar`);
    await sleep(STEP_DELAY_MS);

    const artifactDir = buildArtifactDir(request.buildId);
    await fs.mkdir(artifactDir, { recursive: true });
    const artifactPath = path.join(artifactDir, `${request.projectId}-dryrun.jar`);
    await fs.writeFile(
      artifactPath,
      `Dry-run placeholder artifact for build ${request.buildId}. No real jar was compiled — ` +
        `this environment has no Docker daemon / Fabric Maven access. See DockerBuildService for the real pipeline.\n`,
    );

    emit(`BUILD SUCCESSFUL (dry run)`);
    return { status: "SUCCESS", artifactPath };
  }
}
