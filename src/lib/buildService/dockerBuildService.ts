import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Docker from "dockerode";
import { buildArtifactDir } from "@/lib/paths";
import type { BuildLogCallback, BuildRequest, BuildResult, BuildService } from "./types";

const BUILDER_IMAGE = process.env.DOCKER_BUILDER_IMAGE ?? "mc-mod-builder:latest";
const FABRIC_TEMPLATE_DIR = path.join(process.cwd(), "docker", "builder", "fabric-template");
const BUILD_TIMEOUT_MS = Number(process.env.BUILD_TIMEOUT_MS ?? 15 * 60 * 1000);

/**
 * Real build pipeline: copies the Fabric mod template + the project's current
 * files into a scratch workspace, runs an ephemeral Docker container (JDK +
 * Gradle + Fabric Loom, see docker/builder/) against it, streams logs, and
 * copies the resulting jar out. Requires a reachable Docker daemon and
 * network access to Maven/Fabric repos — neither is available in this dev
 * sandbox, so this class is implemented but only exercised via code review
 * here; verify in an environment with Docker + Maven access.
 */
export class DockerBuildService implements BuildService {
  private docker = new Docker();

  async startBuild(request: BuildRequest, onLog: BuildLogCallback): Promise<BuildResult> {
    const emit = (line: string) => onLog(line.endsWith("\n") ? line : `${line}\n`);
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `mc-build-${request.buildId}-`));

    try {
      await copyDirectory(FABRIC_TEMPLATE_DIR, workspaceDir);
      await writeGradleProperties(workspaceDir, request);
      await writeProjectFiles(workspaceDir, request.files);

      emit(`> Starting build container from ${BUILDER_IMAGE}`);
      const container = await this.docker.createContainer({
        Image: BUILDER_IMAGE,
        Cmd: ["build"],
        HostConfig: {
          Binds: [`${workspaceDir}:/workspace`],
          AutoRemove: false,
          Memory: 2 * 1024 * 1024 * 1024,
          NanoCpus: 2 * 1_000_000_000,
        },
        Tty: false,
      });

      const result = await runContainerWithTimeout(container, emit, BUILD_TIMEOUT_MS);

      if (result.timedOut) {
        return { status: "FAILED", errorMessage: `Build timed out after ${BUILD_TIMEOUT_MS}ms` };
      }
      if (result.exitCode !== 0) {
        return { status: "FAILED", errorMessage: `Gradle build exited with code ${result.exitCode}` };
      }

      const jarPath = await findBuiltJar(workspaceDir);
      if (!jarPath) {
        return { status: "FAILED", errorMessage: "Build reported success but no jar was found in build/libs" };
      }

      const artifactDir = buildArtifactDir(request.buildId);
      await fs.mkdir(artifactDir, { recursive: true });
      const artifactPath = path.join(artifactDir, path.basename(jarPath));
      await fs.copyFile(jarPath, artifactPath);

      return { status: "SUCCESS", artifactPath };
    } catch (err) {
      emit(`> Build error: ${err instanceof Error ? err.message : String(err)}`);
      return { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) };
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.cp(src, dest, { recursive: true });
}

async function writeGradleProperties(workspaceDir: string, request: BuildRequest): Promise<void> {
  const propertiesPath = path.join(workspaceDir, "gradle.properties");
  const contents =
    `minecraft_version=${request.minecraftVersion}\n` +
    `yarn_mappings=${request.yarnMappingsVersion}\n` +
    `loader_version=${request.fabricLoaderVersion}\n`;
  await fs.appendFile(propertiesPath, `\n${contents}`);
}

async function writeProjectFiles(
  workspaceDir: string,
  files: BuildRequest["files"],
): Promise<void> {
  for (const file of files) {
    const target = path.join(workspaceDir, file.path);
    if (!target.startsWith(workspaceDir)) {
      throw new Error(`Refusing to write outside workspace: ${file.path}`);
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content);
  }
}

async function runContainerWithTimeout(
  container: Docker.Container,
  emit: (line: string) => void,
  timeoutMs: number,
): Promise<{ exitCode: number; timedOut: boolean }> {
  const stream = await container.attach({ stream: true, stdout: true, stderr: true });
  await container.start();

  container.modem.demuxStream(
    stream,
    { write: (chunk: Buffer) => emit(chunk.toString("utf8")) },
    { write: (chunk: Buffer) => emit(chunk.toString("utf8")) },
  );

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void container.kill().catch(() => undefined);
  }, timeoutMs);

  try {
    const waitResult = (await container.wait()) as { StatusCode: number };
    return { exitCode: waitResult.StatusCode, timedOut };
  } finally {
    clearTimeout(timeout);
    await container.remove({ force: true }).catch(() => undefined);
  }
}

async function findBuiltJar(workspaceDir: string): Promise<string | null> {
  const libsDir = path.join(workspaceDir, "build", "libs");
  try {
    const entries = await fs.readdir(libsDir);
    const jar = entries.find((name) => name.endsWith(".jar") && !name.endsWith("-sources.jar"));
    return jar ? path.join(libsDir, jar) : null;
  } catch {
    return null;
  }
}
