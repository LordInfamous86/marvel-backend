-- Admin membership is private server-side data. The Express API checks this
-- table after validating a user's Supabase access token.
CREATE TABLE IF NOT EXISTS public.app_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- Do not add browser-facing policies. The API connects using the server-side
-- database connection and is the only part of this app that reads this table.
