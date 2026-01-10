"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { encryptMessage, unwrapChannelKey, getPrivateKey } from "@/lib/crypto";
import { Send, Smile, Paperclip, Plus, ShieldCheck, Image as ImageIcon, X, Reply, FileIcon, Loader2, Lock, Cloud, UploadCloud } from "lucide-react";
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
import useDrivePicker from "react-google-drive-picker";
import { motion, AnimatePresence } from "framer-motion";

interface Profile {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

interface PendingFile {
  file?: File;
  preview: string;
  type: 'image' | 'file' | 'drive';
  name: string;
  url?: string;
  size?: number;
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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isEncryptionActive, setIsEncryptionActive] = useState(false);
  const [isMember, setIsMember] = useState(true);
  const [members, setMembers] = useState<Profile[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [cursorPos, setCursorPos] = useState(0);
  const { user } = useAuth();
  const { theme } = useTheme();
  const [openPicker] = useDrivePicker();

  const handleOpenPicker = () => {
    openPicker({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
      developerKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "",
      viewId: "DOCS",
      showUploadView: true,
      showUploadFolders: true,
      supportDrives: true,
      multiselect: true,
      callbackFunction: (data) => {
        if (data.action === "picked") {
          const newDriveFiles: PendingFile[] = data.docs.map(doc => ({
            name: doc.name,
            url: doc.url,
            type: 'drive',
            preview: doc.iconUrl || '',
            size: doc.sizeBytes || 0,
          }));
          setPendingFiles(prev => [...prev, ...newDriveFiles]);
        }
      },
    });
  };

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
          setMembers(data.map((m: { profiles: Profile }) => m.profiles).filter(Boolean));
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
    const hasFiles = pendingFiles.length > 0;
    
    if (hasFiles) {
      setUploading(true);
      setUploadProgress(0);
    }
    
    // Simulate progress for visual effect
    let progressInterval: NodeJS.Timeout | null = null;
    if (hasFiles) {
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 95) return prev;
          return prev + 5;
        });
      }, 200);
    }

    const currentReply = replyingTo;
    onCancelReply?.();
    onStopTyping?.();

        try {
          const uploadedFiles: { url: string, name: string, type: string, size: number }[] = [];

          // Extract mentions from content

        const mentions: string[] = [];
        const mentionRegex = /@(\w+)/g;
        let match;
        while ((match = mentionRegex.exec(finalMsgContent)) !== null) {
          mentions.push(match[1]);
        }

          for (const pending of pendingFiles) {
            if (pending.type === 'drive') {
              uploadedFiles.push({
                url: pending.url || '',
                name: pending.name,
                type: 'drive',
                size: pending.size || 0
              });
              continue;
            }

            if (!pending.file) continue;

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
          files: uploadedFiles,
          mentions
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

        const { data: msgData, error } = await supabase.from("messages").insert({
          workspace_id: workspaceId,
          channel_id: channelId,
          recipient_id: recipientId,
          sender_id: user.id,
          content: messageContent || (uploadedFiles.length > 0 ? uploadedFiles[0].name : ""),
          is_encrypted: isEncrypted,
          parent_id: currentReply?.id,
          payload,
        }).select().single();

        if (error) {
          console.error("Error sending message:", error);
        } else if (msgData && mentions.length > 0) {
          // Handle mentions
          const { data: mentionedUsers } = await supabase
            .from('profiles')
            .select('id')
            .in('username', mentions);

          if (mentionedUsers && mentionedUsers.length > 0) {
            const notifications = mentionedUsers
              .filter(u => u.id !== user.id) // Don't notify self
              .map(u => ({
                user_id: u.id,
                actor_id: user.id,
                workspace_id: workspaceId,
                channel_id: channelId,
                message_id: msgData.id,
                type: 'mention' as const,
                content: finalMsgContent.substring(0, 100)
              }));

            if (notifications.length > 0) {
              await supabase.from('notifications').insert(notifications);
            }
          }
        }

      } catch (err) {
        console.error("Upload/Send failed:", err);
      } finally {
        if (progressInterval) clearInterval(progressInterval);
        setLoading(false);
        setUploading(false);
        setUploadProgress(0);
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
    <div className="px-3 md:px-4 pb-4 md:pb-6 relative" {...getRootProps()}>
      <input {...getInputProps()} id="file-input" />
      
      <AnimatePresence>
        {uploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-x-3 md:inset-x-4 inset-y-0 -top-2 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-[60] flex flex-col items-center justify-center rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl"
          >
            <div className="relative mb-4">
              <motion.div
                animate={{ 
                  y: [0, -20, 0],
                  scale: [1, 1.1, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-500/20"
              >
                <UploadCloud className="h-8 w-8 text-white" />
              </motion.div>
              <motion.div 
                animate={{ opacity: [0, 1, 0], scale: [0.5, 1.5, 2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 bg-blue-500 rounded-2xl -z-10"
              />
            </div>
            <div className="text-center space-y-2 w-full max-w-[240px]">
              <p className="text-sm font-bold tracking-tight">Uploading Attachments...</p>
              <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                />
              </div>
              <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">{uploadProgress}% complete</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isDragActive && (
        <div className="absolute inset-x-3 md:inset-x-4 inset-y-0 -top-2 bg-primary/10 border-2 border-dashed border-primary rounded-2xl z-50 flex items-center justify-center backdrop-blur-[2px] animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Paperclip className="h-10 w-10 animate-bounce" />
            <p className="font-bold">Drop files to upload</p>
          </div>
        </div>
      )}

      {!isMember ? (
        <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-900/50 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center backdrop-blur-sm">
          <Lock className="h-8 w-8 text-zinc-400 mb-3" />
          <h4 className="text-sm font-bold">This is a private channel</h4>
          <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">Only members of this channel can view or send messages.</p>
        </div>
      ) : (
        <>
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full left-3 md:left-4 mb-3 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200 backdrop-blur-xl">
              <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Channel Members</span>
              </div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {filteredMembers.map((member, i) => (
                  <button
                    key={member.id}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all",
                      i === mentionIndex ? "bg-primary/5 dark:bg-primary/10 text-primary" : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    )}
                    onClick={() => insertMention(member)}
                    onMouseEnter={() => setMentionIndex(i)}
                  >
                    <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold overflow-hidden ring-2 ring-transparent group-hover:ring-primary/20 transition-all">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        member.full_name?.[0] || member.username?.[0]
                      )}
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="font-semibold truncate w-full">{member.full_name || member.username}</span>
                      <span className="text-[10px] text-zinc-500 truncate w-full">@{member.username}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {replyingTo && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm border-x border-t border-zinc-200 dark:border-zinc-800 rounded-t-2xl animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Reply className="h-3 w-3 text-primary shrink-0" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-tight">
                    Replying to {replyingTo.sender?.full_name || replyingTo.sender?.username}
                  </p>
                  <p className="text-xs text-zinc-500 truncate italic mt-0.5">
                    {replyingTo.content}
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                onClick={onCancelReply}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <div className={cn(
            "relative flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:shadow-md focus-within:border-zinc-300 dark:focus-within:border-zinc-700 transition-all duration-200",
            replyingTo ? "rounded-b-2xl border-t-0" : "rounded-2xl"
          )}>
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-3 p-3 bg-zinc-50/30 dark:bg-zinc-800/20 border-b border-zinc-100 dark:border-zinc-800/50">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative group/file h-24 w-24 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 flex items-center justify-center shadow-sm">
                      {file.type === 'image' ? (
                        <img src={file.preview} alt="" className="h-full w-full object-cover transition-transform group-hover/file:scale-105" />
                      ) : file.type === 'drive' ? (
                        <div className="flex flex-col items-center gap-2 p-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                            <Cloud className="h-5 w-5 text-blue-500" />
                          </div>
                          <span className="text-[10px] font-medium text-zinc-500 text-center truncate w-full px-1">{file.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-3">
                          <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                            <FileIcon className="h-5 w-5 text-zinc-400" />
                          </div>
                          <span className="text-[10px] font-medium text-zinc-500 text-center truncate w-full px-1">{file.name}</span>
                        </div>
                      )}

                    <button 
                      onClick={() => removePendingFile(i)}
                      className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-zinc-900/80 text-white flex items-center justify-center opacity-0 group-hover/file:opacity-100 transition-all hover:bg-red-500 shadow-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-end">
              <Textarea
                placeholder={placeholder}
                className="min-h-[52px] h-auto max-h-[180px] md:max-h-[220px] resize-none border-none bg-transparent shadow-none focus-visible:ring-0 px-5 pt-4 pb-3 text-[15px] leading-relaxed"
                value={content}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={() => onStopTyping?.()}
              />
              
                <div className="flex items-center justify-between px-3 py-3 md:pb-3 md:pt-0 md:pr-4">
                <div className="flex items-center gap-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <Plus className="h-[18px] w-[18px]" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-2 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl" side="top" align="start">
                      <div className="grid grid-cols-1 gap-1">
                          <button 
                            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            onClick={handleOpenPicker}
                          >
                            <Cloud className="h-4 w-4 text-blue-500" />
                            <span>Google Drive</span>
                          </button>
                          <button 
                            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            onClick={() => document.getElementById('file-input')?.click()}
                          >
                            <ImageIcon className="h-4 w-4 text-blue-500" />
                            <span>Upload Image</span>
                          </button>

                        <button 
                          className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          onClick={() => document.getElementById('file-input')?.click()}
                        >
                          <Paperclip className="h-4 w-4 text-emerald-500" />
                          <span>Attach File</span>
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1 hidden md:block" />
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                        <Smile className="h-[18px] w-[18px]" />
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
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors hidden md:flex" title="Add GIF">
                        <ImageIcon className="h-[18px] w-[18px]" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-none bg-transparent" side="top" align="start">
                      <GiphyPicker onSelect={(url) => handleSendMessage(url, "gif")} defaultTab="gifs" />
                    </PopoverContent>
                  </Popover>

                  {isEncryptionActive && (
                    <div className="flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                      <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Secured</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                    <Button 
                      size="icon" 
                      className={`h-9 w-9 rounded-xl transition-all duration-300 shadow-sm ${(content.trim() || pendingFiles.length > 0) ? 'bg-blue-600 hover:bg-blue-700 text-white opacity-100 scale-100' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 opacity-50 scale-95 pointer-events-none'}`}
                      onClick={() => handleSendMessage()}
                      disabled={(!content.trim() && pendingFiles.length === 0) || loading || uploading}
                    >
                    {loading || uploading ? (
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    ) : (
                      <Send className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <p className="hidden md:block text-[10px] text-zinc-400 mt-2.5 ml-2">
            <strong>Return</strong> to send, <strong>Shift + Return</strong> for new line{replyingTo && <>, <strong>Esc</strong> to cancel reply</>}
          </p>
        </>
      )}
    </div>
  );
}
