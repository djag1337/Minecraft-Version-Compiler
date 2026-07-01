import { describe, expect, it } from "vitest";
import { LocalDryRunDecompileService } from "@/lib/decompileService/localDryRunDecompileService";
import { retrieveVanillaContext } from "@/lib/ai/contextRetrieval";

describe("retrieveVanillaContext", () => {
  it("returns no snippets when the decompile cache doesn't exist yet", async () => {
    const snippets = await retrieveVanillaContext("9.99", "9.99+build.1", "make an ItemStack");
    expect(snippets).toEqual([]);
  });

  it("matches class names mentioned in the query against the manifest", async () => {
    await new LocalDryRunDecompileService().decompile(
      { minecraftVersion: "1.21.1", yarnMappingsVersion: "1.21.1+build.3" },
      () => undefined,
    );

    const snippets = await retrieveVanillaContext(
      "1.21.1",
      "1.21.1+build.3",
      "I want to give the PlayerEntity a custom ItemStack when they right-click",
    );

    const fqcns = snippets.map((s) => s.fqcn);
    expect(fqcns).toContain("net.minecraft.entity.player.PlayerEntity");
    expect(fqcns).toContain("net.minecraft.item.ItemStack");
    expect(snippets.every((s) => s.content.length > 0)).toBe(true);
  });
});
