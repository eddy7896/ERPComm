"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Smile, X, Check, Coffee, Laptop, Home, Plane, Clock } from "lucide-react";
import { toast } from "sonner";

interface StatusPickerProps {
  currentStatus?: string;
  currentEmoji?: string;
  onStatusUpdate: (status: string, emoji: string) => void;
}

const PRESET_STATUSES = [
  { text: "In a meeting", emoji: "📅", icon: Clock },
  { text: "Commuting", emoji: "🚆", icon: Plane },
  { text: "Out sick", emoji: "🤒", icon: Home },
  { text: "Vacationing", emoji: "🌴", icon: Plane },
  { text: "Working remotely", emoji: "🏠", icon: Home },
  { text: "Focusing", emoji: "💻", icon: Laptop },
  { text: "Taking a break", emoji: "☕", icon: Coffee },
];

export function StatusPicker({ currentStatus = "", currentEmoji = "", onStatusUpdate }: StatusPickerProps) {
  const [statusText, setStatusText] = useState(currentStatus);
  const [statusEmoji, setStatusEmoji] = useState(currentEmoji);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .update({ 
          status_text: statusText, 
          status_emoji: statusEmoji 
        })
        .eq("id", user.id);

      if (error) throw error;

      onStatusUpdate(statusText, statusEmoji);
      setOpen(false);
      toast.success("Status updated");
      } catch (error: unknown) {
        console.error("Error updating status:", error);
        const errorMessage = (error as { message?: string })?.message || "";
        toast.error("Failed to update status: " + errorMessage);
      } finally {
      setLoading(false);
    }
  };

  const clearStatus = async () => {
    setStatusText("");
    setStatusEmoji("");
    // We'll save it when they click the check or just clear it immediately?
    // Let's just set the local state and let them save.
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-1 py-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-xs text-zinc-500 transition-colors">
          {currentEmoji ? (
            <span className="text-sm">{currentEmoji}</span>
          ) : (
            <Smile className="h-3 w-3" />
          )}
          <span className="truncate max-w-[100px]">
            {currentStatus || "Set status"}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">
                {statusEmoji || "💬"}
              </span>
              <Input
                placeholder="What's your status?"
                value={statusText}
                onChange={(e) => setStatusText(e.target.value)}
                className="pl-10 h-10"
              />
              {statusText && (
                <button 
                  onClick={clearStatus}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button size="icon" className="h-10 w-10 shrink-0" onClick={handleSave} disabled={loading}>
              <Check className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 mb-2">Suggestions</p>
            <div className="grid grid-cols-1 gap-0.5">
              {PRESET_STATUSES.map((preset) => (
                <button
                  key={preset.text}
                  onClick={() => {
                    setStatusText(preset.text);
                    setStatusEmoji(preset.emoji);
                  }}
                  className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-sm text-left transition-colors"
                >
                  <span className="text-lg">{preset.emoji}</span>
                  <span className="flex-1 text-zinc-700 dark:text-zinc-300">{preset.text}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
