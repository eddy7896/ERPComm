
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rysxvlpvrqhxoqjnigoo.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDYzOSwiZXhwIjoyMDgzNDc2NjM5fQ.E5ye9ykNC1MHk6m_T_2IGdigtP3KvyECeFU55U7Yxz0'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

const workspaces = [
  { id: 'd0001f45-1480-4234-b5bc-f9cddc8984d5', generalChannelId: 'cba19036-823a-4e6b-a734-d9cb2194e321' }, // Enterprise
  { id: 'a1111111-1111-1111-1111-111111111111', generalChannelId: '75a43bea-444d-454d-882c-8fd70c411d76' }, // Nexus
  { id: 'b2222222-2222-2222-2222-222222222222', generalChannelId: '4e43444a-0c6e-4bcf-9985-67eb6f7e1d22' }, // Design
  { id: 'c3333333-3333-3333-3333-333333333333', generalChannelId: '9d0886a1-39c8-4fb8-a7c9-dea0785d91d2' }, // Tech
  { id: 'd4444444-4444-4444-4444-444444444444', generalChannelId: '2c2437ef-7542-4e47-be8f-cf10b4d0fdb9' }  // Marketing
]

async function setup() {
  console.log('Cleaning up existing demo users...')
  
  // Get all users from Auth API
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const toDelete = users.filter(u => u.email?.endsWith('@enterprise.com'))
  
  for (const user of toDelete) {
    console.log(`Deleting ${user.email}...`)
    await supabase.auth.admin.deleteUser(user.id)
  }

  // Also cleanup via SQL just in case there are orphans without instance_id
  await supabase.rpc('delete_demo_users_sql', {}) // We'll create this function or just use direct SQL if possible
  // Since I can't easily create RPCs here, I'll just use the SQL tool after this script if needed.
  // Actually, I can use the SQL tool now to clear the table.

  console.log('Creating 25 new demo users...')
  for (let i = 1; i <= 25; i++) {
    const email = `user${i}@enterprise.com`
    const workspaceIndex = Math.floor((i - 1) / 5)
    const workspace = workspaces[workspaceIndex]

    console.log(`Creating ${email} for workspace ${workspace.id}...`)
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: 'password123',
      email_confirm: true,
      user_metadata: { full_name: `Demo User ${i}` }
    })

    if (createError) {
      console.error(`Error creating ${email}:`, createError)
      continue
    }

    if (user) {
      // Add to workspace_members
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'member'
        })
      
      if (memberError) console.error(`Error adding ${email} to workspace:`, memberError)

      // Add to general channel
      const { error: channelError } = await supabase
        .from('channel_members')
        .insert({
          channel_id: workspace.generalChannelId,
          user_id: user.id
        })
      
      if (channelError) console.error(`Error adding ${email} to channel:`, channelError)
    }
  }

  console.log('Setup complete!')
}

setup()
