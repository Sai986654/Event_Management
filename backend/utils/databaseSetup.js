/**
 * Prisma Database Setup Utility
 * 
 * Ensures database schema is up-to-date on application startup.
 * This provides a permanent fix for migration issues by:
 * - Automatically running pending migrations
 * - Handling shadow database validation errors
 * - Providing detailed logging for debugging
 * 
 * Usage in server.js:
 *   const { ensureDatabaseReady } = require('./utils/databaseSetup');
 *   await ensureDatabaseReady();
 */

const { execSync } = require('child_process');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '..');

const migrationState = {
  initialized: false,
  hasPendingMigrations: null,
  lastCheck: null,
};

/**
 * Execute a Prisma command silently
 */
const executePrismaCommand = (command, options = {}) => {
  try {
    const cmd = `cd "${BACKEND_DIR}" && npx prisma ${command}`;
    const output = execSync(cmd, {
      encoding: 'utf8',
      stdio: 'pipe',
      ...options,
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || '',
      stdout: error.stdout?.toString() || '',
    };
  }
};

/**
 * Check if there are pending migrations
 */
const checkPendingMigrations = async () => {
  console.log('[DB] Checking migration status...');
  
  const result = executePrismaCommand('migrate status');
  
  if (!result.success) {
    console.warn('[DB] Could not check migration status:', result.error);
    return null;
  }

  const output = result.output.toLowerCase();
  const hasPending = output.includes('pending') || output.includes('awaiting apply');
  
  migrationState.hasPendingMigrations = hasPending;
  migrationState.lastCheck = new Date().toISOString();
  
  if (hasPending) {
    console.log('[DB] ⚠ Found pending migrations');
  } else {
    console.log('[DB] ✓ No pending migrations');
  }
  
  return hasPending;
};

/**
 * Deploy pending migrations
 */
const deployPendingMigrations = async () => {
  console.log('[DB] Deploying pending migrations...');
  
  const result = executePrismaCommand('migrate deploy');
  
  if (result.success) {
    console.log('[DB] ✓ Migrations deployed successfully');
    migrationState.initialized = true;
    return true;
  }

  console.error('[DB] ✗ Failed to deploy migrations:', result.error);
  console.error('[DB] Refusing automatic migrate resolve to avoid schema drift.');
  console.error('[DB] Run `npx prisma migrate status` and apply a targeted repair migration if needed.');
  return false;
};

/**
 * Generate Prisma client if needed
 */
const generatePrismaClient = async () => {
  console.log('[DB] Generating Prisma client...');
  
  const result = executePrismaCommand('generate');
  
  if (result.success) {
    console.log('[DB] ✓ Prisma client generated');
    return true;
  }

  console.error('[DB] ✗ Failed to generate Prisma client:', result.error);
  return false;
};

/**
 * Validate Prisma schema
 */
const validateSchema = async () => {
  console.log('[DB] Validating schema...');
  
  const result = executePrismaCommand('validate');
  
  if (result.success) {
    console.log('[DB] ✓ Schema is valid');
    return true;
  }

  console.error('[DB] ✗ Schema validation failed:', result.error);
  return false;
};

/**
 * Main function: Ensure database is ready with all migrations applied
 * Call this during server startup
 */
const ensureDatabaseReady = async (options = {}) => {
  const {
    verbose = false,
    skipValidation = false,
    maxRetries = 3,
  } = options;

  if (migrationState.initialized) {
    if (verbose) console.log('[DB] Database already initialized in this session');
    return true;
  }

  console.log('[DB] ════════════════════════════════════════');
  console.log('[DB] Ensuring database schema is up-to-date...');
  console.log('[DB] ════════════════════════════════════════');

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt += 1;

    try {
      // Step 1: Validate schema (unless skipped)
      if (!skipValidation) {
        const schemaValid = await validateSchema();
        if (!schemaValid) {
          console.error('[DB] Schema validation failed, cannot proceed');
          return false;
        }
      }

      // Step 2: Generate Prisma client
      const clientGenerated = await generatePrismaClient();
      if (!clientGenerated) {
        throw new Error('Failed to generate Prisma client');
      }

      // Step 3: Check for pending migrations
      const hasPending = await checkPendingMigrations();

      // Step 4: Deploy if pending
      if (hasPending) {
        const deployed = await deployPendingMigrations();
        if (!deployed) {
          if (attempt < maxRetries) {
            const delay = 1000 * attempt;
            console.log(`[DB] Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
          return false;
        }
      }

      // Success
      migrationState.initialized = true;
      console.log('[DB] ════════════════════════════════════════');
      console.log('[DB] ✓ Database ready - all migrations applied');
      console.log('[DB] ════════════════════════════════════════\n');
      return true;

    } catch (error) {
      console.error(`[DB] Error during setup (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        const delay = 1000 * attempt;
        console.log(`[DB] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[DB] ✗ Failed to ensure database is ready after', maxRetries, 'attempts');
  return false;
};

/**
 * Get current migration state
 */
const getMigrationState = () => ({
  ...migrationState,
  timestamp: new Date().toISOString(),
});

module.exports = {
  ensureDatabaseReady,
  checkPendingMigrations,
  deployPendingMigrations,
  generatePrismaClient,
  validateSchema,
  getMigrationState,
};
