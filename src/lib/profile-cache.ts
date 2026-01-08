import { supabase } from "./supabase";

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

export function clearProfileCache() {
  Object.keys(profileCache).forEach(key => delete profileCache[key]);
}
