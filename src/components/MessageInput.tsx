"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { encryptMessage, unwrapChannelKey, getPrivateKey } from "@/lib/crypto";
import { Send, Smile, Paperclip, Plus, ShieldCheck, Sticker as StickerIcon, Image as ImageIcon, X, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GiphyPicker } from "./GiphyPicker";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  workspaceId: string;
  channelId?: string;
  recipientId?: string;
  channelName?: string;
  recipientName?: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: any;
  onCancelReply?: () => void;
}

const keyCache: Record<string, CryptoKey> = {};

export function MessageInput({ 
  workspaceId, 
  channelId, 
  recipientId, 
  channelName,
  recipientName,
  onTyping,
  onStopTyping,
  replyingTo,
  onCancelReply
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEncryptionActive, setIsEncryptionActive] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);
  const { user } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    async function fetchMembers() {
      if (!channelId) {
        setMembers([]);
        return;
      }
      const { data, error } = await supabase
        .from("channel_members")
        .select("user_id, profiles!user_id(id, username, full_name, avatar_url)")
        .eq("channel_id", channelId);
      
      if (!error && data) {
        setMembers(data.map((m: any) => m.profiles));
      }
    }
    fetchMembers();
  }, [channelId]);

  useEffect(() => {
    async function checkEncryption() {
      if (!channelId) {
        setIsEncryptionActive(false);
        return;
      }

      const { data: channel } = await supabase
        .from("channels")
        .select("encryption_enabled")
        .eq("id", channelId)
        .single();

      setIsEncryptionActive(!!channel?.encryption_enabled);
    }
    checkEncryption();
  }, [channelId]);

  const handleSendMessage = async (overrideContent?: string, type: "text" | "image" | "gif" | "sticker" = "text") => {
    const finalMsgContent = overrideContent || content.trim();
    if (!finalMsgContent && type === "text") return;
    if (loading || !user) return;
    
    const optimisticId = `opt-${Date.now()}`;
    const tempContent = finalMsgContent;
    
    const optimisticMessage = {
      id: optimisticId,
      content: tempContent,
      created_at: new Date().toISOString(),
      sender_id: user.id,
      workspace_id: workspaceId,
      channel_id: channelId,
      recipient_id: recipientId,
      parent_id: replyingTo?.id,
      payload: { type },
      is_optimistic: true
    };

    window.dispatchEvent(new CustomEvent('optimistic_message', { 
      detail: { message: optimisticMessage } 
    }));

    if (!overrideContent) setContent("");
    const currentReply = replyingTo;
    onCancelReply?.();
    setLoading(true);
    onStopTyping?.();

    try {
      let messageContent = finalMsgContent;
      let payload: any = { type, optimistic_id: optimisticId };
      let isEncrypted = false;

      if (isEncryptionActive && channelId) {
        let channelKey = keyCache[channelId];
        
        if (!channelKey) {
          const { data: member } = await supabase
            .from("channel_members")
            .select("encrypted_key")
            .eq("channel_id", channelId)
            .eq("user_id", user.id)
            .single();

          if (member?.encrypted_key) {
            const privateKey = await getPrivateKey();
            if (privateKey) {
              channelKey = await unwrapChannelKey(member.encrypted_key, privateKey);
              keyCache[channelId] = channelKey;
            }
          }
        }

        if (channelKey) {
          const encrypted = await encryptMessage(messageContent, channelKey);
          messageContent = encrypted.content;
          payload = { ...payload, iv: encrypted.iv };
          isEncrypted = true;
        }
      }

      const { error } = await supabase.from("messages").insert({
        workspace_id: workspaceId,
        channel_id: channelId,
        recipient_id: recipientId,
        sender_id: user.id,
        content: messageContent,
        is_encrypted: isEncrypted,
        parent_id: currentReply?.id,
        payload,
      });

      if (error) {
        console.error("Error sending message:", error);
      }
    } catch (err) {
      console.error("Encryption failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (mentionIndex >= 0) {
          insertMention(filteredMembers[mentionIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    if (e.key === "Escape" && replyingTo) {
      onCancelReply?.();
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
    <div className="px-2 md:px-4 pb-4">
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border-x border-t border-zinc-200 dark:border-zinc-800 rounded-t-lg animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="h-4 w-4 text-zinc-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                Replying to {replyingTo.sender?.full_name || replyingTo.sender?.username}
              </p>
              <p className="text-xs text-zinc-500 truncate italic">
                {replyingTo.content}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className={cn(
        "relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus-within:ring-1 focus-within:ring-primary/20 transition-shadow",
        replyingTo ? "rounded-b-lg border-t-0" : "rounded-lg"
      )}>
        <Textarea
          placeholder={placeholder}
          className="min-h-[44px] h-auto max-h-[150px] md:max-h-[200px] resize-none border-none bg-transparent shadow-none focus-visible:ring-0 px-4 pt-3 pb-2 text-sm"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => onStopTyping?.()}
        />
        
        <div className="flex items-center justify-between px-2 pb-2">
          <div className="flex items-center gap-0.5 md:gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Plus className="h-4 w-4" />
            </Button>
            <div className="h-4 w-[1px] bg-zinc-200 dark:border-zinc-800 mx-1" />
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                  <Smile className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0 border-none shadow-none bg-transparent" side="top" align="start">
                <EmojiPicker 
                  theme={theme === 'dark' ? Theme.DARK : Theme.LIGHT}
                  onEmojiClick={(emojiData) => setContent(prev => prev + emojiData.emoji)}
                  autoFocusSearch={false}
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" title="Add GIF">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" side="top" align="start">
                <GiphyPicker onSelect={(url) => handleSendMessage(url, "gif")} defaultTab="gifs" />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100" title="Add Sticker">
                  <StickerIcon className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" side="top" align="start">
                <GiphyPicker onSelect={(url) => handleSendMessage(url, "sticker")} defaultTab="stickers" />
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Paperclip className="h-4 w-4" />
            </Button>
            {isEncryptionActive && (
              <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Encrypted</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              className={`h-8 w-8 transition-all ${content.trim() ? 'bg-primary text-primary-foreground opacity-100 scale-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 scale-95 pointer-events-none'}`}
              onClick={() => handleSendMessage()}
              disabled={!content.trim() || loading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <p className="hidden md:block text-[10px] text-zinc-400 mt-2 ml-1">
        <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line{replyingTo && <>, <strong>Esc</strong> to cancel reply</>}
      </p>
    </div>
  );
}
