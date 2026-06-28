const { redisClient, isRedisConnected } = require('../utils/redis');

/**
 * Distributed-safe sliding window rate limiter using Redis.
 * Falls back open gracefully if Redis is unavailable.
 */
const slidingWindowRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // Max requests
    message = 'Too many requests. Please try again later.',
    keyPrefix = 'ratelimit'
  } = options;

  return async (req, res, next) => {
    if (!isRedisConnected() || !redisClient) {
      return next();
    }

    try {
      const identifier = req.ip || req.connection?.remoteAddress || 'unknown';
      const key = `${keyPrefix}:${identifier}`;
      const now = Date.now();
      const clearBefore = now - windowMs;

      // Unique member to prevent collisions in sorted set
      const member = `${now}-${Math.random().toString(36).slice(2, 7)}`;

      const multi = redisClient.multi();
      multi.zRemRangeByScore(key, 0, clearBefore);
      multi.zCard(key);
      multi.zAdd(key, { score: now, value: member });
      multi.expire(key, Math.ceil(windowMs / 1000) * 2);

      const results = await multi.exec();
      const currentRequestCount = results[1]; // Result of zCard

      if (currentRequestCount > max) {
        res.set('X-RateLimit-Limit', max);
        res.set('X-RateLimit-Remaining', 0);
        res.set('Retry-After', Math.ceil(windowMs / 1000));
        return res.status(429).json({ message });
      }

      res.set('X-RateLimit-Limit', max);
      res.set('X-RateLimit-Remaining', Math.max(0, max - currentRequestCount));

      next();
    } catch (err) {
      console.error('[RateLimiter] Redis rate limiting error:', err.message);
      next(); // Fail open
    }
  };
};

module.exports = { slidingWindowRateLimiter };
