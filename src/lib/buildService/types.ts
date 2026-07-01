export interface BuildFileInput {
  path: string;
  content: string;
}

export interface BuildRequest {
  buildId: string;
  projectId: string;
  minecraftVersion: string;
  yarnMappingsVersion: string;
  fabricLoaderVersion: string;
  files: BuildFileInput[];
}

export interface BuildResult {
  status: "SUCCESS" | "FAILED";
  artifactPath?: string;
  errorMessage?: string;
}

export type BuildLogCallback = (line: string) => void;

export interface BuildService {
  /** Resolves once the build finishes (success or failure); never rejects. */
  startBuild(request: BuildRequest, onLog: BuildLogCallback): Promise<BuildResult>;
}
