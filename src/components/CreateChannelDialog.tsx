"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { generateChannelKey, wrapChannelKey, importPublicKey } from "@/lib/crypto";
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
import { Hash, Lock, ShieldCheck } from "lucide-react";

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
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
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
        encryption_enabled: encryptionEnabled,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else {
      let encryptedKey = null;
      if (encryptionEnabled && profile?.public_key) {
        try {
          const channelKey = await generateChannelKey();
          const publicKey = await importPublicKey(profile.public_key);
          encryptedKey = await wrapChannelKey(channelKey, publicKey);
        } catch (err) {
          console.error("Failed to generate/wrap channel key:", err);
          toast.error("Failed to setup encryption for this channel.");
        }
      }

      await supabase.from("channel_members").insert({
        channel_id: data.id,
        user_id: user?.id,
        encrypted_key: encryptedKey,
      });
      
      toast.success(`Channel #${channelName} created!`);
      onChannelCreated?.(data);
      onOpenChange(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
      setEncryptionEnabled(true);
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
              <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <Label htmlFor="encryption" className="text-emerald-900 dark:text-emerald-100">End-to-End Encryption</Label>
                  </div>
                  <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                    Messages are encrypted locally. Only members can decrypt.
                  </p>
                </div>
                <Switch
                  id="encryption"
                  checked={encryptionEnabled}
                  onCheckedChange={setEncryptionEnabled}
                  className="data-[state=checked]:bg-emerald-600"
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
