"use client";

import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MOCK_NOTIFICATIONS = [
  {
    id: "1",
    user: "Sarah Chen",
    action: "mentioned you in",
    target: "#design-team",
    time: "2m ago",
    content: "@me could you take a look at the latest mockups?",
    unread: true,
  },
  {
    id: "2",
    user: "Alex Rivera",
    action: "sent a message in",
    target: "Direct Message",
    time: "15m ago",
    content: "The API documentation has been updated.",
    unread: true,
  },
  {
    id: "3",
    user: "Jordan Lee",
    action: "added a reaction to your message",
    target: "#general",
    time: "1h ago",
    content: "👍",
    unread: false,
  },
];

export function NotificationsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          <Button variant="ghost" size="sm" className="text-[10px] h-7">
            Mark all as read
          </Button>
        </div>
        <ScrollArea className="h-[300px]">
          <div className="flex flex-col">
            {MOCK_NOTIFICATIONS.map((notif) => (
              <div
                key={notif.id}
                className={`flex gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer border-b last:border-0 ${
                  notif.unread ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                }`}
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-[10px]">
                    {notif.user.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <p className="text-xs">
                    <span className="font-bold">{notif.user}</span>{" "}
                    <span className="text-zinc-500">{notif.action}</span>{" "}
                    <span className="font-medium">{notif.target}</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1 italic">
                    "{notif.content}"
                  </p>
                  <p className="text-[10px] text-zinc-400">{notif.time}</p>
                </div>
                {notif.unread && (
                  <div className="h-2 w-2 mt-1.5 bg-blue-500 rounded-full shrink-0" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" className="w-full text-xs h-8 text-zinc-500">
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
