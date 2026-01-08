"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { encryptMessage, unwrapChannelKey, getPrivateKey } from "@/lib/crypto";
import { Send, Smile, Paperclip, Plus, ShieldCheck } from "lucide-react";
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

// Simple cache for unwrapped keys
const keyCache: Record<string, CryptoKey> = {};

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
  const [isEncryptionActive, setIsEncryptionActive] = useState(false);
  const { user } = useAuth();

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

  const handleSendMessage = async () => {
    if (!content.trim() || loading || !user) return;
    setLoading(true);
    onStopTyping?.();

    try {
      let finalContent = content.trim();
      let payload = null;
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
          const encrypted = await encryptMessage(finalContent, channelKey);
          finalContent = encrypted.content;
          payload = { iv: encrypted.iv };
          isEncrypted = true;
        }
      }

      const { error } = await supabase.from("messages").insert({
        workspace_id: workspaceId,
        channel_id: channelId,
        recipient_id: recipientId,
        sender_id: user.id,
        content: finalContent,
        is_encrypted: isEncrypted,
        payload,
      });

      if (error) {
        console.error("Error sending message:", error);
      } else {
        setContent("");
      }
    } catch (err) {
      console.error("Encryption failed:", err);
    } finally {
      setLoading(false);
    }
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
      <div className="px-2 md:px-4 pb-4">
        <div className="relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus-within:ring-1 focus-within:ring-primary/20 transition-shadow">
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hidden xs:flex">
                  <Smile className="h-4 w-4" />
                </Button>
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
                onClick={handleSendMessage}
                disabled={!content.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="hidden md:block text-[10px] text-zinc-400 mt-2 ml-1">
          <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line
        </p>
      </div>

  );
}
