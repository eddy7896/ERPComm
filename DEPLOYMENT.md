# Deployment Guide for VPS

This guide explains how to deploy the Enterprise Communication Platform on a Linux VPS (Ubuntu) using Docker, Nginx, and Let's Encrypt.

## Prerequisites

- A Linux VPS (Ubuntu 22.04 recommended)
- Docker and Docker Compose installed
- A domain name pointing to your VPS IP address
- Supabase project credentials (URL, Anon Key, Service Role Key)

## Step 1: Initial Setup

1. **Clone the repository** to your VPS:
   ```bash
   git clone <your-repo-url>
   cd enterprise-chat
   ```

2. **Create a `.env` file** in the root directory:
   ```bash
   touch .env
   ```
   Add the following variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   DATABASE_URL=your_postgresql_connection_string
   ```

## Step 2: SSL Certificate (Let's Encrypt)

1. **Install Certbot**:
   ```bash
   sudo apt update
   sudo apt install certbot
   ```

2. **Obtain SSL Certificate**:
   ```bash
   sudo certbot certonly --manual -d yourdomain.com
   ```
   *Note: Follow the instructions to verify domain ownership. Alternatively, use the Nginx plugin if Nginx is already installed on the host.*

3. **Link certificates** to the project directory:
   The `docker-compose.yml` expects certificates in `./certbot/conf`. You can symlink them:
   ```bash
   mkdir -p certbot/conf
   sudo ln -s /etc/letsencrypt/live/yourdomain.com certbot/conf/live/yourdomain.com
   ```

## Step 3: Nginx Configuration

1. **Update `nginx.conf`**:
   Replace `yourdomain.com` with your actual domain name in the `nginx.conf` file.

## Step 4: Deploy with Docker Compose

1. **Build and start the containers**:
   ```bash
   docker compose up -d --build
   ```

2. **Verify the deployment**:
   Check the logs to ensure everything is running correctly:
   ```bash
   docker compose logs -f
   ```

## Step 5: Horizontal Scaling (Optional)

To scale the application service:
```bash
docker compose up -d --scale app=3
```
*Note: Nginx will automatically load balance between the `app` containers if configured correctly, but the current setup uses a simple upstream. For true horizontal scaling across multiple servers, consider using a cloud load balancer.*

## Security Recommendations

- **Firewall**: Enable `ufw` and only allow ports 22, 80, and 443.
- **Fail2Ban**: Install Fail2Ban to protect against brute-force attacks.
- **Backups**: Regularly back up your Supabase database using their dashboard or CLI.
