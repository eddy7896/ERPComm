"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { Loader2, Hash, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MessageListProps {
  workspaceId: string;
  channelId?: string;
  recipientId?: string;
  typingUsers?: Array<{ id: string; full_name?: string; username?: string }>;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  is_edited?: boolean;
  sender_id: string;
  sender?: {
    id: string;
    avatar_url?: string;
    full_name?: string;
    username?: string;
    badge?: string;
  };
}

export function MessageList({ workspaceId, channelId, recipientId, typingUsers = [] }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user) return;
      setLoading(true);

      let query = supabase
        .from("messages")
        .select("*, sender:profiles(*)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (channelId) {
        query = query.eq("channel_id", channelId);
      } else if (recipientId) {
        query = query.or(`and(sender_id.eq.${user.id},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${user.id})`);
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

    const channel = supabase
      .channel(`room:${channelId || recipientId || 'global'}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: channelId ? `channel_id=eq.${channelId}` : undefined
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          
          // Filter for DMs if needed
          if (recipientId) {
            const isRelated = (msg.sender_id === user?.id && msg.recipient_id === recipientId) || 
                             (msg.sender_id === recipientId && msg.recipient_id === user?.id);
            if (!isRelated) return;
          }

          // If it's a channel message and we are in a different channel, the filter should handle it
          // but we check anyway if channelId is present
          if (channelId && msg.channel_id !== channelId) return;

          const { data: sender } = await supabase.from("profiles").select("*").eq("id", msg.sender_id).single();
          const newMessage = { ...msg, sender };
          setMessages(prev => {
            if (prev.find(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        } else if (payload.eventType === 'DELETE') {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, channelId, recipientId, user?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleEdit = async (messageId: string) => {
    if (!editContent.trim()) return;
    
    const { error } = await supabase
      .from("messages")
      .update({ content: editContent.trim(), is_edited: true, updated_at: new Date().toISOString() })
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to edit message");
    } else {
      setEditingId(null);
      setEditContent("");
    }
  };

  const handleDelete = async (messageId: string) => {
    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to delete message");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="flex-1 p-4">
      <div className="flex flex-col gap-4">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3 group hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
            <Avatar className="h-9 w-9 mt-0.5">
              <AvatarImage src={message.sender?.avatar_url} />
              <AvatarFallback>{message.sender?.full_name?.[0] || message.sender?.username?.[0]}</AvatarFallback>
            </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm hover:underline cursor-pointer">
                      {message.sender?.full_name || message.sender?.username}
                    </span>
                    {message.sender?.badge && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary uppercase tracking-wider">
                        {message.sender.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {format(new Date(message.created_at), "h:mm a")}
                  </span>
                {message.is_edited && (
                  <span className="text-[10px] text-zinc-400">(edited)</span>
                )}
              </div>
              
              {editingId === message.id ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEdit(message.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditContent("");
                      }
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(message.id)}>
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(null); setEditContent(""); }}>
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              )}
            </div>
            
            {currentUserId === message.sender_id && editingId !== message.id && (
              <div className="opacity-0 group-hover:opacity-100 md:opacity-0 transition-opacity lg:group-hover:opacity-100 flex items-start">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditingId(message.id); setEditContent(message.content); }}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(message.id)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
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
      
      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 mt-4 text-sm text-zinc-500">
          <div className="flex space-x-1">
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span>
            {typingUsers.map(u => u.full_name || u.username).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </span>
        </div>
      )}
    </ScrollArea>
  );
}
