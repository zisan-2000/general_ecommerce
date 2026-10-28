import type { TransportAttemptEvidence } from "./transport-types";

export type TransportQueueCounters = { accepted: number; persisted: number; duplicates: number; dropped: number;
  rejected: number; sanitizerErrors: number; writeErrors: number; drainErrors: number };
type Dependencies = {
  sanitize: (input: unknown) => TransportAttemptEvidence | null;
  write: (input: TransportAttemptEvidence) => Promise<"INSERTED" | "DUPLICATE">;
  schedule: (task: () => void) => unknown;
};
export const MAX_QUEUED = 128;
export class TransportEvidenceQueue {
  private queue: TransportAttemptEvidence[] = [];
  private running = false;
  private inFlight = false;
  private generation: symbol | null = null;
  private pending: Promise<void> = Promise.resolve();
  private counters: TransportQueueCounters = { accepted: 0, persisted: 0, duplicates: 0, dropped: 0,
    rejected: 0, sanitizerErrors: 0, writeErrors: 0, drainErrors: 0 };
  constructor(private readonly dependencies: Dependencies) {}
  private count(key: keyof TransportQueueCounters, amount = 1) {
    this.counters[key] = Math.min(Number.MAX_SAFE_INTEGER, this.counters[key] + Math.max(0, amount));
  }
  enqueue(inputs: readonly unknown[]) {
    try {
      if (!Array.isArray(inputs)) { this.count("rejected"); return; }
      this.count("dropped", Math.max(0, inputs.length - 8));
      for (const input of inputs.slice(0, 8)) {
        if (this.queue.length >= MAX_QUEUED) { this.count("dropped"); continue; }
        try {
          const safe = this.dependencies.sanitize(input);
          if (!safe) { this.count("rejected"); continue; }
          this.queue.push(safe);
          this.count("accepted");
        } catch { this.count("sanitizerErrors"); this.count("rejected"); }
      }
      this.start();
    } catch { this.count("drainErrors"); }
  }
  private start() {
    if (this.running || !this.queue.length) return;
    this.running = true;
    const generation = this.generation = Symbol();
    try {
      this.dependencies.schedule(() => {
        if (this.generation !== generation) return;
        // Catch even an unexpected rejection outside the ordinary write handler.
        this.pending = Promise.resolve().then(() => this.drain(generation))
          .catch(() => this.recover(generation, true));
      });
    } catch { this.recover(generation, true); }
  }
  private recover(generation: symbol, unexpected: boolean) {
    if (this.generation !== generation) return;
    if (unexpected) this.count("drainErrors");
    this.count("dropped", this.queue.length + (this.inFlight ? 1 : 0));
    this.queue.length = 0;
    this.inFlight = false;
    this.running = false;
    this.generation = null;
  }
  private async drain(generation: symbol) {
    try {
      while (this.generation === generation && this.queue.length) {
        const attempt = this.queue.shift()!;
        this.inFlight = true;
        const outcome = await this.dependencies.write(attempt);
        if (this.generation !== generation) return;
        if (outcome !== "INSERTED" && outcome !== "DUPLICATE") throw new Error("INVALID_TRANSPORT_WRITE_RESULT");
        this.count(outcome === "DUPLICATE" ? "duplicates" : "persisted");
        this.inFlight = false;
      }
    } catch {
      this.count("writeErrors");
      // Drop this batch. No retries; a future enqueue can schedule a new batch.
      this.recover(generation, false);
    } finally {
      if (this.generation === generation) { this.running = false; this.inFlight = false; }
    }
  }
  snapshot() {
    return { ...this.counters, queueDepth: this.queue.length, inFlight: this.inFlight,
      scope: "CURRENT_PROCESS_ONLY" as const, completeness: "BEST_EFFORT_NOT_GUARANTEED" as const };
  }
  // Deterministic offline scheduling tests can await the currently running batch.
  waitForIdle() { return this.pending; }
}
