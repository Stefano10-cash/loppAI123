/*
# LoppAI - Add affiliates, tickets, subscriptions and chat tables

## New Tables
1. affiliates - Affiliate partners with referral codes and commission tracking
2. affiliate_clicks - Click tracking for affiliate links
3. subscription_plans - Available subscription tiers (free, pro, enterprise)
4. subscriptions - User's active subscription to a plan
5. support_tickets - Support ticket system
6. support_ticket_messages - Messages within a support ticket
7. chat_conversations - AI support chat conversations
8. chat_messages - Messages within an AI chat conversation

## Security
- RLS enabled on all tables
- Owner-scoped policies using auth.uid()
- All user_id columns default to auth.uid()

## Notes
- Affiliates track clicks, conversions and commissions
- Subscription plans are global (anyone can read), but subscriptions are per-user
- Support tickets and chat conversations are per-user
*/

-- Affiliates table
CREATE TABLE IF NOT EXISTS affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  referral_code text NOT NULL,
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  total_earnings numeric(10,2) NOT NULL DEFAULT 0,
  total_paid numeric(10,2) NOT NULL DEFAULT 0,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_affiliates" ON affiliates;
CREATE POLICY "select_own_affiliates" ON affiliates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_affiliates" ON affiliates;
CREATE POLICY "insert_own_affiliates" ON affiliates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_affiliates" ON affiliates;
CREATE POLICY "update_own_affiliates" ON affiliates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_affiliates" ON affiliates;
CREATE POLICY "delete_own_affiliates" ON affiliates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Subscription plans table (global - readable by all authenticated)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  features jsonb NOT NULL DEFAULT '[]',
  limits jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_subscription_plans" ON subscription_plans;
CREATE POLICY "select_subscription_plans" ON subscription_plans FOR SELECT
  TO authenticated USING (true);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start timestamptz DEFAULT now(),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_subscriptions" ON subscriptions;
CREATE POLICY "select_own_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
CREATE POLICY "insert_own_subscriptions" ON subscriptions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
CREATE POLICY "update_own_subscriptions" ON subscriptions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;
CREATE POLICY "delete_own_subscriptions" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general', 'billing', 'technical', 'feature_request', 'bug', 'account')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_tickets" ON support_tickets;
CREATE POLICY "select_own_tickets" ON support_tickets FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tickets" ON support_tickets;
CREATE POLICY "insert_own_tickets" ON support_tickets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tickets" ON support_tickets;
CREATE POLICY "update_own_tickets" ON support_tickets FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tickets" ON support_tickets;
CREATE POLICY "delete_own_tickets" ON support_tickets FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Support ticket messages table
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'user' CHECK (sender IN ('user', 'support', 'ai')),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "select_own_ticket_messages" ON support_ticket_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "insert_own_ticket_messages" ON support_ticket_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "update_own_ticket_messages" ON support_ticket_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_ticket_messages" ON support_ticket_messages;
CREATE POLICY "delete_own_ticket_messages" ON support_ticket_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_ticket_messages.ticket_id AND support_tickets.user_id = auth.uid())
  );

-- Chat conversations table
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova conversa',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chats" ON chat_conversations;
CREATE POLICY "select_own_chats" ON chat_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_chats" ON chat_conversations;
CREATE POLICY "insert_own_chats" ON chat_conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_chats" ON chat_conversations;
CREATE POLICY "update_own_chats" ON chat_conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_chats" ON chat_conversations;
CREATE POLICY "delete_own_chats" ON chat_conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_chat_messages" ON chat_messages;
CREATE POLICY "select_own_chat_messages" ON chat_messages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "insert_own_chat_messages" ON chat_messages;
CREATE POLICY "insert_own_chat_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "update_own_chat_messages" ON chat_messages;
CREATE POLICY "update_own_chat_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "delete_own_chat_messages" ON chat_messages;
CREATE POLICY "delete_own_chat_messages" ON chat_messages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations WHERE chat_conversations.id = chat_messages.conversation_id AND chat_conversations.user_id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_affiliates_user_id ON affiliates(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket_id ON support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON chat_messages(conversation_id);

-- Seed default subscription plans
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, features, limits, sort_order)
VALUES
  (
    'Free', 'free', 'Para começar a explorar a plataforma',
    0, 0,
    '["3 produtos","1 loja","Ebooks ilimitados","Páginas de vendas básicas","Suporte por email"]'::jsonb,
    '{"max_products": 3, "max_stores": 1}'::jsonb,
    0
  ),
  (
    'Pro', 'pro', 'Para criadores e vendedores ativos',
    19.90, 199.00,
    '["Produtos ilimitados","Lojas ilimitadas","Páginas de vendas premium","Cupões e descontos","Campanhas publicitárias","Analytics avançado","Suporte prioritário"]'::jsonb,
    '{"max_products": -1, "max_stores": -1}'::jsonb,
    1
  ),
  (
    'Enterprise', 'enterprise', 'Para equipas e grandes operações',
    49.90, 499.00,
    '["Tudo do plano Pro","Afiliados ilimitados","API dedicada","Múltiplos utilizadores","Gestor de conta dedicado","Suporte 24/7"]'::jsonb,
    '{"max_products": -1, "max_stores": -1}'::jsonb,
    2
  )
ON CONFLICT (slug) DO NOTHING;
