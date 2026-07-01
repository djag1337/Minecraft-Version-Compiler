import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import Docker from "dockerode";
import { decompiledSourceDir } from "@/lib/paths";
import type {
  DecompileLogCallback,
  DecompileRequest,
  DecompileResult,
  DecompileService,
  SourceManifest,
} from "./types";

const BUILDER_IMAGE = process.env.DOCKER_BUILDER_IMAGE ?? "mc-mod-builder:latest";
const FABRIC_TEMPLATE_DIR = path.join(process.cwd(), "docker", "builder", "fabric-template");
const DECOMPILE_TIMEOUT_MS = Number(process.env.DECOMPILE_TIMEOUT_MS ?? 20 * 60 * 1000);

/**
 * Real decompile pipeline: runs `./gradlew genSources` (Fabric Loom) inside
 * an ephemeral container for the requested (minecraftVersion,
 * yarnMappingsVersion) pair, using Loom's own runtime download of Mojang's
 * version manifest + community Yarn mappings — nothing Mojang-derived is
 * ever committed to this repo/image. The container's entrypoint (see
 * docker/builder/entrypoint.sh) locates Loom's decompiled-sources output and
 * copies it to /workspace/output so the host only needs one well-known path.
 * Requires a reachable Docker daemon and Maven/Fabric network access —
 * neither is available in this dev sandbox; verify in an environment that has both.
 */
export class DockerDecompileService implements DecompileService {
  private docker = new Docker();

  async decompile(request: DecompileRequest, onLog: DecompileLogCallback): Promise<DecompileResult> {
    const emit = (line: string) => onLog(line.endsWith("\n") ? line : `${line}\n`);
    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), `mc-decompile-`));

    try {
      await fs.cp(FABRIC_TEMPLATE_DIR, workspaceDir, { recursive: true });
      await fs.appendFile(
        path.join(workspaceDir, "gradle.properties"),
        `\nminecraft_version=${request.minecraftVersion}\nyarn_mappings=${request.yarnMappingsVersion}\n`,
      );

      emit(`> Starting decompile container from ${BUILDER_IMAGE}`);
      const container = await this.docker.createContainer({
        Image: BUILDER_IMAGE,
        Cmd: ["genSources"],
        HostConfig: {
          Binds: [`${workspaceDir}:/workspace`],
          Memory: 4 * 1024 * 1024 * 1024,
          NanoCpus: 2 * 1_000_000_000,
        },
        Tty: false,
      });

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
      }, DECOMPILE_TIMEOUT_MS);

      let exitCode: number;
      try {
        const waitResult = (await container.wait()) as { StatusCode: number };
        exitCode = waitResult.StatusCode;
      } finally {
        clearTimeout(timeout);
        await container.remove({ force: true }).catch(() => undefined);
      }

      if (timedOut) {
        return { status: "FAILED", errorMessage: `Decompile timed out after ${DECOMPILE_TIMEOUT_MS}ms` };
      }
      if (exitCode !== 0) {
        return { status: "FAILED", errorMessage: `genSources exited with code ${exitCode}` };
      }

      const outputDir = path.join(workspaceDir, "output");
      const outDir = decompiledSourceDir(request.minecraftVersion, request.yarnMappingsVersion);
      await fs.mkdir(outDir, { recursive: true });
      await fs.cp(outputDir, outDir, { recursive: true });

      const manifest = await buildManifest(outDir);
      await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      return { status: "READY", storagePath: outDir };
    } catch (err) {
      emit(`> Decompile error: ${err instanceof Error ? err.message : String(err)}`);
      return { status: "FAILED", errorMessage: err instanceof Error ? err.message : String(err) };
    } finally {
      await fs.rm(workspaceDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** Walks the decompiled tree; each *.java file's path IS its FQCN (standard package layout). */
async function buildManifest(rootDir: string): Promise<SourceManifest> {
  const manifest: SourceManifest = {};

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".java")) {
        const relativePath = path.relative(rootDir, fullPath);
        const fqcn = relativePath.replace(/\.java$/, "").replace(/[\\/]/g, ".");
        manifest[fqcn] = relativePath;
      }
    }
  }

  await walk(rootDir);
  return manifest;
}
