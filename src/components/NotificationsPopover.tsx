"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Bell, AtSign, MessageSquare, Heart, Check, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  workspace_id: string;
  channel_id: string | null;
  message_id: string;
  type: 'mention' | 'reply' | 'reaction';
  content: string;
  is_read: boolean;
  created_at: string;
  actor: {
    username: string;
    full_name?: string;
    avatar_url?: string;
  };
}

interface NotificationsPopoverProps {
  workspaceId: string;
  onNotificationClick?: (notification: Notification) => void;
}

export function NotificationsPopover({ workspaceId, onNotificationClick }: NotificationsPopoverProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!actor_id(username, full_name, avatar_url)
      `)
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setNotifications(data as any);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    const sub = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [user, workspaceId]);

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (!notifications.find(n => n.id === id)?.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'mention': return <AtSign className="h-3 w-3 text-blue-500" />;
      case 'reply': return <MessageSquare className="h-3 w-3 text-emerald-500" />;
      case 'reaction': return <Heart className="h-3 w-3 text-rose-500" />;
      default: return <Bell className="h-3 w-3 text-zinc-500" />;
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-zinc-950">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="font-bold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-wider" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <Bell className="h-6 w-6 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No notifications yet</p>
                <p className="text-xs text-zinc-500 mt-1">When someone mentions you, you&apos;ll see it here.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {notifications.map((n) => (
                  <div 
                    key={n.id} 
                    className={cn(
                      "relative group flex gap-3 p-4 transition-colors",
                      n.is_read ? "bg-transparent" : "bg-primary/5 dark:bg-primary/10"
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={n.actor.avatar_url} />
                        <AvatarFallback>{n.actor.username[0].toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center shadow-sm border border-zinc-100 dark:border-zinc-800">
                        {getIcon(n.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-tight">
                        <span className="font-bold">@{n.actor.username}</span>
                        {n.type === 'mention' && " mentioned you"}
                        {n.type === 'reply' && " replied to you"}
                        {n.type === 'reaction' && " reacted to your message"}
                      </p>
                      {n.content && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 italic">
                          &quot;{n.content}&quot;
                        </p>
                      )}
                    <p className="text-[10px] text-zinc-400 mt-2">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.is_read && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => markAsRead(n.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteNotification(n.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNotificationClick?.(n)}>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
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
