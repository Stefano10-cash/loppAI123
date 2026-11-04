/*
# Atualizar planos de assinatura

## Alterações
1. Remover planos antigos (free, pro, enterprise) e criar 5 novos planos:
   - Free: Grátis, 1 mês apenas, depois expira
   - Starter: 2500 Kz/mês (base AOA)
   - Pro: 5000 Kz/mês (base AOA)
   - Business: 10000 Kz/mês (base AOA)
   - Premium: 22000 Kz/mês (base AOA)
2. Preços base em AOA (não EUR como antes)
3. O plano Free tem duração limitada de 1 mês (trial)
4. Planos anuais com ~17% desconto calculado a partir do mensal

## Notas
- A moeda base passou de EUR para AOA
- Todos os planos pagos incluem Estúdio IA
- O plano Free é apenas para experimentar (1 mês)
*/

-- Desativar planos antigos
UPDATE subscription_plans SET is_active = false WHERE slug IN ('free', 'pro', 'enterprise');

-- Inserir novos planos (preços em AOA como base)
INSERT INTO subscription_plans (name, slug, description, price_monthly, price_yearly, currency, features, limits, sort_order, is_active)
VALUES
  (
    'Free', 'free', 'Experimenta a plataforma durante 1 mês',
    0, 0, 'AOA',
    '["1 mês de acesso gratuito","3 produtos","1 loja","Ebooks ilimitados","Páginas de vendas básicas","Estúdio IA: 3 imagens/mês","LoppAI Assistente (3 mensagens)","Suporte por email"]'::jsonb,
    '{"max_products": 3, "max_stores": 1, "trial_months": 1}'::jsonb,
    0, true
  ),
  (
    'Starter', 'starter', 'Para começar a vender online',
    2500, 25000, 'AOA',
    '["10 produtos","2 lojas","Páginas de vendas premium","Cupões e descontos","Estúdio IA: 10 imagens/mês","LoppAI Assistente (20 mensagens)","Suporte por email"]'::jsonb,
    '{"max_products": 10, "max_stores": 2}'::jsonb,
    1, true
  ),
  (
    'Pro', 'pro', 'Para criadores e vendedores ativos',
    5000, 50000, 'AOA',
    '["Produtos ilimitados","3 lojas","Páginas de vendas premium","Cupões e descontos","Campanhas publicitárias","Analytics avançado","Estúdio IA: 50 imagens + vídeos + capas/mês","LoppAI Assistente (50 mensagens)","Suporte prioritário"]'::jsonb,
    '{"max_products": -1, "max_stores": 3}'::jsonb,
    2, true
  ),
  (
    'Business', 'business', 'Para negócios em crescimento',
    10000, 100000, 'AOA',
    '["Produtos ilimitados","5 lojas","Páginas de vendas premium","Cupões e descontos","Campanhas publicitárias","Analytics avançado","Programa de afiliados (Básico)","Webhooks + UTMify + OtimizaAI","Estúdio IA: 200 imagens + vídeos + capas/mês","LoppAI Assistente (200 mensagens)","Suporte prioritário"]'::jsonb,
    '{"max_products": -1, "max_stores": 5}'::jsonb,
    3, true
  ),
  (
    'Premium', 'premium', 'Para grandes operações com IA completa',
    22000, 220000, 'AOA',
    '["Tudo do plano Business","Lojas ilimitadas","Afiliados ilimitados","API dedicada","Múltiplos utilizadores","Estúdio IA: ilimitado (imagens, vídeos, capas, e-books)","LoppAI Assistente ilimitado","Gestor de conta dedicado","Suporte 24/7"]'::jsonb,
    '{"max_products": -1, "max_stores": -1}'::jsonb,
    4, true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  sort_order = EXCLUDED.sort_order,
  is_active = true;
