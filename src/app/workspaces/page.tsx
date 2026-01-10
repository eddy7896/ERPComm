"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Layout, ArrowRight, Loader2, LogOut } from "lucide-react";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  email: string;
}

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchWorkspaces = async () => {
      if (authLoading) return;
      
      if (!user) {
        router.push("/");
        return;
      }

      const { data, error } = await supabase
        .from("workspace_members")
        .select("workspaces(*)")
        .eq("user_id", user.id);

      if (error) {
        toast.error("Failed to load workspaces");
      } else {
        const userWorkspaces = data.map((item: { workspaces: Workspace }) => item.workspaces);
        setWorkspaces(userWorkspaces);
        
        // Auto-redirect if user is only in one workspace
        if (userWorkspaces.length === 1) {
          router.push(`/workspaces/${userWorkspaces[0].id}`);
          return;
        }
      }
      setLoading(false);
    };

    fetchWorkspaces();
  }, [router, user, authLoading]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to logout");
    } else {
      router.push("/");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setCreating(true);

    const slug = newWorkspaceName.toLowerCase().replace(/\s+/g, "-");

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .insert({
        name: newWorkspaceName,
        slug,
        owner_id: user?.id,
      })
      .select()
      .single();

    if (wsError) {
      toast.error(wsError.message);
      setCreating(false);
      return;
    }

    // Add owner as a member
    const { error: memberError } = await supabase
      .from("workspace_members")
      .insert({
        workspace_id: workspace.id,
        user_id: user?.id,
        role: "OWNER",
      });

    if (memberError) {
      toast.error("Failed to add member");
    } else {
      // Create a default #general channel
      await supabase.from("channels").insert({
        workspace_id: workspace.id,
        name: "general",
        created_by: user?.id,
      });

      toast.success("Workspace created!");
      router.push(`/workspaces/${workspace.id}`);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-12 px-6">
      <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Your Workspaces</h1>
              <p className="text-zinc-600 dark:text-zinc-400">Select a workspace to start communicating</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
              {workspaces.length === 0 && (
                <Button onClick={() => setCreating(true)} disabled={creating}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Workspace
                </Button>
              )}
            </div>
          </div>

        {creating && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Card>
              <form onSubmit={handleCreateWorkspace}>
                <CardHeader>
                  <CardTitle>Create Workspace</CardTitle>
                  <CardDescription>Give your workspace a name</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="wsName">Workspace Name</Label>
                    <Input 
                      id="wsName" 
                      placeholder="Acme Corp" 
                      value={newWorkspaceName}
                      onChange={(e) => setNewWorkspaceName(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setCreating(false)} type="button">Cancel</Button>
                  <Button type="submit" disabled={creating}>Create</Button>
                </CardFooter>
              </form>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => (
            <Card key={ws.id} className="group hover:border-primary transition-colors cursor-pointer" onClick={() => router.push(`/workspaces/${ws.id}`)}>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl font-bold text-primary group-hover:bg-primary/10 transition-colors">
                  {ws.name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">{ws.name}</CardTitle>
                  <CardDescription>workspace.com/{ws.slug}</CardDescription>
                </div>
                <ArrowRight className="h-5 w-5 text-zinc-300 group-hover:text-primary transition-colors" />
              </CardHeader>
            </Card>
          ))}
          {workspaces.length === 0 && !creating && (
            <div className="col-span-full py-12 text-center bg-white dark:bg-zinc-900 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
              <Layout className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="text-lg font-medium">No workspaces found</h3>
              <p className="text-zinc-500 mb-6">Create your first workspace to get started</p>
              <Button onClick={() => setCreating(true)}>Create Workspace</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
