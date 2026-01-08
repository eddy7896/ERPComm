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
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { decryptMessage, unwrapChannelKey, getPrivateKey } from "@/lib/crypto";
import { getProfile } from "@/lib/cache";
import { Loader2, Hash, MoreHorizontal, Pencil, Trash2, Check, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const getBadgeColor = (badge: string) => {
  switch (badge) {
    case "Founder": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "Admin": return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
    case "Product": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "Engineering": return "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20";
    case "Design": return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20";
    case "Marketing": return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
    case "Intern": return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    default: return "bg-primary/10 text-primary border-primary/20";
  }
};
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
  is_encrypted?: boolean;
  payload?: Record<string, any> | null;
  sender?: {
    id: string;
    avatar_url?: string;
    full_name?: string;
    username?: string;
    badge?: string;
  };
  decryptedContent?: string;
}

const keyCache: Record<string, CryptoKey> = {};

export function MessageList({ workspaceId, channelId, recipientId, typingUsers = [] }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
  
    useEffect(() => {
      const updateLastRead = async () => {
        if (!user || !workspaceId) return;
        const { error } = await supabase.from("member_last_read").upsert({
          user_id: user.id,
          workspace_id: workspaceId,
          channel_id: channelId || null,
          recipient_id: recipientId || null,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: channelId ? 'user_id,workspace_id,channel_id' : 'user_id,workspace_id,recipient_id'
        });
      };
  
      if (messages.length > 0) {
        updateLastRead();
      }
    }, [messages, user, workspaceId, channelId, recipientId]);

    useEffect(() => {
      const fetchMessages = async () => {
        if (!user) return;
        setLoading(true);

        let query = supabase
          .from("messages")
          .select("*, sender:profiles!sender_id(*)")
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
            
            if (recipientId) {
              const isRelated = (msg.sender_id === user?.id && msg.recipient_id === recipientId) || 
                               (msg.sender_id === recipientId && msg.recipient_id === user?.id);
              if (!isRelated) return;
            }

            if (channelId && msg.channel_id !== channelId) return;

            // Use the cache for the sender profile
            const sender = await getProfile(msg.sender_id);
            const newMessage = { ...msg, sender };

            setMessages(prev => {
              // Replace optimistic message if it exists, or append if not
              const existingIndex = prev.findIndex(m => m.id === msg.id || (m.id.startsWith('opt-') && m.content === msg.content && m.sender_id === msg.sender_id));
              if (existingIndex !== -1) {
                const newMessages = [...prev];
                newMessages[existingIndex] = newMessage;
                return newMessages;
              }
              return [...prev, newMessage];
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(m => m.id !== payload.old.id));
          }
        })
        .on('broadcast', { event: 'optimistic_message' }, async ({ payload }) => {
          // Listen for optimistic messages sent by the current user in other tabs or for immediate local feedback
          if (payload.sender_id === user?.id) return; // We handle local optimistic update in MessageInput

          const sender = await getProfile(payload.sender_id);
          const optMessage = { ...payload, sender, id: `opt-${Date.now()}` };

          setMessages(prev => {
            if (prev.find(m => m.content === payload.content && m.sender_id === payload.sender_id)) return prev;
            return [...prev, optMessage];
          });
        })
        .subscribe();

      // Listen for local optimistic messages from MessageInput
      const handleLocalOptimistic = async (e: any) => {
        const { message } = e.detail;
        const sender = await getProfile(message.sender_id);
        setMessages(prev => [...prev, { ...message, sender }]);
      };

      window.addEventListener('optimistic_message', handleLocalOptimistic);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('optimistic_message', handleLocalOptimistic);
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
                        <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 uppercase tracking-wider font-bold h-4 border", getBadgeColor(message.sender.badge))}>
                          {message.sender.badge}
                        </Badge>
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
                    <div className="flex flex-col items-start gap-2 group/msg">
                      {message.payload?.type === "gif" || message.payload?.type === "sticker" ? (
                        <div className="relative mt-1 max-w-[300px] rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                          <img 
                            src={message.is_encrypted ? message.decryptedContent : message.content} 
                            alt="GIF" 
                            className="w-full h-auto object-contain"
                          />
                        </div>
                      ) : (
                        <p className={cn(
                          "text-sm leading-relaxed whitespace-pre-wrap break-words",
                          message.is_encrypted && !message.decryptedContent 
                            ? "text-zinc-400 italic font-mono bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1 rounded border border-dashed border-zinc-200 dark:border-zinc-700" 
                            : "text-zinc-800 dark:text-zinc-200"
                        )}>
                          {message.is_encrypted 
                            ? (message.decryptedContent || `[Encrypted: ${message.content.substring(0, 16)}...]`) 
                            : message.content}
                        </p>
                      )}
                      {message.is_encrypted && (
                        <div className="mt-1 flex items-center gap-1 opacity-40 group-hover/msg:opacity-100 transition-opacity" title="End-to-End Encrypted">
                          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      )}
                    </div>
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
