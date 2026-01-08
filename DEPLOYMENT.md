# Deployment Guide for VPS

This guide explains how to deploy EnterpriseChat on a Linux VPS (Ubuntu) using Docker, Nginx, and Let's Encrypt.

## 📋 Prerequisites

- A Linux VPS (Ubuntu 22.04 recommended)
- Docker and Docker Compose installed
- A domain name pointing to your VPS IP address
- Supabase project credentials (URL, Anon Key, Service Role Key)

## 🛠️ Step 1: Initial Setup

1. **Clone the repository** to your VPS:
   ```bash
   git clone <your-repo-url>
   cd enterprise-chat
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```bash
   cp .env.local .env
   ```
   Ensure the following variables are set:
   ```env
   # Supabase Credentials
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   
   # Database (Local or Supabase)
   # If using Supabase DB, use their connection string. 
   # If using the included local postgres service, use:
   DATABASE_URL=postgresql://postgres:postgres@db:5432/enterprisechat
   
   # Redis (Handled by Docker Compose)
   REDIS_URL=redis://redis:6379
   ```

## 🔐 Step 2: SSL Certificate (Let's Encrypt)

1. **Install Certbot**:
   ```bash
   sudo apt update
   sudo apt install certbot
   ```

2. **Obtain SSL Certificate**:
   ```bash
   sudo certbot certonly --manual -d yourdomain.com
   ```
   *Follow the instructions to verify domain ownership.*

3. **Link certificates** to the project directory:
   ```bash
   mkdir -p certbot/conf
   sudo ln -s /etc/letsencrypt/live/yourdomain.com certbot/conf/live/yourdomain.com
   ```

## 🚀 Step 3: Deploy with Docker Compose

1. **Update `nginx.conf`**:
   Replace `yourdomain.com` with your actual domain name in `nginx.conf`.

2. **Build and start the containers**:
   ```bash
   docker compose up -d --build
   ```

3. **Verify the deployment**:
   ```bash
   docker compose ps
   docker compose logs -f app
   ```

## 🔄 Step 4: Database Migrations

If you are using the local Postgres database included in `docker-compose.yml`, the `schema.sql` will automatically run on the first start. If you are using Supabase, ensure your schema is applied via the Supabase SQL Editor.

## 🛡️ Security Recommendations

- **Firewall**: Only allow necessary ports.
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- **Updates**: Regularly update your VPS and Docker images.
- **Backups**: Use Supabase's built-in backup features for your database.

## ❓ Troubleshooting

- **Container failed to start**: Check logs with `docker compose logs <service-name>`.
- **Nginx errors**: Ensure the SSL paths in `nginx.conf` correctly point to the mapped volumes.
- **Database connection issues**: Ensure `DATABASE_URL` is correct and the database service is healthy.
