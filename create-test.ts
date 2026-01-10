
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rysxvlpvrqhxoqjnigoo.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDYzOSwiZXhwIjoyMDgzNDc2NjM5fQ.E5ye9ykNC1MHk6m_T_2IGdigtP3KvyECeFU55U7Yxz0'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function createTestUser() {
  console.log('Creating test user...')
  const { data, error } = await supabase.auth.admin.createUser({
    email: 'test-auth-api@enterprise.com',
    password: 'password123',
    email_confirm: true
  })
  
  if (error) {
    console.error('Error creating user:', error)
  } else {
    console.log('User created:', data.user.id)
  }
}

createTestUser()
