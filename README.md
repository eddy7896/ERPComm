# EnterpriseChat

Connect your team in one secure, high-performance platform. The all-in-one workspace for enterprise collaboration, real-time messaging, and efficient project management.

## 🚀 Key Features

- **Real-time Messaging**: Instant communication with support for multiple channels and direct messaging.
- **Workspace Management**: Organize your team into workspaces with dedicated channels and roles.
- **Enterprise Security**: Role-based access control (RBAC), SSO-ready architecture, and global compliance standards.
- **Modern UI/UX**: Built with a focus on speed, accessibility, and a delightful user experience using Tailwind CSS and Framer Motion. Includes features like password visibility toggles for improved security.
- **Optimized Caching**: High-performance data retrieval with Redis-backed caching.
- **Robust Backend**: Powered by Supabase for real-time database capabilities and secure authentication.

## 🧪 Demo Access

To explore the platform without creating an account, use the following pre-configured demo credentials. These users are distributed across 5 different workspaces (Enterprise Workspace, Nexus Solutions, Design Studio, Tech Frontier, and Marketing Pulse).

### Recommended Account
- **Email**: `user1@enterprise.com`
- **Password**: `password123`

### Bulk Accounts
You can use any of the 25 pre-configured users to test real-time collaboration:
- **Range**: `user1@enterprise.com` through `user25@enterprise.com`
- **Password**: `password123` (all accounts use the same password)

### Workspace Roles
- **Admins**: `user1`, `user6`, `user11`, `user16`, `user21` (Owners of their respective workspaces)
- **Members**: All other users are members with standard permissions.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React, Tailwind CSS, Lucide Icons, Framer Motion
- **Backend/Auth**: Supabase (PostgreSQL, Auth, Realtime)
- **Caching**: Redis
- **Deployment**: Docker, Nginx, Let's Encrypt

## 🏁 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Supabase account and project
- A Redis instance (included in Docker setup)

### Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd enterprise-chat
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure environment variables**:
   Create a `.env.local` file with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_postgresql_connection_string
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   # or
   bun dev
   ```

Open [http://localhost:3000](http://localhost:3000) to see the application in action.

## 📦 Deployment

For detailed instructions on deploying to a VPS using Docker and Nginx, please refer to the [DEPLOYMENT.md](./DEPLOYMENT.md) guide.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
