-- schema.sql
-- Synchronized with Supabase schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name text,
    username text UNIQUE,
    avatar_url text,
    status_text text,
    status_emoji text,
    badge text,
    public_key text,
    updated_at timestamp with time zone DEFAULT now()
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug text UNIQUE NOT NULL,
    owner_id uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Workspace Members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text DEFAULT 'member',
    encrypted_key text,
    PRIMARY KEY (workspace_id, user_id)
);

-- Channels table
CREATE TABLE IF NOT EXISTS public.channels (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    is_private boolean DEFAULT false,
    encryption_enabled boolean DEFAULT false,
    created_by uuid REFERENCES public.profiles(id),
    created_at timestamp with time zone DEFAULT now()
);

-- Channel Members table
CREATE TABLE IF NOT EXISTS public.channel_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    encrypted_key text,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(channel_id, user_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES public.profiles(id),
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    is_edited boolean DEFAULT false,
    is_encrypted boolean DEFAULT false,
    payload jsonb,
    topic text,
    extension text,
    event text,
    private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Member Last Read table
CREATE TABLE IF NOT EXISTS public.member_last_read (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
    channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
    recipient_id uuid REFERENCES public.profiles(id),
    last_read_at timestamp with time zone DEFAULT now()
);

-- Indexes for optimization
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
