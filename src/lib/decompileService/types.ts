export interface DecompileRequest {
  minecraftVersion: string;
  yarnMappingsVersion: string;
}

export interface DecompileResult {
  status: "READY" | "FAILED";
  /** Directory containing the decompiled tree + manifest.json, if READY. */
  storagePath?: string;
  errorMessage?: string;
}

export type DecompileLogCallback = (line: string) => void;

export interface DecompileService {
  /** Resolves once decompilation finishes (success or failure); never rejects. */
  decompile(request: DecompileRequest, onLog: DecompileLogCallback): Promise<DecompileResult>;
}

/** manifest.json shape written alongside the decompiled tree: FQCN -> relative .java path. */
export type SourceManifest = Record<string, string>;
