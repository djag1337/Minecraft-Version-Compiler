import { describe, expect, it } from "vitest";
import { LocalDryRunDecompileService } from "@/lib/decompileService/localDryRunDecompileService";

describe("LocalDryRunDecompileService", () => {
  it("writes stub vanilla classes and a manifest", async () => {
    const service = new LocalDryRunDecompileService();
    const lines: string[] = [];
    const result = await service.decompile(
      { minecraftVersion: "1.21.1", yarnMappingsVersion: "1.21.1+build.3" },
      (line) => lines.push(line),
    );

    expect(result.status).toBe("READY");
    expect(result.storagePath).toBeDefined();
    expect(lines.some((l) => l.includes("BUILD SUCCESSFUL"))).toBe(true);
  });
});
