import { LocalDryRunDecompileService } from "./localDryRunDecompileService";
import type { DecompileService } from "./types";

export type {
  DecompileService,
  DecompileRequest,
  DecompileResult,
  DecompileLogCallback,
  SourceManifest,
} from "./types";

let cached: DecompileService | undefined;

/** DockerDecompileService requires a Docker daemon; loaded lazily so dry-run stays dependency-free. */
export function getDecompileService(): DecompileService {
  if (cached) return cached;
  if (process.env.BUILD_SERVICE === "docker") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DockerDecompileService } = require("./dockerDecompileService") as typeof import("./dockerDecompileService");
    cached = new DockerDecompileService();
  } else {
    cached = new LocalDryRunDecompileService();
  }
  return cached;
}
