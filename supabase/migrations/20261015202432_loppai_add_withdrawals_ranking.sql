/*
# Add withdrawals table for multi-currency payout system

1. New Tables
- `withdrawals`
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users)
  - `amount` (numeric, not null) — withdrawal amount in the chosen currency
  - `currency` (text, not null) — AOA, EUR, USD, or BRL
  - `payment_method` (text, not null) — visa, mastercard, google_pay, apple_pay, paypal, pix, multicaixa_express
  - `payment_details` (jsonb) — method-specific info (e.g. account reference, card last 4)
  - `status` (text, not null, default 'pending') — pending, processing, completed, rejected
  - `requested_at` (timestamptz, default now())
  - `processed_at` (timestamptz, nullable)
  - `notes` (text, nullable)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

2. Security
- Enable RLS on `withdrawals`.
- Owner-scoped CRUD: each authenticated user can only access their own withdrawal requests.
- 4 separate policies: select, insert, update, delete — all scoped to auth.uid() = user_id.

3. Indexes
- Index on `user_id` for fast owner-scoped queries.
- Index on `status` for filtering pending/processing requests.
*/

CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'AOA' CHECK (currency IN ('AOA','EUR','USD','BRL')),
  payment_method text NOT NULL CHECK (payment_method IN ('visa','mastercard','google_pay','apple_pay','paypal','pix','multicaixa_express')),
  payment_details jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_withdrawals" ON withdrawals;
CREATE POLICY "select_own_withdrawals" ON withdrawals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_withdrawals" ON withdrawals;
CREATE POLICY "insert_own_withdrawals" ON withdrawals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_withdrawals" ON withdrawals;
CREATE POLICY "update_own_withdrawals" ON withdrawals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_withdrawals" ON withdrawals;
CREATE POLICY "delete_own_withdrawals" ON withdrawals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
