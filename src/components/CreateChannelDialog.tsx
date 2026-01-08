"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Hash, Lock } from "lucide-react";

interface CreateChannelDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelCreated?: (channel: { id: string; name: string }) => void;
}

export function CreateChannelDialog({
  workspaceId,
  open,
  onOpenChange,
  onChannelCreated,
}: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    
    const channelName = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    
    const { data, error } = await supabase
      .from("channels")
      .insert({
        workspace_id: workspaceId,
        name: channelName,
        description: description.trim() || null,
        is_private: isPrivate,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("channel_members").insert({
        channel_id: data.id,
        user_id: user?.id,
      });
      
      toast.success(`Channel #${channelName} created!`);
      onChannelCreated?.(data);
      onOpenChange(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isPrivate ? <Lock className="h-5 w-5" /> : <Hash className="h-5 w-5" />}
              Create a channel
            </DialogTitle>
            <DialogDescription>
                Channels are where your team communicates. They&apos;re best organized around a topic.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">#</span>
                <Input
                  id="name"
                  placeholder="e.g. marketing"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-7"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What's this channel about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private">Make private</Label>
                <p className="text-xs text-zinc-500">
                  Only invited members can see this channel
                </p>
              </div>
              <Switch
                id="private"
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
