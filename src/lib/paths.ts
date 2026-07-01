import path from "node:path";

export const STORAGE_DIR = process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage");
export const BUILDS_DIR = path.join(STORAGE_DIR, "builds");
export const DECOMPILED_DIR = path.join(STORAGE_DIR, "decompiled");

export function buildArtifactDir(buildId: string): string {
  return path.join(BUILDS_DIR, buildId);
}

function cacheKey(minecraftVersion: string, yarnMappingsVersion: string): string {
  return `${minecraftVersion}__${yarnMappingsVersion}`.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function decompiledSourceDir(minecraftVersion: string, yarnMappingsVersion: string): string {
  return path.join(DECOMPILED_DIR, cacheKey(minecraftVersion, yarnMappingsVersion));
}
