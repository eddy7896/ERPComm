
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://rysxvlpvrqhxoqjnigoo.supabase.co'
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5c3h2bHB2cnFoeG9xam5pZ29vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzkwMDYzOSwiZXhwIjoyMDgzNDc2NjM5fQ.E5ye9ykNC1MHk6m_T_2IGdigtP3KvyECeFU55U7Yxz0'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function testUpdate() {
  const userId = 'ac350ed5-31ee-402b-9607-adb5af8aeec8' // user1@enterprise.com
  console.log(`Updating user ${userId}...`)
  const { data, error } = await supabase.auth.admin.updateUserById(
    userId,
    { password: 'password123' }
  )
  
  if (error) {
    console.error('Error updating:', error)
  } else {
    console.log('User updated successfully')
  }
}

testUpdate()
