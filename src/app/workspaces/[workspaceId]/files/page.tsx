"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { 
  FileIcon, 
  Cloud, 
  ExternalLink, 
  Download, 
  Search, 
  Filter,
  Image as ImageIcon,
  FileText,
  MoreVertical,
  Calendar,
  User as UserIcon,
  ArrowLeft,
  Upload,
  UploadCloud,
  X,
  Paperclip
} from "lucide-react";
import { format } from "date-fns";
import { cn, downloadFile } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRouter, useParams } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compression";

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
  messageId: string;
  senderName: string;
  createdAt: string;
}

export default function FilesPage() {
  const { workspaceId } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const fetchFiles = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        created_at,
        payload,
        sender:profiles!sender_id(full_name, username)
      `)
      .eq("workspace_id", workspaceId)
      .not("payload->files", "is", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      const allFiles: Attachment[] = [];
      data.forEach((msg: any) => {
        if (msg.payload?.files && Array.isArray(msg.payload.files)) {
          msg.payload.files.forEach((file: any) => {
            allFiles.push({
              name: file.name,
              url: file.url,
              type: file.type,
              size: file.size || 0,
              messageId: msg.id,
              senderName: msg.sender?.full_name || msg.sender?.username || "Unknown",
              createdAt: msg.created_at
            });
          });
        }
      });
      setAttachments(allFiles);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!workspaceId || !user) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 95) return prev;
        return prev + 5;
      });
    }, 150);

    try {
      const uploadedFiles: { url: string, name: string, type: string, size: number }[] = [];

      for (const file of acceptedFiles) {
        const isImage = file.type.startsWith('image/');
        let fileToUpload = file;

        if (isImage && file.size > 5 * 1024 * 1024) {
          fileToUpload = await compressImage(file);
        } else if (file.size > 25 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 25MB)`);
          continue;
        }

        const fileExt = fileToUpload.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${workspaceId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('attachments')
          .upload(filePath, fileToUpload);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('attachments')
          .getPublicUrl(filePath);

        uploadedFiles.push({
          url: publicUrl,
          name: file.name,
          type: file.type,
          size: file.size
        });
      }

      if (uploadedFiles.length > 0) {
        // Find a channel to post to
        const { data: channels } = await supabase
          .from("channels")
          .select("id")
          .eq("workspace_id", workspaceId)
          .limit(1);

        const channelId = channels?.[0]?.id;

        await supabase.from("messages").insert({
          workspace_id: workspaceId,
          channel_id: channelId,
          sender_id: user.id,
          content: `Uploaded ${uploadedFiles.length} file(s) from Dashboard`,
          payload: {
            type: 'file',
            files: uploadedFiles,
            from_dashboard: true
          }
        });

        toast.success(`Successfully uploaded ${uploadedFiles.length} file(s)`);
        fetchFiles();
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload files");
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
      setUploadProgress(0);
    }
  }, [workspaceId, user, fetchFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, noClick: true });

  const filteredFiles = attachments.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         file.senderName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filter === "all") return matchesSearch;
    if (filter === "drive") return matchesSearch && file.type === "drive";
    if (filter === "images") return matchesSearch && file.type.startsWith("image/");
    if (filter === "docs") return matchesSearch && !file.type.startsWith("image/") && file.type !== "drive";
    return matchesSearch;
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 relative" {...getRootProps()}>
      <input {...getInputProps()} />
      
      <AnimatePresence>
        {isDragActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] z-[70] flex items-center justify-center border-4 border-dashed border-blue-500 rounded-xl m-4"
          >
            <div className="flex flex-col items-center gap-4 text-blue-600 dark:text-blue-400">
              <UploadCloud className="h-16 w-16 animate-bounce" />
              <p className="text-xl font-bold">Drop files to upload to workspace</p>
            </div>
          </motion.div>
        )}

        {uploading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-[80] flex flex-col items-center justify-center"
          >
            <div className="relative mb-8">
              <motion.div
                animate={{ 
                  y: [0, -30, 0],
                  scale: [1, 1.2, 1],
                  rotate: [0, 15, -15, 0]
                }}
                transition={{ 
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="bg-blue-600 p-6 rounded-3xl shadow-2xl shadow-blue-500/40"
              >
                <UploadCloud className="h-12 w-12 text-white" />
              </motion.div>
              <motion.div 
                animate={{ opacity: [0, 0.5, 0], scale: [1, 2, 2.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-blue-500 rounded-3xl -z-10"
              />
            </div>
            <div className="text-center space-y-4 w-full max-w-sm px-6">
              <h3 className="text-2xl font-bold tracking-tight">Syncing with Cloud</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Please wait while we secure your files in the workspace.</p>
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.6)]"
                />
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Files & Attachments</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 gap-2"
            onClick={() => {
              const input = document.querySelector('input[type="file"]') as HTMLInputElement;
              if (input) input.click();
            }}
          >
            <Upload className="h-4 w-4" />
            <span>Upload Files</span>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-4 flex flex-col md:flex-row gap-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <Input 
            placeholder="Search files by name or sender..." 
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={filter} onValueChange={setFilter} className="w-auto">
          <TabsList>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
            <TabsTrigger value="drive" className="text-xs flex items-center gap-1.5">
              <Cloud className="h-3 w-3 text-blue-500" /> Drive
            </TabsTrigger>
            <TabsTrigger value="images" className="text-xs flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3 text-emerald-500" /> Images
            </TabsTrigger>
            <TabsTrigger value="docs" className="text-xs flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-amber-500" /> Documents
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : filteredFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFiles.map((file, i) => (
                <div key={i} className="group flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md transition-all">
                  <div className="relative aspect-video bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center overflow-hidden border-b border-zinc-100 dark:border-zinc-800">
                    {file.type.startsWith("image/") ? (
                      <img src={file.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    ) : file.type === "drive" ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-16 w-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shadow-inner">
                          <Cloud className="h-8 w-8 text-blue-500" />
                        </div>
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Google Drive</span>
                      </div>
                    ) : (
                      <div className="h-16 w-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                        <FileIcon className="h-8 w-8 text-zinc-400" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      {file.type === "drive" ? (
                        <Button variant="secondary" size="sm" className="gap-2" onClick={() => window.open(file.url, '_blank')}>
                          <ExternalLink className="h-4 w-4" /> Open
                        </Button>
                      ) : (
                        <>
                          <Button variant="secondary" size="sm" className="gap-2" onClick={() => window.open(file.url, '_blank')}>
                            <ExternalLink className="h-4 w-4" /> View
                          </Button>
                          <Button variant="secondary" size="sm" className="gap-2" onClick={() => downloadFile(file.url, file.name)}>
                            <Download className="h-4 w-4" /> Save
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-3">
                    <h3 className="text-sm font-semibold truncate mb-2" title={file.name}>{file.name}</h3>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <UserIcon className="h-3 w-3" />
                        <span className="truncate">Shared by {file.senderName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <span className="text-[10px] font-medium text-zinc-400">
                          {file.type === "drive" ? "Google Drive" : formatFileSize(file.size)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
                              <ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab
                            </DropdownMenuItem>
                            {file.type !== "drive" && (
                              <DropdownMenuItem onClick={() => downloadFile(file.url, file.name)}>
                                <Download className="mr-2 h-4 w-4" /> Download
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <FileIcon className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-lg font-bold">No files found</h3>
              <p className="text-sm text-zinc-500">Shared files and attachments will appear here.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
