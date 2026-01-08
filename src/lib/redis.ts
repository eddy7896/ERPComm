import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis = globalForRedis.redis ?? new Redis(redisUrl, {
  maxRetriesPerRequest: 0,
  enableReadyCheck: false,
  showFriendlyErrorStack: true
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;
