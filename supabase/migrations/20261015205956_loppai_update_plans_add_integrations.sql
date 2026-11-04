/*
# Atualizar features dos planos + Criar tabela de integrações

1. Alterações a planos existentes
- Plano Free: adicionadas features "Estúdio IA: 3 imagens/mês" e "LoppAI Assistente (3 mensagens)"
- Plano Pro: adicionadas features "Estúdio IA: imagens + vídeos + capas (50/mês)" e "LoppAI Assistente (50 mensagens)"
- Plano Enterprise: adicionadas features "Estúdio IA: ilimitado (imagens, vídeos, capas, e-books)" e "LoppAI Assistente ilimitado"
- Atualizadas descrições para refletir as novas capacidades

2. Nova tabela: integrations
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, DEFAULT auth.uid())
- `provider` (text) - identificador da integração: webhook, utmify, otimizaai
- `name` (text) - nome dado pelo utilizador
- `config` (jsonb) - configuração específica (URL do webhook, API key, etc.)
- `is_active` (boolean, default true)
- `last_triggered_at` (timestamptz, nullable) - último evento recebido
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

3. Segurança
- RLS ativada em `integrations`
- Políticas CRUD scoped por user_id (TO authenticated, auth.uid() = user_id)
*/

-- Atualizar features dos planos
UPDATE subscription_plans SET features = '["3 produtos","1 loja","Ebooks ilimitados","Páginas de vendas básicas","Estúdio IA: 3 imagens/mês","LoppAI Assistente (3 mensagens)","Suporte por email"]'::jsonb WHERE slug = 'free';

UPDATE subscription_plans SET description = 'Para criadores e vendedores ativos com IA' WHERE slug = 'pro';
UPDATE subscription_plans SET features = '["Produtos ilimitados","Lojas ilimitadas","Páginas de vendas premium","Cupões e descontos","Campanhas publicitárias","Analytics avançado","Estúdio IA: imagens + vídeos + capas (50/mês)","LoppAI Assistente (50 mensagens)","Suporte prioritário"]'::jsonb WHERE slug = 'pro';

UPDATE subscription_plans SET description = 'Para equipas e grandes operações com IA completa' WHERE slug = 'enterprise';
UPDATE subscription_plans SET features = '["Tudo do plano Pro","Afiliados ilimitados","API dedicada","Múltiplos utilizadores","Estúdio IA: ilimitado (imagens, vídeos, capas, e-books)","LoppAI Assistente ilimitado","Gestor de conta dedicado","Suporte 24/7"]'::jsonb WHERE slug = 'enterprise';

-- Criar tabela de integrações
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_integrations" ON integrations;
CREATE POLICY "select_own_integrations" ON integrations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_integrations" ON integrations;
CREATE POLICY "insert_own_integrations" ON integrations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_integrations" ON integrations;
CREATE POLICY "update_own_integrations" ON integrations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_integrations" ON integrations;
CREATE POLICY "delete_own_integrations" ON integrations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
