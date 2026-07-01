import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type FileOrigin = "AI_GENERATED" | "USER_AUTHORED";
export type CacheStatus = "PENDING" | "IN_PROGRESS" | "READY" | "FAILED";
export type MessageRole = "USER" | "ASSISTANT";
export type BuildStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface Project {
  id: string;
  name: string;
  minecraftVersion: string;
  yarnMappingsVersion: string;
  fabricLoaderVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  content: string;
  origin: FileOrigin;
  createdAt: string;
  updatedAt: string;
}

export interface DecompiledSourceCache {
  id: string;
  minecraftVersion: string;
  yarnMappingsVersion: string;
  status: CacheStatus;
  storagePath: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversation {
  id: string;
  projectId: string;
  createdAt: string;
}

export interface ProposedEdit {
  path: string;
  newContent: string;
  status: "pending" | "applied" | "rejected";
}

export interface AiMessage {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  proposedEdits: ProposedEdit[] | null;
  createdAt: string;
}

export interface Build {
  id: string;
  projectId: string;
  status: BuildStatus;
  logs: string;
  artifactPath: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = process.env.DATABASE_PATH ?? path.join(DATA_DIR, "app.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  minecraft_version TEXT NOT NULL,
  yarn_mappings_version TEXT NOT NULL,
  fabric_loader_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('AI_GENERATED', 'USER_AUTHORED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (project_id, path)
);

CREATE TABLE IF NOT EXISTS decompiled_source_cache (
  id TEXT PRIMARY KEY,
  minecraft_version TEXT NOT NULL,
  yarn_mappings_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'IN_PROGRESS', 'READY', 'FAILED')),
  storage_path TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (minecraft_version, yarn_mappings_version)
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
  content TEXT NOT NULL,
  proposed_edits TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED')),
  logs TEXT NOT NULL DEFAULT '',
  artifact_path TEXT,
  error_message TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);
`;

function openDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);
  // busy_timeout must be set before anything else: it's what makes the
  // journal_mode switch itself (and everything after) wait out a lock held by
  // another process — e.g. Next's parallel build workers, each importing this
  // module and racing to initialize the same fresh file — instead of failing
  // immediately with "database is locked".
  database.exec("PRAGMA busy_timeout = 5000;");
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA);
  return database;
}

const globalForDb = globalThis as unknown as { __mcDb?: DatabaseSync };

export const db = globalForDb.__mcDb ?? openDatabase();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__mcDb = db;
}

/**
 * On process start, any build left RUNNING/QUEUED belongs to a previous
 * process that died mid-build (the in-process queue has no durable state).
 */
export function reapStuckBuilds(): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE builds SET status = 'FAILED', error_message = 'Interrupted by server restart', finished_at = ?
     WHERE status IN ('QUEUED', 'RUNNING')`,
  ).run(now);
}
reapStuckBuilds();

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return randomUUID();
}

// ---- Projects ----

export function createProject(input: {
  name: string;
  minecraftVersion: string;
  yarnMappingsVersion: string;
  fabricLoaderVersion: string;
}): Project {
  const id = newId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO projects (id, name, minecraft_version, yarn_mappings_version, fabric_loader_version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.name,
    input.minecraftVersion,
    input.yarnMappingsVersion,
    input.fabricLoaderVersion,
    timestamp,
    timestamp,
  );
  return getProject(id)!;
}

export function listProjects(): Project[] {
  return db
    .prepare(`SELECT * FROM projects ORDER BY created_at DESC`)
    .all()
    .map(mapProjectRow);
}

export function getProject(id: string): Project | null {
  const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
  return row ? mapProjectRow(row) : null;
}

export function deleteProject(id: string): void {
  db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjectRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    minecraftVersion: row.minecraft_version,
    yarnMappingsVersion: row.yarn_mappings_version,
    fabricLoaderVersion: row.fabric_loader_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Project files ----

export function listProjectFiles(projectId: string): ProjectFile[] {
  return db
    .prepare(`SELECT * FROM project_files WHERE project_id = ? ORDER BY path ASC`)
    .all(projectId)
    .map(mapProjectFileRow);
}

export function getProjectFile(id: string): ProjectFile | null {
  const row = db.prepare(`SELECT * FROM project_files WHERE id = ?`).get(id);
  return row ? mapProjectFileRow(row) : null;
}

export function getProjectFileByPath(projectId: string, filePath: string): ProjectFile | null {
  const row = db
    .prepare(`SELECT * FROM project_files WHERE project_id = ? AND path = ?`)
    .get(projectId, filePath);
  return row ? mapProjectFileRow(row) : null;
}

export function upsertProjectFile(input: {
  projectId: string;
  path: string;
  content: string;
  origin: FileOrigin;
}): ProjectFile {
  const existing = getProjectFileByPath(input.projectId, input.path);
  const timestamp = now();
  if (existing) {
    db.prepare(
      `UPDATE project_files SET content = ?, origin = ?, updated_at = ? WHERE id = ?`,
    ).run(input.content, input.origin, timestamp, existing.id);
    return getProjectFile(existing.id)!;
  }
  const id = newId();
  db.prepare(
    `INSERT INTO project_files (id, project_id, path, content, origin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.projectId, input.path, input.content, input.origin, timestamp, timestamp);
  return getProjectFile(id)!;
}

export function deleteProjectFile(id: string): void {
  db.prepare(`DELETE FROM project_files WHERE id = ?`).run(id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProjectFileRow(row: any): ProjectFile {
  return {
    id: row.id,
    projectId: row.project_id,
    path: row.path,
    content: row.content,
    origin: row.origin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- Decompiled source cache ----

export function getDecompiledSourceCache(
  minecraftVersion: string,
  yarnMappingsVersion: string,
): DecompiledSourceCache | null {
  const row = db
    .prepare(
      `SELECT * FROM decompiled_source_cache WHERE minecraft_version = ? AND yarn_mappings_version = ?`,
    )
    .get(minecraftVersion, yarnMappingsVersion);
  return row ? mapCacheRow(row) : null;
}

export function getOrCreateDecompiledSourceCache(
  minecraftVersion: string,
  yarnMappingsVersion: string,
): DecompiledSourceCache {
  const existing = getDecompiledSourceCache(minecraftVersion, yarnMappingsVersion);
  if (existing) return existing;
  const id = newId();
  const timestamp = now();
  db.prepare(
    `INSERT INTO decompiled_source_cache
       (id, minecraft_version, yarn_mappings_version, status, storage_path, error_message, created_at, updated_at)
     VALUES (?, ?, ?, 'PENDING', NULL, NULL, ?, ?)`,
  ).run(id, minecraftVersion, yarnMappingsVersion, timestamp, timestamp);
  return getDecompiledSourceCache(minecraftVersion, yarnMappingsVersion)!;
}

export function updateDecompiledSourceCache(
  id: string,
  fields: Partial<Pick<DecompiledSourceCache, "status" | "storagePath" | "errorMessage">>,
): void {
  const current = db.prepare(`SELECT * FROM decompiled_source_cache WHERE id = ?`).get(id);
  if (!current) return;
  const merged = { ...mapCacheRow(current), ...fields };
  db.prepare(
    `UPDATE decompiled_source_cache SET status = ?, storage_path = ?, error_message = ?, updated_at = ? WHERE id = ?`,
  ).run(merged.status, merged.storagePath, merged.errorMessage, now(), id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCacheRow(row: any): DecompiledSourceCache {
  return {
    id: row.id,
    minecraftVersion: row.minecraft_version,
    yarnMappingsVersion: row.yarn_mappings_version,
    status: row.status,
    storagePath: row.storage_path,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---- AI conversations & messages ----

export function getOrCreateConversation(projectId: string): AiConversation {
  const row = db
    .prepare(`SELECT * FROM ai_conversations WHERE project_id = ? ORDER BY created_at ASC LIMIT 1`)
    .get(projectId);
  if (row) return mapConversationRow(row);
  const id = newId();
  db.prepare(`INSERT INTO ai_conversations (id, project_id, created_at) VALUES (?, ?, ?)`).run(
    id,
    projectId,
    now(),
  );
  return mapConversationRow(
    db.prepare(`SELECT * FROM ai_conversations WHERE id = ?`).get(id),
  );
}

export function listMessages(conversationId: string): AiMessage[] {
  return db
    .prepare(`SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC`)
    .all(conversationId)
    .map(mapMessageRow);
}

export function addMessage(input: {
  conversationId: string;
  role: MessageRole;
  content: string;
  proposedEdits?: ProposedEdit[] | null;
}): AiMessage {
  const id = newId();
  db.prepare(
    `INSERT INTO ai_messages (id, conversation_id, role, content, proposed_edits, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    input.conversationId,
    input.role,
    input.content,
    input.proposedEdits ? JSON.stringify(input.proposedEdits) : null,
    now(),
  );
  return getMessage(id)!;
}

export function getMessage(id: string): AiMessage | null {
  const row = db.prepare(`SELECT * FROM ai_messages WHERE id = ?`).get(id);
  return row ? mapMessageRow(row) : null;
}

export function updateMessageProposedEdits(id: string, proposedEdits: ProposedEdit[]): void {
  db.prepare(`UPDATE ai_messages SET proposed_edits = ? WHERE id = ?`).run(
    JSON.stringify(proposedEdits),
    id,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapConversationRow(row: any): AiConversation {
  return { id: row.id, projectId: row.project_id, createdAt: row.created_at };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMessageRow(row: any): AiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    proposedEdits: row.proposed_edits ? JSON.parse(row.proposed_edits) : null,
    createdAt: row.created_at,
  };
}

// ---- Builds ----

export function createBuild(projectId: string): Build {
  const id = newId();
  db.prepare(
    `INSERT INTO builds (id, project_id, status, logs, created_at) VALUES (?, ?, 'QUEUED', '', ?)`,
  ).run(id, projectId, now());
  return getBuild(id)!;
}

export function getBuild(id: string): Build | null {
  const row = db.prepare(`SELECT * FROM builds WHERE id = ?`).get(id);
  return row ? mapBuildRow(row) : null;
}

export function listBuilds(projectId: string): Build[] {
  return db
    .prepare(`SELECT * FROM builds WHERE project_id = ? ORDER BY created_at DESC`)
    .all(projectId)
    .map(mapBuildRow);
}

export function updateBuildStatus(
  id: string,
  status: BuildStatus,
  fields: Partial<Pick<Build, "artifactPath" | "errorMessage" | "startedAt" | "finishedAt">> = {},
): void {
  const current = getBuild(id);
  if (!current) return;
  const merged = { ...current, status, ...fields };
  db.prepare(
    `UPDATE builds SET status = ?, artifact_path = ?, error_message = ?, started_at = ?, finished_at = ? WHERE id = ?`,
  ).run(
    merged.status,
    merged.artifactPath,
    merged.errorMessage,
    merged.startedAt,
    merged.finishedAt,
    id,
  );
}

export function appendBuildLog(id: string, line: string): void {
  db.prepare(`UPDATE builds SET logs = logs || ? WHERE id = ?`).run(line, id);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBuildRow(row: any): Build {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    logs: row.logs,
    artifactPath: row.artifact_path,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}
