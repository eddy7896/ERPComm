"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/profile-cache";

interface TypingUser {
  id: string;
  username?: string;
  full_name?: string;
}

export function useTypingIndicator(
  workspaceId: string,
  channelId?: string,
  recipientId?: string
) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const roomId = channelId || recipientId || "general";

  useEffect(() => {
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const typingChannel = supabase.channel(`typing:${workspaceId}:${roomId}`);
      
        typingChannel
          .on("broadcast", { event: "typing" }, async ({ payload }) => {
            if (payload.userId === user.id) return;
            
            const profile = await getProfile(payload.userId);

            if (profile) {
              setTypingUsers((prev) => {
                const exists = prev.some((u) => u.id === profile.id);
                if (!exists) {
                  return [...prev, profile];
                }
                return prev;
              });

              setTimeout(() => {
                setTypingUsers((prev) => prev.filter((u) => u.id !== payload.userId));
              }, 3000);
            }
          })

        .on("broadcast", { event: "stop_typing" }, ({ payload }) => {
          setTypingUsers((prev) => prev.filter((u) => u.id !== payload.userId));
        })
        .subscribe();

      channelRef.current = typingChannel;
    };

    setup();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [workspaceId, roomId]);

  const startTyping = useCallback(() => {
    if (!channelRef.current || !currentUserId || isTypingRef.current) return;
    
    isTypingRef.current = true;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUserId },
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (channelRef.current && currentUserId) {
        isTypingRef.current = false;
        channelRef.current.send({
          type: "broadcast",
          event: "stop_typing",
          payload: { userId: currentUserId },
        });
      }
    }, 3000);
  }, [currentUserId]);

  const stopTyping = useCallback(() => {
    if (!channelRef.current || !currentUserId) return;
    
    isTypingRef.current = false;
    channelRef.current.send({
      type: "broadcast",
      event: "stop_typing",
      payload: { userId: currentUserId },
    });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [currentUserId]);

  const handleTyping = useCallback(() => {
    startTyping();
  }, [startTyping]);

  return {
    typingUsers,
    handleTyping,
    stopTyping,
  };
}
