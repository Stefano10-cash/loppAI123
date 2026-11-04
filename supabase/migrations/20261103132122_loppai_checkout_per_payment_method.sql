/*
# Links de checkout por método de pagamento

1. Alterações em plan_checkouts
- Nova coluna `payment_method` com os métodos: multicaixa_express, visa, mastercard, paypal, pix. Links já existentes ficam como multicaixa_express.
- Pode existir um link ativo por plano, ciclo (mensal/anual) e método.

2. Alterações em plan_payments
- Nova coluna `payment_method` para registar o método escolhido em cada pagamento.

3. Funções
- `admin_save_plan_checkout`: passa a receber o método de pagamento. Apenas administradores.
- `request_plan_checkout`: passa a receber o método de pagamento e usa o link ativo desse método, ciclo e plano.
- `list_available_checkout_methods` (nova): devolve, para o utilizador autenticado, apenas quais combinações plano/ciclo/método têm link ativo. Não devolve os links.

4. Segurança
- Clientes continuam sem leitura direta da tabela de checkouts; os links só são usados pelas funções.
- Funções com EXECUTE apenas para utilizadores autenticados.

Notas importantes
- Nenhum dado é removido. As funções antigas são substituídas pelas versões com o método de pagamento.
*/

ALTER TABLE plan_checkouts ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'multicaixa_express';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'plan_checkouts_payment_method_check') THEN
    ALTER TABLE plan_checkouts
      ADD CONSTRAINT plan_checkouts_payment_method_check
      CHECK (payment_method IN ('multicaixa_express', 'visa', 'mastercard', 'paypal', 'pix'));
  END IF;
END $$;

ALTER TABLE plan_payments ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'multicaixa_express';

DROP INDEX IF EXISTS plan_checkouts_one_active_per_plan_cycle;
CREATE UNIQUE INDEX IF NOT EXISTS plan_checkouts_one_active_per_plan_cycle_method
  ON plan_checkouts (plan_id, billing_cycle, payment_method) WHERE is_active;

DROP FUNCTION IF EXISTS public.admin_save_plan_checkout(uuid, text, text, text, boolean);

CREATE OR REPLACE FUNCTION public.admin_save_plan_checkout(
  p_plan_id uuid,
  p_billing_cycle text,
  p_payment_method text,
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
  IF p_payment_method NOT IN ('multicaixa_express', 'visa', 'mastercard', 'paypal', 'pix') THEN
    RAISE EXCEPTION 'invalid_payment_method';
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
  WHERE plan_id = p_plan_id AND billing_cycle = p_billing_cycle AND payment_method = p_payment_method AND is_active;

  INSERT INTO plan_checkouts (plan_id, billing_cycle, payment_method, product_name, checkout_url, is_active)
  VALUES (p_plan_id, p_billing_cycle, p_payment_method, v_name, v_url, COALESCE(p_is_active, false))
  RETURNING id INTO v_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'checkout.save', 'plan_checkout', v_id::text,
    jsonb_build_object('plan_id', p_plan_id, 'billing_cycle', p_billing_cycle,
      'payment_method', p_payment_method, 'is_active', COALESCE(p_is_active, false)));

  RETURN v_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_save_plan_checkout(uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_save_plan_checkout(uuid, text, text, text, text, boolean) TO authenticated;

DROP FUNCTION IF EXISTS public.request_plan_checkout(uuid, text);

CREATE OR REPLACE FUNCTION public.request_plan_checkout(p_plan_id uuid, p_billing_cycle text, p_payment_method text)
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
  WHERE plan_id = p_plan_id AND billing_cycle = p_billing_cycle AND payment_method = p_payment_method AND is_active
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'checkout_unavailable';
  END IF;

  v_amount := CASE WHEN p_billing_cycle = 'yearly' THEN v_plan.price_yearly ELSE v_plan.price_monthly END;

  SELECT * INTO v_payment
  FROM plan_payments
  WHERE user_id = v_uid AND plan_id = p_plan_id AND billing_cycle = p_billing_cycle
    AND payment_method = p_payment_method AND checkout_id = v_checkout.id AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO plan_payments (user_id, plan_id, checkout_id, billing_cycle, payment_method, expected_amount, currency)
    VALUES (v_uid, p_plan_id, v_checkout.id, p_billing_cycle, p_payment_method, v_amount, v_plan.currency)
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

REVOKE EXECUTE ON FUNCTION public.request_plan_checkout(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_plan_checkout(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_available_checkout_methods()
RETURNS TABLE (plan_id uuid, billing_cycle text, payment_method text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT c.plan_id, c.billing_cycle, c.payment_method
  FROM plan_checkouts c
  WHERE c.is_active;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_available_checkout_methods() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_available_checkout_methods() TO authenticated;
