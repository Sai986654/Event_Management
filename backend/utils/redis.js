const { createClient } = require('redis');

let redisClient = null;
let isRedisConnected = false;

if (process.env.REDIS_URL) {
  redisClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.warn('[Redis] Reconnect attempts exceeded. Disabling Redis.');
          isRedisConnected = false;
          return false; // Stop reconnecting
        }
        return Math.min(retries * 500, 2000);
      }
    }
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] Client error:', err.message);
    isRedisConnected = false;
  });

  redisClient.on('connect', () => {
    console.log('[Redis] Connection established');
    isRedisConnected = true;
  });

  redisClient.connect().catch((err) => {
    console.warn('[Redis] Initial connection failed. Fallback to DB enabled.', err.message);
    isRedisConnected = false;
  });
} else {
  console.log('[Redis] REDIS_URL not configured. Running without Redis.');
}

const getCache = async (key) => {
  if (!isRedisConnected || !redisClient) return null;
  try {
    const val = await redisClient.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    console.error('[Redis] getCache error:', err.message);
    return null;
  }
};

const setCache = async (key, val, ttlSeconds) => {
  if (!isRedisConnected || !redisClient) return false;
  try {
    const stringVal = JSON.stringify(val);
    if (ttlSeconds) {
      await redisClient.setEx(key, ttlSeconds, stringVal);
    } else {
      await redisClient.set(key, stringVal);
    }
    return true;
  } catch (err) {
    console.error('[Redis] setCache error:', err.message);
    return false;
  }
};

const delCache = async (key) => {
  if (!isRedisConnected || !redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    console.error('[Redis] delCache error:', err.message);
    return false;
  }
};

const delCachePrefix = async (prefix) => {
  if (!isRedisConnected || !redisClient) return false;
  try {
    const keys = await redisClient.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
    return true;
  } catch (err) {
    console.error('[Redis] delCachePrefix error:', err.message);
    return false;
  }
};

const invalidateVendorCache = async (vendorId, categoryName) => {
  try {
    const promises = [
      delCache(`vendor:${vendorId}`),
      delCache('vendors:featured'),
      delCache('homepage:v1'),
    ];
    if (categoryName) {
      promises.push(delCache(`vendors:category:${String(categoryName).toLowerCase().trim()}`));
    }
    await Promise.all(promises);
    console.log(`[Redis] Cache invalidated for vendor ${vendorId}`);
  } catch (err) {
    console.error('[Redis] Cache invalidation error:', err.message);
  }
};

module.exports = {
  redisClient,
  isRedisConnected: () => isRedisConnected,
  getCache,
  setCache,
  delCache,
  delCachePrefix,
  invalidateVendorCache,
};
