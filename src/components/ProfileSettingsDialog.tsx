"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, User, ImageIcon, Award, Check } from "lucide-react";

const BADGE_OPTIONS = [
  "Founder",
  "Admin",
  "Product",
  "Engineering",
  "Design",
  "Marketing",
  "Intern"
];
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ANIMAL_AVATARS = [
  "Lion", "Tiger", "Bear", "Wolf", "Fox", 
  "Deer", "Eagle", "Owl", "Shark", "Dolphin",
  "Panda", "Koala", "Rabbit", "Cat", "Dog",
  "Elephant", "Giraffe", "Zebra", "Monkey", "Penguin"
].map(animal => `https://api.dicebear.com/9.x/big-ears-neutral/svg?seed=${animal}`);

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettingsDialog({ open, onOpenChange }: ProfileSettingsDialogProps) {
  const { profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || "");
  const [badge, setBadge] = useState(profile?.badge || "");

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: avatarUrl,
        badge: badge,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Profile updated successfully!");
      await refreshProfile();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Profile Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-zinc-200 dark:border-zinc-800">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">
                {fullName?.[0] || profile?.id?.[0]}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm text-zinc-500">Your profile picture</p>
          </div>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 opacity-70" /> Quick Select Avatar
                </Label>
                <ScrollArea className="h-32 w-full rounded-md border border-zinc-200 dark:border-zinc-800 p-2">
                  <div className="grid grid-cols-5 gap-2">
                    {ANIMAL_AVATARS.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setAvatarUrl(url)}
                        className={cn(
                          "relative group aspect-square rounded-lg border-2 transition-all hover:scale-105",
                          avatarUrl === url 
                            ? "border-zinc-900 dark:border-white ring-2 ring-zinc-900/10 dark:ring-white/10" 
                            : "border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
                        )}
                      >
                        <img 
                          src={url} 
                          alt="Avatar option" 
                          className="h-full w-full object-cover rounded-md"
                        />
                        {avatarUrl === url && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/20 dark:bg-white/20 rounded-md">
                            <Check className="h-4 w-4 text-white dark:text-zinc-900" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="avatar" className="flex items-center gap-2 text-[10px] text-zinc-500">
                  Or use a custom URL
                </Label>
                <Input
                  id="avatar"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4 opacity-70" /> Full Name
                </Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="badge" className="flex items-center gap-2">
                  <Award className="h-4 w-4 opacity-70" /> Badge
                </Label>
                <Select value={badge} onValueChange={setBadge}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a badge" />
                  </SelectTrigger>
                  <SelectContent>
                    {BADGE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-zinc-500">This badge will appear next to your name</p>
              </div>


          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
