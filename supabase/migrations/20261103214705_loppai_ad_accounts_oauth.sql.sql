/*
# Ad Accounts — OAuth Connections for Campaigns

## Purpose
Stores connected advertising accounts (Meta Ads, Google Ads) for each user,
enabling the Campaigns page to show connected accounts and manage campaigns
through the official OAuth flows of each platform.

## New Tables
- `ad_accounts`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `platform` (text, not null) — 'meta' or 'google'
  - `platform_account_id` (text) — the ad account ID returned by the platform
  - `platform_account_name` (text) — a human-friendly label for the account
  - `scopes` (text[]) — the authorized scopes/permissions granted
  - `status` (text, not null, default 'connected') — 'connected', 'expired', 'disconnected'
  - `connected_at` (timestamptz, default now())
  - `disconnected_at` (timestamptz, nullable)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `ad_accounts`.
- CRUD granted only to `authenticated` (app requires sign-in).
- Owner-scoped policies: each user can only access rows they own.
- `user_id` defaults to `auth.uid()` so inserts omitting it succeed.
- Index on `user_id` for fast per-user listing.

## Notes
1. OAuth tokens (access/refresh) are NOT stored in this table — they live as
   secrets in the edge functions and are exchanged server-side. The table only
   records the connection state visible to the user.
2. Multiple accounts per platform are allowed (no unique constraint on
   platform + user_id), supporting "connect another account".
3. `status` is managed by the edge functions and the disconnect action.
*/

CREATE TABLE IF NOT EXISTS ad_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta', 'google')),
  platform_account_id text,
  platform_account_name text,
  scopes text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'disconnected')),
  connected_at timestamptz DEFAULT now(),
  disconnected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ad_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON ad_accounts TO authenticated;

DROP POLICY IF EXISTS "select_own_ad_accounts" ON ad_accounts;
CREATE POLICY "select_own_ad_accounts" ON ad_accounts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ad_accounts" ON ad_accounts;
CREATE POLICY "insert_own_ad_accounts" ON ad_accounts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ad_accounts" ON ad_accounts;
CREATE POLICY "update_own_ad_accounts" ON ad_accounts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ad_accounts" ON ad_accounts;
CREATE POLICY "delete_own_ad_accounts" ON ad_accounts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_user_id ON ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_status ON ad_accounts(status);
