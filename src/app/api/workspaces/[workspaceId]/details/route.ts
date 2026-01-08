import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { getCachedData } from '@/lib/cache';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const cacheKey = `workspace:${workspaceId}:user:${userId}:details`;

  try {
    const data = await getCachedData(
      cacheKey,
      async () => {
        // Fetch workspace details
        const { data: workspace } = await supabaseServer
          .from("workspaces")
          .select("*")
          .eq("id", workspaceId)
          .single();

        // Fetch all channels in workspace
        const { data: allChannels } = await supabaseServer
          .from("channels")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("name");

        // Fetch user's channel memberships
        const { data: memberships } = await supabaseServer
          .from("channel_members")
          .select("channel_id")
          .eq("user_id", userId);

        const memberChannelIds = new Set(memberships?.map(m => m.channel_id) || []);
        
        // Filter channels: public OR user is a member
        const channels = allChannels?.filter(c => !c.is_private || memberChannelIds.has(c.id)) || [];

        // Fetch members
        const { data: members } = await supabaseServer
          .from("workspace_members")
          .select("profiles(*)")
          .eq("workspace_id", workspaceId);

        // Fetch unread counts
        const { data: unreadCounts } = await supabaseServer.rpc("get_unread_counts", {
          p_workspace_id: workspaceId,
          p_user_id: userId
        });

        return {
          workspace,
          channels: channels || [],
          members: members?.map((m: any) => m.profiles).filter((p: any) => p && p.id !== userId) || [],
          unreadCounts: unreadCounts || []
        };
      },
      60 // Cache for 1 minute for demonstration (higher in production)
    );

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
