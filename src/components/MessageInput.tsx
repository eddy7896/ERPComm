"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { encryptMessage, unwrapChannelKey, getPrivateKey } from "@/lib/crypto";
import { Send, Smile, Paperclip, Plus, ShieldCheck, Sticker as StickerIcon, Image as ImageIcon, X, Reply, FileIcon, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GiphyPicker } from "./GiphyPicker";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";
import { compressImage } from "@/lib/image-compression";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

interface MessageInputProps {
  workspaceId: string;
  channelId?: string;
  recipientId?: string;
  channelName?: string;
  recipientName?: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: {
    id: string;
    content: string;
    sender?: {
      full_name?: string;
      username?: string;
    };
  };
  onCancelReply?: () => void;
}

const keyCache: Record<string, CryptoKey> = {};

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File, preview: string, type: 'image' | 'file' }[]>([]);
  const [isEncryptionActive, setIsEncryptionActive] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);
  const { user } = useAuth();
  const { theme } = useTheme();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = await Promise.all(acceptedFiles.map(async (file) => {
      const isImage = file.type.startsWith('image/');
      
      if (isImage) {
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`Image ${file.name} exceeds 5MB limit.`);
          return null;
        }
        const compressed = await compressImage(file);
        return {
          file: compressed,
          preview: URL.createObjectURL(compressed),
          type: 'image' as const
        };
      } else {
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`File ${file.name} exceeds 25MB limit.`);
          return null;
        }
        return {
          file,
          preview: '',
          type: 'file' as const
        };
      }
    }));

    setPendingFiles(prev => [...prev, ...newFiles.filter((f): f is NonNullable<typeof f> => f !== null)]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    accept: {
      'image/*': [],
      'application/pdf': [],
      'text/plain': [],
      'application/zip': [],
      'application/x-zip-compressed': [],
      'application/msword': [],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': []
    }
  });

  useEffect(() => {
    async function checkAccess() {
      if (!user || !channelId) {
        setIsMember(true);
        return;
      }

      const { data: channel } = await supabase
        .from("channels")
        .select("is_private")
        .eq("id", channelId)
        .single();

      if (channel?.is_private) {
        const { data: membership } = await supabase
          .from("channel_members")
          .select("id")
          .eq("channel_id", channelId)
          .eq("user_id", user.id)
          .single();
        
        setIsMember(!!membership);
      } else {
        setIsMember(true);
      }
    }
    checkAccess();
  }, [channelId, user]);

  useEffect(() => {
    async function fetchMembers() {
      if (!channelId) {
        setMembers([]);
        return;
      }
      const { data, error } = await supabase
        .from("channel_members")
        .select("profiles!user_id(id, username, full_name, avatar_url)")
        .eq("channel_id", channelId);
      
      if (!error && data) {
        setMembers(data.map((m: any) => m.profiles).filter(Boolean));
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

  const filteredMembers = members.filter(m => 
    m?.username?.toLowerCase().includes(mentionSearch.toLowerCase()) || 
    m?.full_name?.toLowerCase().includes(mentionSearch.toLowerCase())
  );

  const insertMention = (member: Profile) => {
    const before = content.slice(0, cursorPos - mentionSearch.length - 1);
    const after = content.slice(cursorPos);
    const newContent = `${before}@${member.username} ${after}`;
    setContent(newContent);
    setShowMentions(false);
    setMentionSearch("");
  };

  const handleSendMessage = async (overrideContent?: string, type: "text" | "image" | "gif" | "sticker" | "file" = "text") => {
    const finalMsgContent = overrideContent || content.trim();
    if (!finalMsgContent && type === "text" && pendingFiles.length === 0) return;
    if (loading || uploading || !user) return;
    
    setLoading(true);
    setUploading(true);
    const currentReply = replyingTo;
    onCancelReply?.();
    onStopTyping?.();

      try {
        let uploadedFiles: { url: string, name: string, type: string, size: number }[] = [];

        // Extract mentions from content
        const mentions: string[] = [];
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(finalMsgContent)) !== null) {
          mentions.push(match[1]);
        }

        for (const pending of pendingFiles) {

        const fileExt = pending.file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${workspaceId}/${fileName}`;

        const { error } = await supabase.storage
          .from('attachments')
          .upload(filePath, pending.file);

        if (error) {
          toast.error(`Failed to upload ${pending.file.name}`);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        uploadedFiles.push({
          url: publicUrl,
          name: pending.file.name,
          type: pending.file.type,
          size: pending.file.size
        });
      }

      const optimisticId = `opt-${Date.now()}`;
      let messageContent = finalMsgContent;
      let payload: Record<string, any> = { 
        type: uploadedFiles.length > 0 ? (uploadedFiles[0].type.startsWith('image/') ? 'image' : 'file') : type, 
        optimistic_id: optimisticId,
        files: uploadedFiles 
      };
      let isEncrypted = false;

      const optimisticMessage = {
        id: optimisticId,
        content: messageContent || (uploadedFiles.length > 0 ? uploadedFiles[0].name : ""),
        created_at: new Date().toISOString(),
        sender_id: user.id,
        workspace_id: workspaceId,
        channel_id: channelId,
        recipient_id: recipientId,
        parent_id: currentReply?.id,
        payload,
        is_optimistic: true
      };

      window.dispatchEvent(new CustomEvent('optimistic_message', { 
        detail: { message: optimisticMessage } 
      }));

      if (!overrideContent) setContent("");
      setPendingFiles([]);

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
          const encrypted = await encryptMessage(messageContent || (uploadedFiles.length > 0 ? uploadedFiles[0].name : ""), channelKey);
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
        content: messageContent || (uploadedFiles.length > 0 ? uploadedFiles[0].name : ""),
        is_encrypted: isEncrypted,
        parent_id: currentReply?.id,
        payload,
      });

      if (error) {
        console.error("Error sending message:", error);
      }
    } catch (err) {
      console.error("Upload/Send failed:", err);
    } finally {
      setLoading(false);
      setUploading(false);
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
    const value = e.target.value;
    const selectionStart = e.target.selectionStart;
    setContent(value);
    setCursorPos(selectionStart);

    const textBeforeCursor = value.slice(0, selectionStart);
    const lastAt = textBeforeCursor.lastIndexOf("@");
    
    if (lastAt !== -1 && (lastAt === 0 || textBeforeCursor[lastAt - 1] === " ")) {
      const search = textBeforeCursor.slice(lastAt + 1);
      if (!search.includes(" ")) {
        setMentionSearch(search);
        setShowMentions(true);
        setMentionIndex(0);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }

    if (value.trim()) {
      onTyping?.();
    } else {
      onStopTyping?.();
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const placeholder = channelId 
    ? `Message #${channelName || 'channel'}` 
    : `Message ${recipientName || 'user'}`;

  return (
    <div className="px-2 md:px-4 pb-4 relative" {...getRootProps()}>
      <input {...getInputProps()} id="file-input" />
      {isDragActive && (
        <div className="absolute inset-x-2 md:inset-x-4 inset-y-0 -top-2 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Paperclip className="h-10 w-10 animate-bounce" />
            <p className="font-bold">Drop files to upload</p>
          </div>
        </div>
      )}

      {!isMember ? (
        <div className="flex flex-col items-center justify-center p-6 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center">
          <Lock className="h-8 w-8 text-zinc-400 mb-2" />
          <h4 className="text-sm font-bold">This is a private channel</h4>
          <p className="text-xs text-zinc-500">Only members of this channel can view or send messages.</p>
        </div>
      ) : (
        <>
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-4 mb-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Channel Members</span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredMembers.map((member, i) => (
                  <button
                    key={member.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                      i === mentionIndex ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    )}
                    onClick={() => insertMention(member)}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <div className="h-6 w-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold overflow-hidden">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        member.full_name?.[0] || member.username?.[0]
                      )}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-medium truncate w-full">{member.full_name || member.username}</span>
                      <span className="text-[10px] text-zinc-500 truncate w-full">@{member.username}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-zinc-50/50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative group/file h-20 w-20 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center">
                    {file.type === 'image' ? (
                      <img src={file.preview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 p-2">
                        <FileIcon className="h-6 w-6 text-zinc-400" />
                        <span className="text-[8px] text-zinc-500 text-center truncate w-full px-1">{file.file.name}</span>
                      </div>
                    )}
                    <button 
                      onClick={() => removePendingFile(i)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-zinc-900/50 text-white flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
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

                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                  onClick={() => document.getElementById('file-input')?.click()}
                >
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
                  className={`h-8 w-8 transition-all ${(content.trim() || pendingFiles.length > 0) ? 'bg-primary text-primary-foreground opacity-100 scale-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 scale-95 pointer-events-none'}`}
                  onClick={() => handleSendMessage()}
                  disabled={(!content.trim() && pendingFiles.length === 0) || loading || uploading}
                >
                  {loading || uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
          <p className="hidden md:block text-[10px] text-zinc-400 mt-2 ml-1">
            <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line{replyingTo && <>, <strong>Esc</strong> to cancel reply</>}
          </p>
        </>
      )}
    </div>
  );
}
