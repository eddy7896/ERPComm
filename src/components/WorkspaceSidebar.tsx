"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, Lock, Plus, Settings, LogOut, ChevronDown, UserPlus, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { InviteDialog } from "./InviteDialog";
import { ThemeToggle } from "./ThemeToggle";
import { usePresence } from "@/hooks/usePresence";

interface WorkspaceSidebarProps {
  workspaceId: string;
  selectedChannelId: string | null;
  selectedRecipientId: string | null;
  onSelectChannel: (id: string) => void;
  onSelectDM: (id: string) => void;
}

interface Channel {
  id: string;
  name: string;
  is_private?: boolean;
}

interface Member {
  id: string;
  avatar_url?: string;
  full_name?: string;
  username?: string;
}

interface Workspace {
  id: string;
  name: string;
}

interface User {
  id: string;
  email: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
  };
}

export function WorkspaceSidebar({ 
  workspaceId, 
  selectedChannelId, 
  selectedRecipientId,
  onSelectChannel, 
  onSelectDM 
}: WorkspaceSidebarProps) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const router = useRouter();
  const { getPresence } = usePresence(workspaceId);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
      setWorkspace(ws);

      const { data: chans } = await supabase.from("channels").select("*").eq("workspace_id", workspaceId).order("name");
      setChannels(chans || []);

      const { data: mems } = await supabase
        .from("workspace_members")
        .select("profiles(*)")
        .eq("workspace_id", workspaceId);
      
      setMembers(mems?.map((m: { profiles: Member }) => m.profiles).filter((p: Member | null) => p && p.id !== user?.id) || []);
    };

    fetchData();

    const channelSub = supabase
      .channel('public:channels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChannels(prev => [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === 'DELETE') {
          setChannels(prev => prev.filter(c => c.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
    };
  }, [workspaceId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getStatusColor = (userId: string) => {
    const presence = getPresence(userId);
    if (!presence) return "bg-zinc-400";
    if (presence.status === "online") return "bg-green-500";
    if (presence.status === "idle") return "bg-yellow-500";
    return "bg-zinc-400";
  };

  return (
    <div className="flex h-full w-64 flex-col bg-zinc-100 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex h-14 w-full items-center justify-between px-4 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-none border-b border-zinc-200 dark:border-zinc-800">
            <span className="font-bold truncate">{workspace?.name || "Workspace"}</span>
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel>Workspace Options</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowInvite(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Invite People
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/workspaces")}>
            <Layout className="mr-2 h-4 w-4" /> Switch Workspace
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" /> Workspace Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ScrollArea className="flex-1 px-2 py-4">
        <div className="mb-6">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Channels</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setShowCreateChannel(true)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-0.5">
            {channels.map((channel) => (
              <Button
                key={channel.id}
                variant={selectedChannelId === channel.id ? "secondary" : "ghost"}
                className={`w-full justify-start h-8 px-2 font-medium ${selectedChannelId === channel.id ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}`}
                onClick={() => onSelectChannel(channel.id)}
              >
                {channel.is_private ? (
                  <Lock className="mr-2 h-4 w-4 opacity-70" />
                ) : (
                  <Hash className="mr-2 h-4 w-4 opacity-70" />
                )}
                {channel.name}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Direct Messages</span>
            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-zinc-200 dark:hover:bg-zinc-800">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          <div className="space-y-0.5">
            {members.map((member) => (
              <Button
                key={member.id}
                variant={selectedRecipientId === member.id ? "secondary" : "ghost"}
                className={`w-full justify-start h-8 px-2 font-medium ${selectedRecipientId === member.id ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}`}
                onClick={() => onSelectDM(member.id)}
              >
                <div className="relative mr-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="text-[10px]">{member.full_name?.[0] || member.username?.[0]}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full border border-white dark:border-zinc-900 ${getStatusColor(member.id)}`} />
                </div>
                <span className="truncate">{member.full_name || member.username}</span>
              </Button>
            ))}
            {members.length === 0 && (
              <p className="text-xs text-zinc-500 px-2 py-2">No other members yet</p>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>{user?.user_metadata?.full_name?.[0] || user?.email?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute bottom-0 right-0 h-2 w-2 rounded-full border-2 border-zinc-50 dark:border-zinc-900 bg-green-500" />
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium leading-none truncate">{user?.user_metadata?.full_name || user?.email}</p>
            <p className="text-xs text-zinc-500 truncate">Online</p>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <CreateChannelDialog
        workspaceId={workspaceId}
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        onChannelCreated={(channel) => onSelectChannel(channel.id)}
      />

      <InviteDialog
        workspaceId={workspaceId}
        workspaceName={workspace?.name || ""}
        open={showInvite}
        onOpenChange={setShowInvite}
      />
    </div>
  );
}
