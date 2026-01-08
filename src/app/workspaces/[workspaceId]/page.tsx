"use client";

import { useEffect, useState, use } from "react";
import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Hash, Lock, Info, Search, Bell, Star, AtSign, Menu, Users, X, Calendar, MapPin, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChannelMembersDialog } from "@/components/ChannelMembersDialog";
import { SearchDialog } from "@/components/SearchDialog";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { MentionsPopover } from "@/components/MentionsPopover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { typingUsers, handleTyping, stopTyping } = useTypingIndicator(
    workspaceId,
    selectedChannelId || undefined,
    selectedRecipientId || undefined
  );

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push("/");
      return;
    }
    setLoading(false);
  }, [router, user, authLoading]);

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
      <div className="hidden md:flex">
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
      </div>

      <main className="flex flex-1 flex-col min-w-0 h-full">
        <header className="flex h-14 items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72">
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
                </SheetContent>
              </Sheet>
            </div>
            
            <div className="flex items-center gap-2 overflow-hidden">
              {channelDetails ? (
                <>
                  {channelDetails.is_private ? (
                    <Lock className="h-5 w-5 text-zinc-500 shrink-0" />
                  ) : (
                    <Hash className="h-5 w-5 text-zinc-500 shrink-0" />
                  )}
                  <h2 className="font-bold text-lg truncate">{channelDetails.name}</h2>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 ml-1"
                    onClick={() => setMembersDialogOpen(true)}
                  >
                    <Users className="h-4 w-4 text-zinc-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    <Star className="h-4 w-4 text-zinc-400" />
                  </Button>
                  {channelDetails.description && (
                    <span className="text-sm text-zinc-500 hidden lg:inline truncate">
                      | {channelDetails.description}
                    </span>
                  )}
                </>
              ) : recipientDetails ? (
                <>
                  <h2 className="font-bold text-lg truncate">{recipientDetails.full_name || recipientDetails.username}</h2>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${recipientDetails.status === 'online' ? 'bg-green-500' : 'bg-zinc-400'}`} />
                </>
              ) : (
                <div className="h-6 w-32 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded" />
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            <div 
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <Search className="h-3 w-3 mr-2" />
              <span>Search...</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 sm:hidden"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
            
            <NotificationsPopover />
            <MentionsPopover workspaceId={workspaceId} />
            
            <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />
            
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-80 sm:w-96 p-0 overflow-hidden flex flex-col">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-lg font-bold">
                    {channelDetails ? "Channel Details" : "User Profile"}
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-1">
                  {channelDetails ? (
                    <div className="p-6 space-y-6">
                      <div className="space-y-2 text-center">
                        <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto text-3xl font-bold text-zinc-400">
                          {channelDetails.name[0].toUpperCase()}
                        </div>
                        <h3 className="text-xl font-bold">{channelDetails.name}</h3>
                        <p className="text-sm text-zinc-500">{channelDetails.description || "No description set"}</p>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Channel Info</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <Lock className="h-4 w-4 text-zinc-400" />
                            <span>{channelDetails.is_private ? "Private Channel" : "Public Channel"}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Calendar className="h-4 w-4 text-zinc-400" />
                            <span>Created August 2024</span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" className="w-full text-xs h-9">Edit Channel</Button>
                        <Button variant="outline" className="w-full text-xs h-9 text-red-500 hover:text-red-600">Archive</Button>
                      </div>
                    </div>
                  ) : recipientDetails ? (
                    <div className="p-6 space-y-6">
                      <div className="space-y-2 text-center">
                        <Avatar className="h-24 w-24 mx-auto rounded-2xl">
                          <AvatarFallback className="text-3xl rounded-2xl">
                            {recipientDetails.full_name?.split(" ").map(n => n[0]).join("") || recipientDetails.username?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-bold pt-2">{recipientDetails.full_name || recipientDetails.username}</h3>
                        <p className="text-sm text-zinc-500">@{recipientDetails.username}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <div className={`h-2 w-2 rounded-full ${recipientDetails.status === 'online' ? 'bg-green-500' : 'bg-zinc-400'}`} />
                          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                            {recipientDetails.status || 'offline'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button className="flex-1 bg-zinc-900 dark:bg-white dark:text-zinc-900">Message</Button>
                        <Button variant="outline" size="icon"><Users className="h-4 w-4" /></Button>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Contact Information</h4>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 text-sm">
                            <MapPin className="h-4 w-4 text-zinc-400" />
                            <span>San Francisco, CA</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Link2 className="h-4 w-4 text-zinc-400" />
                            <span className="text-blue-500">github.com/profile</span>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent Media</h4>
                        <div className="grid grid-cols-3 gap-2">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-md" />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>

          <SearchDialog 
            workspaceId={workspaceId} 
            open={searchOpen} 
            onOpenChange={setSearchOpen} 
          />
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

        {channelDetails && (
          <ChannelMembersDialog
            channelId={channelDetails.id}
            workspaceId={workspaceId}
            channelName={channelDetails.name}
            open={membersDialogOpen}
            onOpenChange={setMembersDialogOpen}
          />
        )}
      </main>
    </div>
  );
}
