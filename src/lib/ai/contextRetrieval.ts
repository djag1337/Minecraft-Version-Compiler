import fs from "node:fs/promises";
import path from "node:path";
import { decompiledSourceDir } from "@/lib/paths";
import type { SourceManifest } from "@/lib/decompileService";

export interface VanillaSourceSnippet {
  fqcn: string;
  relativePath: string;
  content: string;
}

const MAX_SNIPPETS = 5;
const IDENTIFIER_PATTERN = /\b(?:net\.minecraft(?:\.[a-zA-Z_][\w]*)+|[A-Z][a-zA-Z0-9_]{2,})\b/g;

function extractCandidateIdentifiers(text: string): string[] {
  const matches = text.match(IDENTIFIER_PATTERN) ?? [];
  return Array.from(new Set(matches));
}

async function loadManifest(minecraftVersion: string, yarnMappingsVersion: string): Promise<SourceManifest | null> {
  const manifestPath = path.join(decompiledSourceDir(minecraftVersion, yarnMappingsVersion), "manifest.json");
  try {
    const raw = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(raw) as SourceManifest;
  } catch {
    return null;
  }
}

/**
 * Heuristic retrieval (no vector DB for v1): pulls candidate class names out of
 * the user's message and current project files, matches them against the
 * decompiled-source manifest (exact class name, then substring), and returns
 * the top few matching files as context for the AI chat prompt.
 */
export async function retrieveVanillaContext(
  minecraftVersion: string,
  yarnMappingsVersion: string,
  queryText: string,
): Promise<VanillaSourceSnippet[]> {
  const manifest = await loadManifest(minecraftVersion, yarnMappingsVersion);
  if (!manifest) return [];

  const candidates = extractCandidateIdentifiers(queryText);
  if (candidates.length === 0) return [];

  const entries = Object.entries(manifest);
  const matchedFqcns = new Set<string>();

  for (const candidate of candidates) {
    for (const [fqcn] of entries) {
      const simpleName = fqcn.split(".").pop();
      if (fqcn === candidate || simpleName === candidate) {
        matchedFqcns.add(fqcn);
      }
    }
  }

  if (matchedFqcns.size < MAX_SNIPPETS) {
    for (const candidate of candidates) {
      for (const [fqcn] of entries) {
        if (matchedFqcns.size >= MAX_SNIPPETS) break;
        if (fqcn.includes(candidate)) {
          matchedFqcns.add(fqcn);
        }
      }
    }
  }

  const sourceDir = decompiledSourceDir(minecraftVersion, yarnMappingsVersion);
  const snippets: VanillaSourceSnippet[] = [];
  for (const fqcn of Array.from(matchedFqcns).slice(0, MAX_SNIPPETS)) {
    const relativePath = manifest[fqcn];
    try {
      const content = await fs.readFile(path.join(sourceDir, relativePath), "utf8");
      snippets.push({ fqcn, relativePath, content });
    } catch {
      // file listed in manifest but missing on disk; skip
    }
  }
  return snippets;
}
