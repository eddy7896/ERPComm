"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

type PresenceState = "online" | "idle" | "offline";

interface UserPresence {
  id: string;
  status: PresenceState;
  lastSeen: string;
}

export function usePresence(workspaceId: string) {
  const [presenceMap, setPresenceMap] = useState<Map<string, UserPresence>>(new Map());
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    let presenceChannel: RealtimeChannel | null = null;
    let idleTimeout: NodeJS.Timeout;
    const activityListeners: (() => void)[] = [];

    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      presenceChannel = supabase.channel(`presence:${workspaceId}`, {
        config: { presence: { key: user.id } },
      });

      presenceChannel
        .on("presence", { event: "sync" }, () => {
          const state = presenceChannel?.presenceState() || {};
          const newMap = new Map<string, UserPresence>();
          
          Object.entries(state).forEach(([key, presences]) => {
            if (Array.isArray(presences) && presences.length > 0) {
              const presence = presences[0] as { status?: PresenceState; lastSeen?: string };
              newMap.set(key, {
                id: key,
                status: presence.status || "online",
                lastSeen: presence.lastSeen || new Date().toISOString(),
              });
            }
          });
          
          setPresenceMap(newMap);
        })
        .on("presence", { event: "join" }, ({ key, newPresences }) => {
          setPresenceMap((prev) => {
            const newMap = new Map(prev);
            if (newPresences && newPresences.length > 0) {
              newMap.set(key, {
                id: key,
                status: (newPresences[0] as { status?: PresenceState }).status || "online",
                lastSeen: new Date().toISOString(),
              });
            }
            return newMap;
          });
        })
        .on("presence", { event: "leave" }, ({ key }) => {
          setPresenceMap((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(key);
            if (existing) {
              newMap.set(key, { ...existing, status: "offline", lastSeen: new Date().toISOString() });
            }
            return newMap;
          });
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceChannel?.track({
              status: "online",
              lastSeen: new Date().toISOString(),
            });
          }
        });

      setChannel(presenceChannel);

      const setIdle = () => {
        presenceChannel?.track({
          status: "idle",
          lastSeen: new Date().toISOString(),
        });
      };

      const setOnline = () => {
        clearTimeout(idleTimeout);
        presenceChannel?.track({
          status: "online",
          lastSeen: new Date().toISOString(),
        });
        idleTimeout = setTimeout(setIdle, 5 * 60 * 1000);
      };

      const events = ["mousedown", "keydown", "scroll", "touchstart"];
      events.forEach((event) => {
        const handler = () => setOnline();
        window.addEventListener(event, handler);
        activityListeners.push(() => window.removeEventListener(event, handler));
      });

      idleTimeout = setTimeout(setIdle, 5 * 60 * 1000);
    };

    setupPresence();

    return () => {
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
      activityListeners.forEach((cleanup) => cleanup());
      clearTimeout(idleTimeout);
    };
  }, [workspaceId]);

  const updateStatus = useCallback(async (status: PresenceState) => {
    if (channel) {
      await channel.track({
        status,
        lastSeen: new Date().toISOString(),
      });
    }
  }, [channel]);

  const getPresence = useCallback((userId: string): UserPresence | undefined => {
    return presenceMap.get(userId);
  }, [presenceMap]);

  const isOnline = useCallback((userId: string): boolean => {
    const presence = presenceMap.get(userId);
    return presence?.status === "online";
  }, [presenceMap]);

  return {
    presenceMap,
    updateStatus,
    getPresence,
    isOnline,
  };
}
