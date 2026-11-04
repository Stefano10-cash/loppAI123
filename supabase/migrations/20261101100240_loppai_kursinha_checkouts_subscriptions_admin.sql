/*
# Kursinha checkouts, plan payments, subscription control and admin panel

1. New Tables
- `plan_checkouts`: Kursinha checkout links per plan (product name, URL, active flag). At most one active checkout per plan.
- `plan_payments`: every purchase or renewal request. Created as `pending` when a customer opens checkout; set to `confirmed` or `rejected` only by an administrator.
- `admin_users`: the accounts allowed to use the admin panel.
- `admin_audit_log`: record of every administrative action.

2. Modified Tables
- `subscription_plans`: new `duration_days` column (default 30). Existing prices, features and limits are not changed.
- `subscriptions`: no structural change. Customers can no longer insert, update or delete their own rows.
- `profiles`: customers can no longer write `plan` or `age_verified`. Only the safe profile fields remain writable.

3. Functions (run with owner rights, check permissions themselves)
- `is_admin()`: true when the signed-in user is listed in `admin_users`.
- `request_plan_checkout(plan, billing cycle)`: creates or reuses a pending payment and returns the Kursinha checkout link.
- `admin_confirm_payment(payment, Kursinha transaction id)`: validates the payment once, creates the subscription, extends from the current end date when renewing, updates the plan, notifies the customer and writes the audit log.
- `admin_reject_payment(payment, reason)`: rejects a pending payment.
- `admin_set_subscription_status(subscription, status)`: suspends, reactivates or cancels a subscription and recalculates the customer plan.
- `sync_my_subscription()`: expires overdue subscriptions, sends expiry and "ending soon" notifications, and returns the customer plan to free when nothing is active.
- `admin_dashboard_stats()`, `admin_list_customers()`, `admin_list_payments()`: admin-only reads.

4. Security
- RLS is enabled on every new table.
- Customers can read only their own payments and subscriptions.
- Admin-only tables and functions reject non-admin callers.
- Functions are not callable by anonymous users.
- Duplicate protection: a payment can be confirmed only once, and one Kursinha transaction id can be used only once.

5. Important Notes
- Payments are confirmed manually by the administrator after checking the Kursinha sale. No automatic confirmation exists.
- The first administrator must be added to `admin_users` separately.
*/

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;

CREATE TABLE IF NOT EXISTS admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  checkout_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_checkouts_one_active_per_plan ON plan_checkouts (plan_id) WHERE is_active;

CREATE TABLE IF NOT EXISTS plan_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES subscription_plans(id),
  checkout_id uuid REFERENCES plan_checkouts(id) ON DELETE SET NULL,
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
  expected_amount numeric(12,2) NOT NULL,
  currency text NOT NULL,
  reference text NOT NULL DEFAULT 'LOPP-' || upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  kursinha_transaction_id text,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  rejection_reason text,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_payments_unique_kursinha_transaction ON plan_payments (kursinha_transaction_id) WHERE kursinha_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plan_payments_user_idx ON plan_payments (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION recalculate_user_plan(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  SELECT p.slug INTO v_slug
  FROM subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.user_id = p_user_id AND s.status = 'active' AND s.current_period_end > now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;

  UPDATE profiles
  SET plan = COALESCE(v_slug, 'free'), updated_at = now()
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION request_plan_checkout(p_plan_id uuid, p_billing_cycle text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF NOT FOUND OR v_plan.price_monthly <= 0 THEN
    RAISE EXCEPTION 'plan_not_purchasable';
  END IF;

  SELECT * INTO v_checkout FROM plan_checkouts WHERE plan_id = p_plan_id AND is_active LIMIT 1;
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
$$;

CREATE OR REPLACE FUNCTION admin_confirm_payment(p_payment_id uuid, p_kursinha_transaction_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_pay plan_payments%ROWTYPE;
  v_plan subscription_plans%ROWTYPE;
  v_current_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_days integer;
  v_sub_id uuid;
  v_txn text := btrim(COALESCE(p_kursinha_transaction_id, ''));
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_txn = '' THEN
    RAISE EXCEPTION 'transaction_id_required';
  END IF;

  SELECT * INTO v_pay FROM plan_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;
  IF v_pay.status <> 'pending' THEN
    RAISE EXCEPTION 'payment_already_processed';
  END IF;
  IF EXISTS (SELECT 1 FROM plan_payments WHERE kursinha_transaction_id = v_txn) THEN
    RAISE EXCEPTION 'transaction_already_used';
  END IF;

  SELECT * INTO v_plan FROM subscription_plans WHERE id = v_pay.plan_id;
  v_days := CASE WHEN v_pay.billing_cycle = 'yearly' THEN 365 ELSE v_plan.duration_days END;

  SELECT s.current_period_end INTO v_current_end
  FROM subscriptions s
  WHERE s.user_id = v_pay.user_id AND s.status = 'active' AND s.current_period_end > now()
  ORDER BY s.current_period_end DESC
  LIMIT 1;

  v_start := COALESCE(v_current_end, now());
  v_end := v_start + make_interval(days => v_days);

  UPDATE subscriptions
  SET status = 'expired', updated_at = now()
  WHERE user_id = v_pay.user_id AND status = 'active' AND current_period_end <= now();

  INSERT INTO subscriptions (user_id, plan_id, status, billing_cycle, current_period_start, current_period_end)
  VALUES (v_pay.user_id, v_pay.plan_id, 'active', v_pay.billing_cycle, v_start, v_end)
  RETURNING id INTO v_sub_id;

  UPDATE plan_payments
  SET status = 'confirmed', kursinha_transaction_id = v_txn, subscription_id = v_sub_id,
      confirmed_by = v_admin, processed_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  UPDATE profiles SET plan = v_plan.slug, updated_at = now() WHERE id = v_pay.user_id;

  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES
    (v_pay.user_id, 'Pagamento confirmado', 'Recebemos e confirmámos o teu pagamento do plano ' || v_plan.name || '.', 'success', 'subscription'),
    (v_pay.user_id, 'Plano ativado', 'O plano ' || v_plan.name || ' está ativo até ' || to_char(v_end, 'DD/MM/YYYY') || '.', 'success', 'subscription');

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (v_admin, 'payment.confirm', 'plan_payment', p_payment_id::text,
          jsonb_build_object('plan', v_plan.slug, 'amount', v_pay.expected_amount, 'currency', v_pay.currency, 'kursinha_transaction_id', v_txn, 'subscription_id', v_sub_id, 'period_end', v_end));

  RETURN jsonb_build_object('subscription_id', v_sub_id, 'period_end', v_end);
END;
$$;

CREATE OR REPLACE FUNCTION admin_reject_payment(p_payment_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT status INTO v_status FROM plan_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_not_found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'payment_already_processed';
  END IF;

  UPDATE plan_payments
  SET status = 'rejected', rejection_reason = NULLIF(btrim(COALESCE(p_reason, '')), ''),
      confirmed_by = auth.uid(), processed_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'payment.reject', 'plan_payment', p_payment_id::text, jsonb_build_object('reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_subscription_status(p_subscription_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('active', 'suspended', 'cancelled') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE subscriptions SET status = p_status, updated_at = now()
  WHERE id = p_subscription_id
  RETURNING user_id INTO v_user;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'subscription_not_found';
  END IF;

  PERFORM recalculate_user_plan(v_user);

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), 'subscription.set_status', 'subscription', p_subscription_id::text, jsonb_build_object('status', p_status));
END;
$$;

CREATE OR REPLACE FUNCTION sync_my_subscription()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expired record;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  FOR v_expired IN
    UPDATE subscriptions s
    SET status = 'expired', updated_at = now()
    WHERE s.user_id = v_uid AND s.status = 'active' AND s.current_period_end <= now()
    RETURNING s.id, s.plan_id, s.current_period_end
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (v_uid, 'Assinatura expirada', 'A tua assinatura terminou. Renova o plano para voltares a usar as funcionalidades pagas.', 'warning', 'subscription');
  END LOOP;

  INSERT INTO notifications (user_id, title, message, type, link)
  SELECT v_uid, 'Assinatura próxima do fim', 'A tua assinatura termina a ' || to_char(s.current_period_end, 'DD/MM/YYYY') || '.', 'warning', 'subscription:ending:' || s.id::text
  FROM subscriptions s
  WHERE s.user_id = v_uid AND s.status = 'active'
    AND s.current_period_end > now() AND s.current_period_end <= now() + interval '3 days'
    AND NOT EXISTS (
      SELECT 1 FROM notifications n WHERE n.user_id = v_uid AND n.link = 'subscription:ending:' || s.id::text
    );

  PERFORM recalculate_user_plan(v_uid);
END;
$$;

CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'total_customers', (SELECT count(*) FROM profiles),
    'active_customers', (SELECT count(DISTINCT user_id) FROM subscriptions WHERE status = 'active' AND current_period_end > now()),
    'expired_customers', (SELECT count(DISTINCT s.user_id) FROM subscriptions s WHERE s.status = 'expired' AND NOT EXISTS (
      SELECT 1 FROM subscriptions a WHERE a.user_id = s.user_id AND a.status = 'active' AND a.current_period_end > now())),
    'active_subscriptions', (SELECT count(*) FROM subscriptions WHERE status = 'active' AND current_period_end > now()),
    'confirmed_payments', (SELECT count(*) FROM plan_payments WHERE status = 'confirmed'),
    'pending_payments', (SELECT count(*) FROM plan_payments WHERE status = 'pending'),
    'revenue', (SELECT COALESCE(jsonb_object_agg(currency, total), '{}'::jsonb) FROM (
      SELECT currency, sum(expected_amount) AS total FROM plan_payments WHERE status = 'confirmed' GROUP BY currency) r)
  );
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_customers()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  created_at timestamptz,
  plan text,
  subscription_id uuid,
  subscription_status text,
  period_start timestamptz,
  period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, u.email::text, u.created_at, p.plan,
         s.id, s.status, s.current_period_start, s.current_period_end
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  LEFT JOIN LATERAL (
    SELECT sub.id, sub.status, sub.current_period_start, sub.current_period_end
    FROM subscriptions sub
    WHERE sub.user_id = p.id
    ORDER BY sub.created_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION admin_list_payments()
RETURNS TABLE (
  payment_id uuid,
  user_id uuid,
  customer_name text,
  customer_email text,
  plan_name text,
  reference text,
  kursinha_transaction_id text,
  expected_amount numeric,
  currency text,
  billing_cycle text,
  status text,
  created_at timestamptz,
  processed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT pp.id, pp.user_id, p.full_name, u.email::text, sp.name, pp.reference, pp.kursinha_transaction_id,
         pp.expected_amount, pp.currency, pp.billing_cycle, pp.status, pp.created_at, pp.processed_at
  FROM plan_payments pp
  JOIN auth.users u ON u.id = pp.user_id
  LEFT JOIN profiles p ON p.id = pp.user_id
  JOIN subscription_plans sp ON sp.id = pp.plan_id
  ORDER BY pp.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION recalculate_user_plan(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION request_plan_checkout(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_confirm_payment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_reject_payment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_set_subscription_status(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION sync_my_subscription() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_list_customers() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION admin_list_payments() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION request_plan_checkout(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_confirm_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_reject_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_subscription_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_my_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_customers() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_list_payments() TO authenticated;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON plan_checkouts TO authenticated;
GRANT SELECT ON plan_payments TO authenticated;
GRANT SELECT ON admin_audit_log TO authenticated;

DROP POLICY IF EXISTS "select_own_admin_row" ON admin_users;
CREATE POLICY "select_own_admin_row" ON admin_users FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_active_or_admin_checkouts" ON plan_checkouts;
CREATE POLICY "select_active_or_admin_checkouts" ON plan_checkouts FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_admin_checkouts" ON plan_checkouts;
CREATE POLICY "insert_admin_checkouts" ON plan_checkouts FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_admin_checkouts" ON plan_checkouts;
CREATE POLICY "update_admin_checkouts" ON plan_checkouts FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_admin_checkouts" ON plan_checkouts;
CREATE POLICY "delete_admin_checkouts" ON plan_checkouts FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_own_or_admin_payments" ON plan_payments;
CREATE POLICY "select_own_or_admin_payments" ON plan_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "select_admin_audit_log" ON admin_audit_log;
CREATE POLICY "select_admin_audit_log" ON admin_audit_log FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_admin_subscription_plans" ON subscription_plans;
CREATE POLICY "insert_admin_subscription_plans" ON subscription_plans FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_admin_subscription_plans" ON subscription_plans;
CREATE POLICY "update_admin_subscription_plans" ON subscription_plans FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "select_admin_profiles" ON profiles;
CREATE POLICY "select_admin_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "select_admin_subscriptions" ON subscriptions;
CREATE POLICY "select_admin_subscriptions" ON subscriptions FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "insert_own_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "update_own_subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "delete_own_subscriptions" ON subscriptions;

REVOKE INSERT, UPDATE ON profiles FROM anon, authenticated;
GRANT INSERT (id, full_name, phone, currency, bio, company, country, avatar_url) ON profiles TO authenticated;
GRANT UPDATE (full_name, bio, company, phone, country, currency, avatar_url, updated_at) ON profiles TO authenticated;
