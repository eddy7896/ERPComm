
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupWorkspace() {
  console.log("Setting up Enterprise Workspace...");

  // 1. Get user IDs
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;

  const adminUser = users.users.find(u => u.email === "admin@enterprise.com");
  if (!adminUser) throw new Error("Admin user not found");

  // 2. Create Workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .insert({
      name: 'Enterprise Workspace',
      slug: 'enterprise',
      owner_id: adminUser.id
    })
    .select()
    .single();

  if (workspaceError) {
    if (workspaceError.code === '23505') { // already exists
      console.log("Workspace already exists");
      return;
    }
    throw workspaceError;
  }

  console.log("Workspace created:", workspace.id);

  // 3. Add all users to workspace
  const members = users.users.map(user => ({
    workspace_id: workspace.id,
    user_id: user.id,
    role: user.email === 'admin@enterprise.com' ? 'admin' : 'member'
  }));

  const { error: membersError } = await supabase
    .from('workspace_members')
    .insert(members);

  if (membersError) throw membersError;
  console.log("Members added to workspace");

  // 4. Create general channel
  const { data: channel, error: channelError } = await supabase
    .from('channels')
    .insert({
      workspace_id: workspace.id,
      name: 'general',
      description: 'General discussion for everyone',
      is_private: false
    })
    .select()
    .single();

  if (channelError) throw channelError;
  console.log("General channel created:", channel.id);

  console.log("Setup complete!");
}

setupWorkspace().catch(console.error);
