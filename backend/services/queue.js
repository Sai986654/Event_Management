const { Queue } = require('bullmq');
const Redis = require('ioredis');

let connection = null;
let queue = null;

if (process.env.REDIS_URL) {
  try {
    connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      connectTimeout: 5000,
    });
    
    connection.on('error', (err) => {
      console.error('[Queue Redis] Connection error:', err.message);
    });

    queue = new Queue('marketplaceJobs', { connection });
    console.log('[Queue] BullMQ marketplaceJobs queue initialized');
  } catch (err) {
    console.error('[Queue] BullMQ initialization error:', err.message);
    queue = null;
  }
} else {
  console.log('[Queue] REDIS_URL not configured. Background jobs will run synchronously.');
}

/**
 * Enqueue a background job, falling back to synchronous execution if Redis is unavailable.
 */
const addJob = async (name, data, opts = {}) => {
  if (!queue) {
    console.warn(`[Queue] Queue not active. Executing job synchronously: ${name}`);
    try {
      const { processJobInline } = require('./worker');
      await processJobInline(name, data);
    } catch (err) {
      console.error(`[Queue] Synchronous job execution failed for ${name}:`, err.message);
    }
    return null;
  }

  try {
    const job = await queue.add(name, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      ...opts,
    });
    console.log(`[Queue] Enqueued job: ${name} (Job ID: ${job.id})`);
    return job;
  } catch (err) {
    console.error(`[Queue] Failed to add job to queue, running inline:`, err.message);
    try {
      const { processJobInline } = require('./worker');
      await processJobInline(name, data);
    } catch (inlineErr) {
      console.error(`[Queue] Synchronous fallback execution failed for ${name}:`, inlineErr.message);
    }
    return null;
  }
};

module.exports = {
  queue,
  addJob,
};
