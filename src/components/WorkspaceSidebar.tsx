"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, Lock, Plus, Settings, LogOut, ChevronDown, UserPlus, Layout, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [searchQuery, setSearchQuery] = useState("");
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
          setChannels(prev => [...prev, payload.new as Channel].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === 'DELETE') {
          setChannels(prev => prev.filter(c => c.id !== (payload.old as Channel).id));
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
    if (presence.status === "online") return "bg-emerald-500";
    if (presence.status === "idle") return "bg-amber-500";
    return "bg-zinc-400";
  };

  const filteredMembers = members.filter(member => 
    (member.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
    (member.username?.toLowerCase() || "").includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-[280px] flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-12 w-full items-center justify-between px-3 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-lg transition-all active:scale-[0.98]">
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0">
                  {workspace?.name?.[0].toUpperCase() || "W"}
                </div>
                <span className="font-bold text-base truncate">{workspace?.name || "Workspace"}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-40 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="start" sideOffset={8}>
            <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="px-3 py-2 focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => setShowInvite(true)}>
              <UserPlus className="mr-3 h-4 w-4 opacity-70" /> Invite People
            </DropdownMenuItem>
            <DropdownMenuItem className="px-3 py-2 focus:bg-zinc-100 dark:focus:bg-zinc-800" onClick={() => router.push("/workspaces")}>
              <Layout className="mr-3 h-4 w-4 opacity-70" /> Switch Workspace
            </DropdownMenuItem>
            <DropdownMenuItem className="px-3 py-2 focus:bg-zinc-100 dark:focus:bg-zinc-800">
              <Settings className="mr-3 h-4 w-4 opacity-70" /> Workspace Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="px-3 py-2 text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30" onClick={handleLogout}>
              <LogOut className="mr-3 h-4 w-4" /> Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-6 py-2">
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Channels</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => setShowCreateChannel(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {channels.map((channel) => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={`w-full justify-start h-9 px-3 font-medium transition-all group rounded-lg ${
                    selectedChannelId === channel.id 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  }`}
                  onClick={() => onSelectChannel(channel.id)}
                >
                  {channel.is_private ? (
                    <Lock className={`mr-2.5 h-4 w-4 ${selectedChannelId === channel.id ? "opacity-100" : "opacity-60"}`} />
                  ) : (
                    <Hash className={`mr-2.5 h-4 w-4 ${selectedChannelId === channel.id ? "opacity-100" : "opacity-60"}`} />
                  )}
                  <span className="truncate">{channel.name}</span>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-[0.1em]">Direct Messages</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-60 hover:opacity-100 transition-opacity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
              <div className="space-y-0.5">
                {filteredMembers.map((member) => (
                  <Button
                    key={member.id}
                    variant="ghost"
                  className={`w-full justify-start h-9 px-2.5 font-medium transition-all group rounded-lg ${
                    selectedRecipientId === member.id 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  }`}
                  onClick={() => onSelectDM(member.id)}
                >
                  <div className="relative mr-2.5">
                    <Avatar className="h-6 w-6 border border-zinc-200 dark:border-zinc-800">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-zinc-200 dark:bg-zinc-800">{member.full_name?.[0] || member.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-50 dark:border-zinc-950 ${getStatusColor(member.id)}`} />
                  </div>
                  <span className="truncate">{member.full_name || member.username}</span>
                </Button>
              ))}
              {members.length === 0 && (
                <p className="text-xs text-zinc-500 px-3 py-2 italic opacity-60">No other members</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3 px-1">
          <div className="relative group cursor-pointer">
            <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800 transition-transform group-hover:scale-105">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary">{user?.user_metadata?.full_name?.[0] || user?.email?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-100 dark:border-zinc-900 bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-none mb-1">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </p>
            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-500 leading-none">Online</p>
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
