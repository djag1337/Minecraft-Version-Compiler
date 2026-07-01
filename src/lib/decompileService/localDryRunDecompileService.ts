import fs from "node:fs/promises";
import path from "node:path";
import { decompiledSourceDir } from "@/lib/paths";
import type {
  DecompileLogCallback,
  DecompileRequest,
  DecompileResult,
  DecompileService,
  SourceManifest,
} from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A handful of canned stub "vanilla" classes using real Yarn-mapping class
 * names/packages, so file-tree browsing and AI context retrieval can be
 * built and tested without reaching maven.fabricmc.net (blocked in this
 * sandbox). Real decompilation is DockerDecompileService.
 */
const STUB_CLASSES: Record<string, string> = {
  "net/minecraft/item/Item.java": `package net.minecraft.item;

/** Stub decompiled source for local dry-run mode — not real Mojang/Yarn output. */
public class Item {
    public static final int DEFAULT_MAX_COUNT = 64;

    private final int maxCount;

    public Item(Settings settings) {
        this.maxCount = settings.maxCount;
    }

    public int getMaxCount() {
        return this.maxCount;
    }

    public static class Settings {
        int maxCount = DEFAULT_MAX_COUNT;

        public Settings maxCount(int maxCount) {
            this.maxCount = maxCount;
            return this;
        }
    }
}
`,
  "net/minecraft/item/ItemStack.java": `package net.minecraft.item;

/** Stub decompiled source for local dry-run mode — not real Mojang/Yarn output. */
public class ItemStack {
    private final Item item;
    private int count;

    public ItemStack(Item item, int count) {
        this.item = item;
        this.count = count;
    }

    public Item getItem() {
        return this.item;
    }

    public int getCount() {
        return this.count;
    }
}
`,
  "net/minecraft/entity/player/PlayerEntity.java": `package net.minecraft.entity.player;

import net.minecraft.item.ItemStack;

/** Stub decompiled source for local dry-run mode — not real Mojang/Yarn output. */
public class PlayerEntity {
    public ItemStack getMainHandStack() {
        throw new UnsupportedOperationException("stub");
    }

    public void sendMessage(String message) {
        throw new UnsupportedOperationException("stub");
    }
}
`,
  "net/minecraft/block/Block.java": `package net.minecraft.block;

/** Stub decompiled source for local dry-run mode — not real Mojang/Yarn output. */
public class Block {
    private final Settings settings;

    public Block(Settings settings) {
        this.settings = settings;
    }

    public static class Settings {
        public static Settings create() {
            return new Settings();
        }
    }
}
`,
  "net/minecraft/util/ActionResult.java": `package net.minecraft.util;

/** Stub decompiled source for local dry-run mode — not real Mojang/Yarn output. */
public enum ActionResult {
    SUCCESS,
    CONSUME,
    PASS,
    FAIL;
}
`,
};

export class LocalDryRunDecompileService implements DecompileService {
  async decompile(request: DecompileRequest, onLog: DecompileLogCallback): Promise<DecompileResult> {
    const emit = (line: string) => onLog(line.endsWith("\n") ? line : `${line}\n`);

    emit(`> Decompiling Minecraft ${request.minecraftVersion} with Yarn ${request.yarnMappingsVersion} (dry run, no Fabric Maven access in this environment)`);
    await sleep(100);
    emit(`> Task :genSources`);

    const outDir = decompiledSourceDir(request.minecraftVersion, request.yarnMappingsVersion);
    const manifest: SourceManifest = {};

    for (const [relativePath, content] of Object.entries(STUB_CLASSES)) {
      const targetPath = path.join(outDir, relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content);
      const fqcn = relativePath.replace(/\.java$/, "").replace(/\//g, ".");
      manifest[fqcn] = relativePath;
      emit(`  wrote ${relativePath}`);
      await sleep(20);
    }

    await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    emit(`BUILD SUCCESSFUL (dry run)`);
    return { status: "READY", storagePath: outDir };
  }
}
