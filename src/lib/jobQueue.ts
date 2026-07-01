type Job = () => Promise<void>;

/**
 * Minimal in-process FIFO worker: builds/decompiles run one at a time.
 * State is not durable — a process restart loses queued jobs, which is why
 * db.ts's reapStuckBuilds() marks any RUNNING/QUEUED build FAILED on boot.
 * Swap for BullMQ+Redis if this needs to survive restarts or scale out.
 */
class JobQueue {
  private pending: Job[] = [];
  private draining = false;

  enqueue(job: Job): void {
    this.pending.push(job);
    void this.drain();
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift();
        if (!job) continue;
        try {
          await job();
        } catch (err) {
          console.error("[jobQueue] job threw:", err);
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

const globalForQueue = globalThis as unknown as { __mcJobQueue?: JobQueue };

export const jobQueue = globalForQueue.__mcJobQueue ?? new JobQueue();
if (process.env.NODE_ENV !== "production") {
  globalForQueue.__mcJobQueue = jobQueue;
}
