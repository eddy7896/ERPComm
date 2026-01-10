"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Hash, Lock, Plus, Settings, LogOut, ChevronDown, UserPlus, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { StatusPicker } from "./StatusPicker";
import { ProfileSettingsDialog, BADGE_OPTIONS } from "./ProfileSettingsDialog";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

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
  status_text?: string;
  status_emoji?: string;
  badge?: string;
}

interface UnreadCount {
  channel_id: string | null;
  recipient_id: string | null;
  unread_count: number;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export function WorkspaceSidebar({ 
  workspaceId, 
  selectedChannelId, 
  selectedRecipientId,
  onSelectChannel, 
  onSelectDM
}: WorkspaceSidebarProps) {
  const { profile, refreshProfile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCount[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { getPresence } = usePresence(workspaceId);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/details?userId=${user.id}`);
        if (response.ok) {
          const data = await response.json();
          setWorkspace(data.workspace);
          setChannels(data.channels);
          setMembers(data.members);
          setUnreadCounts(data.unreadCounts);
        } else {
          const { data: ws } = await supabase.from("workspaces").select("*").eq("id", workspaceId).single();
          setWorkspace(ws);

          const { data: chans } = await supabase.from("channels").select("*").eq("workspace_id", workspaceId).order("name");
          const { data: memberships } = await supabase
            .from("channel_members")
            .select("channel_id")
            .eq("user_id", user.id);

          const memberChannelIds = new Set(memberships?.map(m => m.channel_id) || []);
          const filteredChannels = chans?.filter(c => !c.is_private || memberChannelIds.has(c.id)) || [];
          setChannels(filteredChannels);

          const { data: mems } = await supabase
            .from("workspace_members")
            .select("profiles(*)")
            .eq("workspace_id", workspaceId);
          
          const mappedMembers = mems?.map((m: any) => m.profiles).filter((p: any) => p && p.id !== user?.id) || [];
          setMembers(mappedMembers);

          const { data: unreads } = await supabase.rpc("get_unread_counts", {
            p_workspace_id: workspaceId,
            p_user_id: user.id
          });
          setUnreadCounts(unreads || []);
        }
      } catch (error) {
        console.error("Error fetching workspace details:", error);
      }
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

    const messageSub = supabase
      .channel('public:messages_unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new;
          if (msg.recipient_id === profile?.id && msg.sender_id !== profile?.id) {
            new Audio('/pop.mp3').play().catch(e => console.error("Error playing sound:", e));
          }
        }
        fetchData();
      })
      .subscribe();

    const readSub = supabase
      .channel('public:member_last_read')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'member_last_read', filter: `workspace_id=eq.${workspaceId}` }, () => {
        fetchData();
      })
      .subscribe();

    const notificationSub = supabase
      .channel('public:notifications_sound')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${profile?.id}` 
      }, (payload) => {
        if (payload.new.type === 'mention') {
          new Audio('/pop.mp3').play().catch(e => console.error("Error playing sound:", e));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
      supabase.removeChannel(messageSub);
      supabase.removeChannel(readSub);
      supabase.removeChannel(notificationSub);
    };
  }, [workspaceId, profile?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
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

  const getUnreadCount = (id: string, isChannel: boolean) => {
    const found = unreadCounts.find(u => isChannel ? u.channel_id === id : u.recipient_id === id);
    return found ? found.unread_count : 0;
  };

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      <div className="p-3 flex items-center justify-between gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex h-12 flex-1 items-center justify-between px-3 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 rounded-lg transition-all active:scale-[0.98]">
              <div className="flex items-center gap-2 truncate">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm shrink-0 shadow-sm">
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
                  className={cn(
                    "w-full h-9 font-medium transition-all group rounded-lg justify-start px-3",
                    selectedChannelId === channel.id 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  )}
                  onClick={() => onSelectChannel(channel.id)}
                >
                  {channel.is_private ? (
                    <Lock className={cn("h-4 w-4 mr-2.5", selectedChannelId === channel.id ? "opacity-100" : "opacity-60")} />
                  ) : (
                    <Hash className={cn("h-4 w-4 mr-2.5", selectedChannelId === channel.id ? "opacity-100" : "opacity-60")} />
                  )}
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {getUnreadCount(channel.id, true) > 0 && (
                    <Badge className="ml-auto h-5 w-5 p-0 flex items-center justify-center bg-primary text-[10px]">
                      {getUnreadCount(channel.id, true)}
                    </Badge>
                  )}
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
                  className={cn(
                    "w-full h-9 font-medium transition-all group rounded-lg justify-start px-2.5",
                    selectedRecipientId === member.id 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm" 
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50"
                  )}
                  onClick={() => onSelectDM(member.id)}
                >
                  <div className="relative mr-2.5">
                    <Avatar className="h-6 w-6 border border-zinc-200 dark:border-zinc-800">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-zinc-200 dark:bg-zinc-800">{member.full_name?.[0] || member.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-50 dark:border-zinc-950 ${getStatusColor(member.id)}`} />
                  </div>
                  <div className="flex flex-col truncate flex-1 text-left">
                    <span className="truncate">{member.full_name || member.username}</span>
                    {member.username && (
                      <span className="text-[10px] text-zinc-500 font-medium truncate">@{member.username}</span>
                    )}
                  </div>
                  {getUnreadCount(member.id, false) > 0 && (
                    <Badge className="mr-1.5 h-5 w-5 p-0 flex items-center justify-center bg-primary text-[10px]">
                      {getUnreadCount(member.id, false)}
                    </Badge>
                  )}
                  {member.badge && (() => {
                    const badgeOption = BADGE_OPTIONS.find(b => b.label === member.badge);
                    return (
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border ml-1.5",
                        badgeOption?.color || "bg-zinc-100 text-zinc-500 border-zinc-200"
                      )}>
                        {member.badge}
                      </span>
                    );
                  })()}
                  {member.status_emoji && (
                    <span className="text-xs ml-1 opacity-70">{member.status_emoji}</span>
                  )}
                </Button>
              ))}

              {members.length === 0 && (
                <p className="text-xs text-zinc-500 px-3 py-2 italic opacity-60">No other members</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/30 dark:bg-zinc-900/10">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400 group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search members..."
            className="pl-9 h-9 bg-transparent border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 focus-visible:ring-primary/20 text-xs"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-3 px-1">
          <div className="relative group cursor-pointer" onClick={() => setShowProfileSettings(true)}>
            <Avatar className="h-9 w-9 border border-zinc-200 dark:border-zinc-800 transition-transform group-hover:scale-105">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="bg-primary/10 text-primary">{profile?.full_name?.[0] || profile?.id?.[0]}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-100 dark:border-zinc-900 bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setShowProfileSettings(true)}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                  {profile?.full_name || "User"}
                </p>
                {profile?.username && (
                  <p className="text-[10px] text-zinc-500 font-medium truncate">
                    @{profile.username}
                  </p>
                )}
              </div>
              {profile?.badge && (() => {
                const badgeOption = BADGE_OPTIONS.find(b => b.label === profile.badge);
                return (
                  <span className={cn(
                    "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                    badgeOption?.color || "bg-primary/10 text-primary border-primary/20"
                  )}>
                    {profile.badge}
                  </span>
                );
              })()}
            </div>
            <StatusPicker 
              currentStatus={profile?.status_text} 
              currentEmoji={profile?.status_emoji}
              onStatusUpdate={(text, emoji) => refreshProfile()}
            />
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

      <ProfileSettingsDialog 
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
      />
    </div>
  );
}
