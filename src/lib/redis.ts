import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const globalForRedis = global as unknown as { redis: Redis | undefined };

export const redis = globalForRedis.redis ?? (redisUrl ? new Redis(redisUrl, {
  maxRetriesPerRequest: 0,
  enableReadyCheck: false,
  showFriendlyErrorStack: true,
  lazyConnect: true,
  retryStrategy: (times) => {
    if (times > 1) return null; // stop retrying after 1 attempt
    return 10;
  }
}) : null);

if (process.env.NODE_ENV !== 'production' && redis) globalForRedis.redis = redis;

export default redis;
