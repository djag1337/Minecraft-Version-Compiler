import { LocalDryRunBuildService } from "./localDryRunBuildService";
import type { BuildService } from "./types";

export type { BuildService, BuildRequest, BuildResult, BuildFileInput, BuildLogCallback } from "./types";

let cached: BuildService | undefined;

/** DockerBuildService requires a Docker daemon; loaded lazily so dry-run stays dependency-free. */
export function getBuildService(): BuildService {
  if (cached) return cached;
  if (process.env.BUILD_SERVICE === "docker") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DockerBuildService } = require("./dockerBuildService") as typeof import("./dockerBuildService");
    cached = new DockerBuildService();
  } else {
    cached = new LocalDryRunBuildService();
  }
  return cached;
}
