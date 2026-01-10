
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rysxvlpvrqhxoqjnigoo.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDYzOSwiZXhwIjoyMDgzNDc2NjM5fQ.E5ye9ykNC1MHk6m_T_2IGdigtP3KvyECeFU55U7Yxz0'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixUsers() {
  console.log('Fetching users...')
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  
  if (listError) {
    console.error('Error listing users:', listError)
    return
  }

  const demoUsers = users.filter(u => u.email?.endsWith('@enterprise.com'))
  console.log(`Found ${demoUsers.length} demo users. Resetting passwords...`)

  for (const user of demoUsers) {
    console.log(`Updating password for ${user.email}...`)
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: 'password123' }
    )
    if (updateError) {
      console.error(`Error updating ${user.email}:`, updateError)
    }
  }

  console.log('Finished resetting passwords.')
}

fixUsers()
