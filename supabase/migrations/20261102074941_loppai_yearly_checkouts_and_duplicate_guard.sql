/*
# Checkouts por ciclo (mensal e anual) e proteção contra transações duplicadas

1. Alterações em plan_checkouts
- Nova coluna `billing_cycle` ('monthly' ou 'yearly'). Links já existentes ficam como 'monthly'.
- Pode existir um link ativo por plano e por ciclo (antes era apenas um por plano).

2. Nova função administrativa
- `admin_save_plan_checkout`: guarda o link de checkout de um plano e ciclo. Desativa o link anterior do mesmo plano e ciclo e cria um novo registo, mantendo o histórico. Apenas administradores.

3. Proteção contra duplicação
- Índice único em plan_payments.kursinha_transaction_id: a mesma transação não pode ser associada a dois pagamentos.

4. Funções alteradas
- `request_plan_checkout`: usa o link ativo do ciclo escolhido (mensal ou anual) e recusa planos sem preço anual quando o ciclo é anual.

5. Segurança
- Função nova só executável por utilizadores autenticados e verificada com `is_admin()`.
- Sem alterações de RLS nas tabelas existentes.

Notas importantes
- Nenhum dado é removido.
- Não há confirmação automática: o checkout da Kursinha não disponibiliza notificação verificável.
*/

ALTER TABLE plan_checkouts ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plan_checkouts_billing_cycle_check'
  ) THEN
    ALTER TABLE plan_checkouts
      ADD CONSTRAINT plan_checkouts_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly'));
  END IF;
END $$;

DROP INDEX IF EXISTS plan_checkouts_one_active_per_plan;
CREATE UNIQUE INDEX IF NOT EXISTS plan_checkouts_one_active_per_plan_cycle
  ON plan_checkouts (plan_id, billing_cycle) WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS plan_payments_kursinha_transaction_unique
  ON plan_payments (kursinha_transaction_id) WHERE kursinha_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_save_plan_checkout(
  p_plan_id uuid,
  p_billing_cycle text,
  p_product_name text,
  p_checkout_url text,
  p_is_active boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_name text := btrim(COALESCE(p_product_name, ''));
  v_url text := btrim(COALESCE(p_checkout_url, ''));
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_billing_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'invalid_billing_cycle';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'product_name_required';
  END IF;
  IF v_url !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_checkout_url';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM subscription_plans WHERE id = p_plan_id) THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  UPDATE plan_checkouts
  SET is_active = false, updated_at = now()
  WHERE plan_id = p_plan_id AND billing_cycle = p_billing_cycle AND is_active;

  INSERT INTO plan_checkouts (plan_id, billing_cycle, product_name, checkout_url, is_active)
  VALUES (p_plan_id, p_billing_cycle, v_name, v_url, COALESCE(p_is_active, false))
  RETURNING id INTO v_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'checkout.save', 'plan_checkout', v_id::text,
    jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', p_billing_cycle, 'is_active', COALESCE(p_is_active, false)));

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_save_plan_checkout(uuid, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_checkout(uuid, text, text, text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_plan_checkout(p_plan_id uuid, p_billing_cycle text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_plan subscription_plans%ROWTYPE;
  v_checkout plan_checkouts%ROWTYPE;
  v_payment plan_payments%ROWTYPE;
  v_amount numeric(12,2);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_billing_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'invalid_billing_cycle';
  END IF;

  SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id AND is_active;
  IF NOT FOUND OR v_plan.price_monthly <= 0 OR (p_billing_cycle = 'yearly' AND v_plan.price_yearly <= 0) THEN
    RAISE EXCEPTION 'plan_not_purchasable';
  END IF;

  SELECT * INTO v_checkout FROM plan_checkouts
  WHERE plan_id = p_plan_id AND billing_cycle = p_billing_cycle AND is_active
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_unavailable';
  END IF;

  v_amount := CASE WHEN p_billing_cycle = 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END;

  SELECT * INTO v_payment
  FROM plan_payments
  WHERE user_id = v_uid AND plan_id = p_plan_id AND billing_cycle = p_billing_cycle AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO plan_payments (user_id, plan_id, checkout_id, billing_cycle, expected_amount, currency)
    VALUES (v_uid, p_plan_id, v_checkout.id, p_billing_cycle, v_amount, v_plan.currency)
    RETURNING * INTO v_payment;
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'reference', v_payment.reference,
    'checkout_url', v_checkout.checkout_url,
    'amount', v_payment.expected_amount,
    'currency', v_payment.currency
  );
END;
$function$;
