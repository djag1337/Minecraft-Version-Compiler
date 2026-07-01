export interface MinecraftVersionOption {
  minecraftVersion: string;
  yarnMappingsVersion: string;
  fabricLoaderVersion: string;
}

/**
 * Curated defaults, newest first. A production deployment should replace this
 * with a live call to Fabric's meta API (meta.fabricmc.net/v2/versions/...) —
 * that host is blocked by this sandbox's network policy, so it's hardcoded here.
 */
export const MINECRAFT_VERSION_OPTIONS: MinecraftVersionOption[] = [
  { minecraftVersion: "1.21.4", yarnMappingsVersion: "1.21.4+build.1", fabricLoaderVersion: "0.16.9" },
  { minecraftVersion: "1.21.1", yarnMappingsVersion: "1.21.1+build.3", fabricLoaderVersion: "0.16.9" },
  { minecraftVersion: "1.20.6", yarnMappingsVersion: "1.20.6+build.1", fabricLoaderVersion: "0.16.9" },
  { minecraftVersion: "1.20.4", yarnMappingsVersion: "1.20.4+build.3", fabricLoaderVersion: "0.16.9" },
  { minecraftVersion: "1.20.1", yarnMappingsVersion: "1.20.1+build.10", fabricLoaderVersion: "0.16.9" },
];

export function findVersionOption(minecraftVersion: string): MinecraftVersionOption | undefined {
  return MINECRAFT_VERSION_OPTIONS.find((option) => option.minecraftVersion === minecraftVersion);
}
