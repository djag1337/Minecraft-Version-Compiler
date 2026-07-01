import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(os.tmpdir(), "mc-test-"));
process.env.DATA_DIR = dir;
process.env.DATABASE_PATH = path.join(dir, "test.db");
process.env.STORAGE_DIR = path.join(dir, "storage");
