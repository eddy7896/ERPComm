import { redis } from "./redis";

/**
 * Server-side caching helper using Redis.
 * This should only be used in API routes or Server Components.
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      console.error("Redis error:", err);
    }
  }

  const data = await fetcher();
  
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (err) {
      console.error("Redis set error:", err);
    }
  }

  return data;
}
