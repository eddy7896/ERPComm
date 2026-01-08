"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Mail, Link2, Check } from "lucide-react";

interface InviteDialogProps {
  workspaceId: string;
  workspaceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({
  workspaceId,
  workspaceName,
  open,
  onOpenChange,
}: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [inviteLink, setInviteLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      generateInviteLink();
    }
  }, [open, workspaceId]);

  const generateInviteLink = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const inviteCode = crypto.randomUUID().slice(0, 8);
    
    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: workspaceId,
      invite_code: inviteCode,
      role: "member",
      created_by: user?.id,
    });

    if (!error) {
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/invite/${inviteCode}`);
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const inviteCode = crypto.randomUUID().slice(0, 8);
    
    const { error } = await supabase.from("workspace_invitations").insert({
      workspace_id: workspaceId,
      email: email.trim().toLowerCase(),
      invite_code: inviteCode,
      role,
      created_by: user?.id,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite people to {workspaceName}</DialogTitle>
          <DialogDescription>
            Add team members via email or share an invite link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Invite link
            </Label>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="bg-zinc-50 dark:bg-zinc-900" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Anyone with this link can join your workspace. Link expires in 7 days.
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-500">Or invite by email</span>
            </div>
          </div>

          <form onSubmit={handleSendInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !email.trim()} className="w-full">
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
