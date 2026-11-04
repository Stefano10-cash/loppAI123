/*
# Add payment methods to products, purchases table, and goals table

## Changes
1. Add `payment_methods` (text[]) and `accepted_currencies` (text[]) columns to products
2. Create `purchases` table for buyer/student mode (tracks who bought what)
3. Create `seller_goals` table for the planetary journey goals feature
*/

-- Add payment methods and accepted currencies to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS payment_methods text[] DEFAULT ARRAY[]::text[];
ALTER TABLE products ADD COLUMN IF NOT EXISTS accepted_currencies text[] DEFAULT ARRAY['AOA']::text[];

-- Purchases table (for buyer mode and student mode)
CREATE TABLE IF NOT EXISTS purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'AOA',
  payment_method text NOT NULL DEFAULT '',
  payment_status text NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('pending','paid','refunded','cancelled')),
  purchased_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(buyer_id, product_id)
);

ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_purchases" ON purchases FOR SELECT
  TO authenticated USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
CREATE POLICY "insert_purchases" ON purchases FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "update_own_purchases" ON purchases FOR UPDATE
  TO authenticated USING (auth.uid() = buyer_id) WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "delete_own_purchases" ON purchases FOR DELETE
  TO authenticated USING (auth.uid() = buyer_id);

-- Allow browsing published products from other sellers
-- (products table already has RLS; we add a policy allowing SELECT on published products)
CREATE POLICY "select_published_products_all" ON products FOR SELECT
  TO authenticated USING (status = 'published');

-- Seller goals table (planetary journey)
CREATE TABLE IF NOT EXISTS seller_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  planet text NOT NULL CHECK (planet IN ('mercury','venus','earth','mars','jupiter','saturn','uranus','neptune')),
  planet_name text NOT NULL,
  goal_type text NOT NULL CHECK (goal_type IN ('sales','revenue','products','stores','campaigns','affiliates')),
  target_value numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, planet)
);

ALTER TABLE seller_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_goals" ON seller_goals FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_goals" ON seller_goals FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_goals" ON seller_goals FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_goals" ON seller_goals FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
