"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, UserPlus, Users, Loader2, Trash2, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ChannelMembersDialogProps {
  channelId: string;
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelName: string;
}

interface ChannelMemberResponse {
  user_id: string;
  profiles: Profile;
}

export function ChannelMembersDialog({
  channelId,
  workspaceId,
  open,
  onOpenChange,
  channelName,
}: ChannelMembersDialogProps) {
  const { user } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [nonMembers, setNonMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingMember, setAddingMember] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<Profile | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelCreator, setChannelCreator] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch channel details to find creator
      const { data: channelData, error: cError } = await supabase
        .from("channels")
        .select("created_by")
        .eq("id", channelId)
        .single();

      if (cError) throw cError;
      setChannelCreator(channelData.created_by);

      // Fetch channel members
      const { data: channelMembersData, error: cmError } = await supabase
        .from("channel_members")
        .select("user_id, profiles!inner(*)")
        .eq("channel_id", channelId);

      if (cmError) throw cmError;

        const currentMembers = (channelMembersData as unknown as ChannelMemberResponse[]).map((m) => m.profiles);
        setMembers(currentMembers);
  
        // Fetch all workspace members
        const { data: workspaceMembersData, error: wmError } = await supabase
          .from("workspace_members")
          .select("user_id, profiles!inner(*)")
          .eq("workspace_id", workspaceId);
  
        if (wmError) throw wmError;
  
        const memberIds = new Set(currentMembers.map((m) => m.id));
        const others = (workspaceMembersData as unknown as ChannelMemberResponse[])
          .map((m) => m.profiles)
          .filter((p) => !memberIds.has(p.id));

      setNonMembers(others);
      } catch (error: unknown) {
        console.error("Error fetching data:", error);
        const errorMessage = (error as { message?: string })?.message || "Unknown error";
        toast.error("Failed to load members: " + errorMessage);
      } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channelId, workspaceId]);

  const addMember = async (userId: string) => {
    setAddingMember(userId);
    try {
      const { error } = await supabase.from("channel_members").insert({
        channel_id: channelId,
        user_id: userId,
      });

      if (error) throw error;

      toast.success("Member added to channel");
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to add member: " + errorMessage);
    } finally {
      setAddingMember(null);
    }
  };

  const removeMember = async (userId: string) => {
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("channel_members")
        .delete()
        .eq("channel_id", channelId)
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Member removed from channel");
      setRemovingMember(null);
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error("Failed to remove member: " + errorMessage);
    } finally {
      setIsRemoving(false);
    }
  };

  const filteredMembers = members.filter((m) =>
    (m.full_name || m.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredNonMembers = nonMembers.filter((m) =>
    (m.full_name || m.username || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] h-[600px] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            #{channelName} Members
          </DialogTitle>
          <DialogDescription>
            Manage who has access to this channel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <Tabs defaultValue="members" className="flex-1 flex flex-col min-h-0">
            <div className="px-6 border-b border-zinc-200 dark:border-zinc-800">
              <TabsList className="w-full justify-start h-10 bg-transparent p-0 gap-6">
                <TabsTrigger
                  value="members"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 dark:data-[state=active]:border-white rounded-none h-full px-0"
                >
                  Members ({members.length})
                </TabsTrigger>
                <TabsTrigger
                  value="add"
                  className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-zinc-900 dark:data-[state=active]:border-white rounded-none h-full px-0"
                >
                  Add Members
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 border-b border-zinc-100 dark:border-zinc-900">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  placeholder="Search people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-zinc-50 dark:bg-zinc-900 border-none h-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              <TabsContent value="members" className="mt-0 space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="text-center p-8 text-sm text-zinc-500">
                    No members found.
                  </div>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback>
                          {(member.full_name || member.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">
                              {member.full_name || member.username}
                            </p>
                            {member.id === channelCreator && (
                              <Shield className="h-3 w-3 text-zinc-400" />
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 truncate">
                            @{member.username} {member.id === user?.id && "(You)"}
                          </p>
                        </div>
                        {member.id !== user?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            onClick={() => setRemovingMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>


              <TabsContent value="add" className="mt-0 space-y-1">
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                ) : filteredNonMembers.length === 0 ? (
                  <div className="text-center p-8 text-sm text-zinc-500">
                    {searchQuery ? "No matching workspace members found." : "Everyone in the workspace is already in this channel."}
                  </div>
                ) : (
                  filteredNonMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback>
                          {(member.full_name || member.username || "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.full_name || member.username}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          @{member.username}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => addMember(member.id)}
                        disabled={addingMember === member.id}
                      >
                        {addingMember === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>

      <AlertDialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member from channel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {removingMember?.full_name || removingMember?.username} from #{channelName}. They will lose access to all messages and files in this channel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRemoving}
              onClick={(e) => {
                e.preventDefault();
                if (removingMember) removeMember(removingMember.id);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isRemoving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
