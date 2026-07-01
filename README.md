# Minecraft Version Compiler

A web app for building custom Minecraft (Java Edition) Fabric mods: describe a
mod in plain English and let Claude propose the Java source, or browse
decompiled vanilla source for a chosen Minecraft version as reference while
you write.

## Stack

- Next.js (App Router, TypeScript) — single deploy unit; API routes double as
  the backend and support SSE streaming for chat + build logs.
- SQLite via Node's built-in `node:sqlite` — zero external infra.
- `@anthropic-ai/sdk` for AI-assisted mod authoring (streamed chat, a
  `propose_file_edit` tool, review-before-apply).
- `dockerode` for the real sandboxed build/decompile pipeline
  (`docker/builder/`), with a dependency-free dry-run stand-in used by default
  in development and tests.

## Getting started

```bash
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, create a project (pick a Minecraft version), then
use the chat panel to describe a mod feature, review/accept the proposed file
edits, and trigger a build.

## Build modes

`BUILD_SERVICE` selects which implementation handles builds and decompiles:

- `dryrun` (default) — no Docker required. Emits realistic log output and a
  deterministic result so the UI, database, and SSE log streaming can be
  exercised without a Docker daemon or Fabric Maven access.
- `docker` — the real pipeline. Requires a reachable Docker daemon and network
  access to Fabric's Maven repositories. Build the builder image first:
  `docker build -t mc-mod-builder:latest docker/builder`.

## Tests

```bash
npm run test        # vitest unit tests
npm run lint         # eslint
npx tsc --noEmit     # typecheck (run `npx next typegen` first if types are stale)
```
