import { supabase } from "./supabase";
import { redis } from "./redis";

interface Profile {
  id: string;
  avatar_url?: string;
  full_name?: string;
  username?: string;
  badge?: string;
}

const profileCache: Record<string, Profile> = {};
const pendingRequests: Record<string, Promise<Profile | null>> = {};

/**
 * Client-side profile cache to avoid redundant fetches during real-time updates.
 */
export async function getProfile(userId: string): Promise<Profile | null> {
  if (profileCache[userId]) {
    return profileCache[userId];
  }

  if (pendingRequests[userId]) {
    return pendingRequests[userId];
  }

  pendingRequests[userId] = supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single()
    .then(({ data }) => {
      if (data) {
        profileCache[userId] = data;
      }
      delete pendingRequests[userId];
      return data;
    });

  return pendingRequests[userId];
}

/**
 * Server-side caching helper using Redis.
 */
export async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.error("Redis error:", err);
  }

  const data = await fetcher();
  
  try {
    await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
  } catch (err) {
    console.error("Redis set error:", err);
  }

  return data;
}

export function clearProfileCache() {
  Object.keys(profileCache).forEach(key => delete profileCache[key]);
}
