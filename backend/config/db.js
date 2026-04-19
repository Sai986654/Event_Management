const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

const databaseState = {
  ready: false,
  connecting: false,
  attempts: 0,
  connectedAt: null,
  lastError: null,
};

const connectDB = async () => {
  if (databaseState.ready || databaseState.connecting) {
    return databaseState.ready;
  }

  databaseState.connecting = true;
  databaseState.attempts += 1;

  try {
    await prisma.$connect();
    databaseState.ready = true;
    databaseState.connectedAt = new Date().toISOString();
    databaseState.lastError = null;
    console.log('PostgreSQL connected via Prisma');
    return true;
  } catch (error) {
    databaseState.ready = false;
    databaseState.lastError = error.message;
    console.error('Database connection error:', error.message);
    return false;
  } finally {
    databaseState.connecting = false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectDBWithRetry = async () => {
  let attempt = 0;

  while (!databaseState.ready) {
    attempt += 1;
    const connected = await connectDB();
    if (connected) return true;

    const delayMs = Math.min(15000, 2000 * attempt);
    console.warn(`[DB] Retry ${attempt} in ${delayMs}ms`);
    await sleep(delayMs);
  }

  return true;
};

const getDatabaseState = () => ({ ...databaseState });

module.exports = { prisma, connectDB, connectDBWithRetry, getDatabaseState };
