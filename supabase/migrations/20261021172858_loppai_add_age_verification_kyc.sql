/*
# Add age verification (KYC) for withdrawals
## Changes
1. Create `age_verifications` table for KYC documents (ID card front/back, personal info)
2. Add `age_verified` boolean to profiles
*/

CREATE TABLE IF NOT EXISTS age_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  date_of_birth date NOT NULL,
  age integer NOT NULL,
  country text NOT NULL,
  location text NOT NULL,
  postal_code text,
  id_card_front_url text NOT NULL,
  id_card_back_url text,
  id_card_number text,
  id_type text NOT NULL DEFAULT 'bilhete_identidade' CHECK (id_type IN ('bilhete_identidade','passaporte','carta_conducao','residencia')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE age_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_verification" ON age_verifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_verification" ON age_verifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_verification" ON age_verifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_verification" ON age_verifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add age_verified flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false;
