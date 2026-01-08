"use client";

import * as React from "react";
import { AtSign } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";

interface Mention {
  id: string;
  content: string;
  created_at: string;
  sender: {
    username: string;
    full_name: string;
  };
}

export function MentionsPopover({ workspaceId }: { workspaceId: string }) {
  const [mentions, setMentions] = React.useState<Mention[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { user } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    if (user) {
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => setProfile(data));
    }
  }, [user]);

  const fetchMentions = async () => {
    if (!profile?.username) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        sender:sender_id (
          username,
          full_name
        )
      `)
      .eq("workspace_id", workspaceId)
      .ilike("content", `%@${profile.username}%`)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setMentions(data as any);
    }
    setLoading(false);
  };

  return (
    <Popover onOpenChange={(open) => open && fetchMentions()}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 hidden xs:flex">
          <AtSign className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Mentions & Reactions</h4>
        </div>
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-xs text-zinc-500">Loading mentions...</div>
          ) : mentions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <div className="bg-zinc-100 dark:bg-zinc-800 h-10 w-10 rounded-full flex items-center justify-center mx-auto">
                <AtSign className="h-5 w-5 text-zinc-400" />
              </div>
              <p className="text-xs text-zinc-500 font-medium">No mentions yet</p>
              <p className="text-[10px] text-zinc-400">When someone mentions you with @{profile?.username || 'username'}, it will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {mentions.map((mention) => (
                <div
                  key={mention.id}
                  className="flex gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer border-b last:border-0"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px]">
                      {mention.sender.full_name?.split(" ").map(n => n[0]).join("") || mention.sender.username[0]}
                    </AvatarFallback>
                  </Avatar>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs">{mention.sender.full_name || mention.sender.username}</span>
                        {mention.sender.username && (
                          <span className="text-[10px] text-zinc-500 font-medium">@{mention.sender.username}</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 line-clamp-2">
                        {mention.content}
                      </p>
                    <p className="text-[10px] text-zinc-400">
                      {new Date(mention.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
