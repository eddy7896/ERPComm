
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const DEMO_ACCOUNTS = [
  { email: "admin@enterprise.com", password: "password123", full_name: "Admin User", username: "admin" },
  { email: "product@enterprise.com", password: "password123", full_name: "Product Manager", username: "product" },
  { email: "engineering@enterprise.com", password: "password123", full_name: "Lead Engineer", username: "engineering" },
  { email: "design@enterprise.com", password: "password123", full_name: "Senior Designer", username: "design" },
  { email: "marketing@enterprise.com", password: "password123", full_name: "Marketing Lead", username: "marketing" },
];

async function seed() {
  console.log("Seeding demo users...");

  for (const account of DEMO_ACCOUNTS) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.full_name,
        username: account.username
      }
    });

    if (error) {
      if (error.message.includes("already registered")) {
        console.log(`User ${account.email} already exists.`);
      } else {
        console.error(`Error creating user ${account.email}:`, error.message);
      }
    } else {
      console.log(`Created user ${account.email}`);
    }
  }

  console.log("Seeding complete!");
}

seed();
