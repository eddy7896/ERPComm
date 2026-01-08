"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  workspaceId: string;
  channelId?: string;
  recipientId?: string;
}

export function MessageList({ workspaceId, channelId, recipientId }: MessageListProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      setLoading(true);
      let query = supabase
        .from("messages")
        .select("*, sender:profiles(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (channelId) {
        query = query.eq("channel_id", channelId);
      } else if (recipientId) {
        // Simple DM logic: messages between user and recipient
        const { data: { user } } = await supabase.auth.getUser();
        query = query.or(`and(sender_id.eq.${user?.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user?.id})`);
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching messages:", error);
      } else {
        setMessages(data || []);
      }
      setLoading(false);
    };

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`room:${channelId || recipientId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : undefined
      }, async (payload) => {
        // If DM, we need to check if the message belongs to this conversation
        if (recipientId) {
          const { data: { user } } = await supabase.auth.getUser();
          const msg = payload.new;
          const isRelated = (msg.sender_id === user?.id && msg.recipient_id === recipientId) || 
                           (msg.sender_id === recipientId && msg.recipient_id === user?.id);
          if (!isRelated) return;
        }

        // Fetch the sender profile for the new message
        const { data: sender } = await supabase.from("profiles").select("*").eq("id", payload.new.sender_id).single();
        const newMessage = { ...payload.new, sender };
        setMessages(prev => [...prev, newMessage]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, channelId, recipientId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 p-4">
      <div className="flex flex-col gap-6">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3 group">
            <Avatar className="h-9 w-9 mt-0.5">
              <AvatarImage src={message.sender?.avatar_url} />
              <AvatarFallback>{message.sender?.full_name?.[0] || message.sender?.username?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm hover:underline cursor-pointer">
                  {message.sender?.full_name || message.sender?.username}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">
                  {format(new Date(message.created_at), "h:mm a")}
                </span>
              </div>
              <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
              <Hash className="h-8 w-8 text-zinc-400" />
            </div>
            <h3 className="text-lg font-bold">Welcome to the beginning of this conversation!</h3>
            <p className="text-sm text-zinc-500">This is the very start of the history.</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

import { Hash } from "lucide-react";
