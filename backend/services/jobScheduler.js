/**
 * Background Jobs Scheduler
 * 
 * Initializes all background jobs for the application
 * Includes vendor form sync, notification cleanup, etc.
 */

const { syncVendorsFromGoogleForm } = require('./services/vendorFormSyncService');

class JobScheduler {
  constructor() {
    this.jobs = [];
  }

  /**
   * Add a job to run at specified interval (milliseconds)
   * For production, consider using node-cron or bull
   */
  addIntervalJob(name, fn, intervalMs, runOnStart = false) {
    if (runOnStart) {
      setImmediate(() => this._runJob(name, fn));
    }

    const intervalId = setInterval(() => {
      this._runJob(name, fn);
    }, intervalMs);

    this.jobs.push({ name, intervalId });
    console.log(`[JobScheduler] ✓ Scheduled: ${name} (every ${this._formatTime(intervalMs)})`);
  }

  async _runJob(name, fn) {
    try {
      console.log(`[JobScheduler] Starting: ${name}`);
      const startTime = Date.now();
      const result = await fn();
      const duration = Date.now() - startTime;
      console.log(
        `[JobScheduler] ✓ Completed: ${name} (${duration}ms)`,
        result
      );
    } catch (error) {
      console.error(`[JobScheduler] ✗ Failed: ${name}`, error.message);
    }
  }

  _formatTime(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`;
    return `${(ms / 60000).toFixed(1)}min`;
  }

  stopAll() {
    this.jobs.forEach((job) => clearInterval(job.intervalId));
    console.log(`[JobScheduler] Stopped ${this.jobs.length} jobs`);
  }
}

/**
 * Initialize all background jobs
 * Call this in server.js after DB is ready
 */
function initializeJobs() {
  const scheduler = new JobScheduler();

  // Sync vendors from Google Forms every 5 minutes (if configured)
  if (process.env.GOOGLE_FORM_SHEET_ID && process.env.GOOGLE_SHEETS_CREDENTIALS) {
    const syncIntervalMs = parseInt(process.env.VENDOR_FORM_SYNC_INTERVAL || '300000', 10); // Default: 5 minutes
    scheduler.addIntervalJob(
      'Vendor Form Sync from Google Sheets',
      async () => {
        try {
          const results = await syncVendorsFromGoogleForm({ limit: 25 });
          return {
            created: results.created,
            processed: results.processed,
            errors: results.failed,
          };
        } catch (error) {
          console.error('[VendorFormSync] Job error:', error.message);
          return { error: error.message };
        }
      },
      syncIntervalMs,
      false // Don't run on startup
    );
  }

  // Add more jobs here as needed:
  // scheduler.addIntervalJob('Job Name', asyncFunction, intervalMs);

  return scheduler;
}

module.exports = {
  JobScheduler,
  initializeJobs,
};
