/**
 * Lightweight in-process job queue with concurrency control.
 *
 * For production at scale, swap with BullMQ + Redis.
 * This keeps things simple and zero-dependency for now.
 */

class JobQueue {
  /**
   * @param {number} concurrency - Max parallel workers.
   */
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  /**
   * Add a job (async function) to the queue.
   * Returns immediately — does not block.
   */
  enqueue(fn) {
    this.queue.push(fn);
    this._drain();
  }

  /** @private */
  async _drain() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      this.running++;
      job()
        .catch((err) => console.error('[JobQueue] unhandled:', err.message))
        .finally(() => {
          this.running--;
          this._drain();
        });
    }
  }

  /** Number of pending + running jobs. */
  get size() {
    return this.queue.length + this.running;
  }
}

/** Global invite-video queue (1 concurrent to limit memory on free-tier hosts). */
const inviteQueue = new JobQueue(Number(process.env.INVITE_CONCURRENCY) || 1);

module.exports = { JobQueue, inviteQueue };
