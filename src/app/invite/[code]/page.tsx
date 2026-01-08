"use client";

import { useEffect, useState, use } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Users, XCircle } from "lucide-react";
import Link from "next/link";

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [invitation, setInvitation] = useState<{ id: string; role?: string; workspaces?: { id: string; name: string; slug: string } } | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchInvitation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      const { data: invite, error: inviteError } = await supabase
        .from("workspace_invitations")
        .select("*, workspaces(*)")
        .eq("invite_code", code)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        setError("This invite link is invalid or has expired.");
        setLoading(false);
        return;
      }

      setInvitation(invite);
      setWorkspace(invite.workspaces);
      setLoading(false);
    };

    fetchInvitation();
  }, [code]);

    const handleJoin = async () => {
    if (!user || !workspace || !invitation) {
      router.push(`/?redirect=/invite/${code}`);
      return;
    }

    setJoining(true);

    const { data: existingMember } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      toast.info("You are already a member of this workspace!");
      router.push(`/workspaces/${workspace.id}`);
      return;
    }

    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: invitation.role || "member",
      });

    if (memberError) {
      toast.error("Failed to join workspace");
      setJoining(false);
      return;
    }

    await supabase
      .from("workspace_invitations")
      .update({ used_at: new Date().toISOString() })
      .eq("id", invitation.id);

    toast.success(`Welcome to ${workspace.name}!`);
    router.push(`/workspaces/${workspace.id}`);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/">
              <Button variant="outline">Go Home</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-2xl font-bold text-primary">
            {workspace?.name?.[0]?.toUpperCase()}
          </div>
          <CardTitle className="text-2xl">Join {workspace?.name}</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join this workspace
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg">
            <Users className="h-5 w-5 text-zinc-500" />
            <div>
              <p className="font-medium">{workspace?.name}</p>
              <p className="text-sm text-zinc-500">workspace.com/{workspace?.slug}</p>
            </div>
          </div>
          {user ? (
            <p className="text-sm text-zinc-500 text-center">
              Joining as <span className="font-medium">{user.email}</span>
            </p>
          ) : (
            <p className="text-sm text-zinc-500 text-center">
                You&apos;ll need to sign in or create an account to join
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button onClick={handleJoin} disabled={joining} className="w-full">
            {joining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Joining...
              </>
            ) : user ? (
              "Accept Invitation"
            ) : (
              "Sign in to Join"
            )}
          </Button>
          <Link href="/" className="w-full">
            <Button variant="ghost" className="w-full">
              Decline
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
