"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Send, Smile, Paperclip, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  workspaceId: string;
  channelId?: string;
  recipientId?: string;
  channelName?: string;
  recipientName?: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
}

export function MessageInput({ 
  workspaceId, 
  channelId, 
  recipientId, 
  channelName,
  recipientName,
  onTyping,
  onStopTyping 
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    onStopTyping?.();

    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("messages").insert({
      workspace_id: workspaceId,
      channel_id: channelId,
      recipient_id: recipientId,
      sender_id: user?.id,
      content: content.trim(),
    });

    if (error) {
      console.error("Error sending message:", error);
    } else {
      setContent("");
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (e.target.value.trim()) {
      onTyping?.();
    } else {
      onStopTyping?.();
    }
  };

  const placeholder = channelId 
    ? `Message #${channelName || 'channel'}` 
    : `Message ${recipientName || 'user'}`;

  return (
    <div className="px-4 pb-4">
      <div className="relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-primary/20 transition-shadow">
        <Textarea
          placeholder={placeholder}
          className="min-h-[44px] h-auto max-h-[200px] resize-none border-none bg-transparent shadow-none focus-visible:ring-0 px-4 pt-3 pb-2 text-sm"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => onStopTyping?.()}
        />
        
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Plus className="h-4 w-4" />
            </Button>
            <div className="h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Smile className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              className={`h-8 w-8 transition-all ${content.trim() ? 'bg-primary text-primary-foreground opacity-100 scale-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 scale-95 pointer-events-none'}`}
              onClick={handleSendMessage}
              disabled={!content.trim() || loading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-400 mt-2 ml-1">
        <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line
      </p>
    </div>
  );
}
