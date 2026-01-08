"use client";

import { useEffect, useState, use } from "react";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { supabase } from "@/lib/supabase";
import { Hash, Lock, Info, Search, Bell, Star, AtSign, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface ChannelDetails {
  id: string;
  name: string;
  description?: string;
  is_private?: boolean;
}

interface RecipientDetails {
  id: string;
  full_name?: string;
  username?: string;
  status?: string;
}

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
  const [recipientDetails, setRecipientDetails] = useState<RecipientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { typingUsers, handleTyping, stopTyping } = useTypingIndicator(
    workspaceId,
    selectedChannelId || undefined,
    selectedRecipientId || undefined
  );

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchInitialChannel = async () => {
      const { data } = await supabase
        .from("channels")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name")
        .limit(1)
        .single();
      
      if (data) {
        setSelectedChannelId(data.id);
        setChannelDetails(data);
      }
    };

    fetchInitialChannel();
  }, [workspaceId]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedChannelId) {
        const { data } = await supabase.from("channels").select("*").eq("id", selectedChannelId).single();
        setChannelDetails(data);
        setRecipientDetails(null);
      } else if (selectedRecipientId) {
        const { data } = await supabase.from("profiles").select("*").eq("id", selectedRecipientId).single();
        setRecipientDetails(data);
        setChannelDetails(null);
      }
    };

    fetchDetails();
  }, [selectedChannelId, selectedRecipientId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-100">
      <WorkspaceSidebar 
        workspaceId={workspaceId}
        selectedChannelId={selectedChannelId}
        selectedRecipientId={selectedRecipientId}
        onSelectChannel={(id) => {
          setSelectedChannelId(id);
          setSelectedRecipientId(null);
        }}
        onSelectDM={(id) => {
          setSelectedRecipientId(id);
          setSelectedChannelId(null);
        }}
      />

      <main className="flex flex-1 flex-col min-w-0">
        <header className="flex h-14 items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            {channelDetails ? (
              <>
                {channelDetails.is_private ? (
                  <Lock className="h-5 w-5 text-zinc-500" />
                ) : (
                  <Hash className="h-5 w-5 text-zinc-500" />
                )}
                <h2 className="font-bold text-lg">{channelDetails.name}</h2>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Star className="h-4 w-4 text-zinc-400" />
                </Button>
                {channelDetails.description && (
                  <span className="text-sm text-zinc-500 hidden md:inline">
                    | {channelDetails.description}
                  </span>
                )}
              </>
            ) : recipientDetails ? (
              <>
                <h2 className="font-bold text-lg">{recipientDetails.full_name || recipientDetails.username}</h2>
                <div className={`h-2 w-2 rounded-full ${recipientDetails.status === 'online' ? 'bg-green-500' : 'bg-zinc-400'}`} />
              </>
            ) : (
              <div className="h-6 w-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors">
              <Search className="h-3 w-3 mr-2" />
              <span>Search...</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <AtSign className="h-4 w-4" />
            </Button>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <MessageList 
          workspaceId={workspaceId} 
          channelId={selectedChannelId || undefined}
          recipientId={selectedRecipientId || undefined}
          typingUsers={typingUsers}
        />

        <MessageInput 
          workspaceId={workspaceId}
          channelId={selectedChannelId || undefined}
          recipientId={selectedRecipientId || undefined}
          channelName={channelDetails?.name}
          recipientName={recipientDetails?.full_name || recipientDetails?.username}
          onTyping={handleTyping}
          onStopTyping={stopTyping}
        />
      </main>
    </div>
  );
}
