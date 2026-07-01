type Listener = (event: { type: "log"; line: string } | { type: "done" }) => void;

/** In-memory pub/sub so SSE routes can stream build/decompile logs as they're produced. */
export class LogBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(jobId: string, listener: Listener): () => void {
    let set = this.listeners.get(jobId);
    if (!set) {
      set = new Set();
      this.listeners.set(jobId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) this.listeners.delete(jobId);
    };
  }

  publishLog(jobId: string, line: string): void {
    for (const listener of this.listeners.get(jobId) ?? []) {
      listener({ type: "log", line });
    }
  }

  publishDone(jobId: string): void {
    for (const listener of this.listeners.get(jobId) ?? []) {
      listener({ type: "done" });
    }
  }
}

const globalForLogBus = globalThis as unknown as {
  __mcBuildLogBus?: LogBus;
  __mcDecompileLogBus?: LogBus;
};

export const buildLogBus = globalForLogBus.__mcBuildLogBus ?? new LogBus();
export const decompileLogBus = globalForLogBus.__mcDecompileLogBus ?? new LogBus();
if (process.env.NODE_ENV !== "production") {
  globalForLogBus.__mcBuildLogBus = buildLogBus;
  globalForLogBus.__mcDecompileLogBus = decompileLogBus;
}
