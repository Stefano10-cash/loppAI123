import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { PageId } from '@/config/navigation';
import type { PlanPayment, SubscriptionWithPlan } from '@/types';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  SubscriptionStatusCard,
  type SubscriptionViewState,
} from '@/components/subscription/SubscriptionStatusCard';
import { PaymentHistory } from '@/components/subscription/PaymentHistory';
import { PaymentMethodsCard } from '@/components/subscription/PaymentMethodsCard';
import { PAYMENT_METHOD_OPTIONS, WITHDRAWAL_METHODS, type MethodStatus } from '@/config/paymentMethods';
import { fetchAvailableCheckouts, methodsForPlan, type AvailableCheckout } from '@/lib/checkoutMethods';

interface SubscriptionPageProps {
  onNavigate: (page: PageId) => void;
}

function isLive(sub: SubscriptionWithPlan): boolean {
  return sub.status === 'active' && !!sub.current_period_end && new Date(sub.current_period_end).getTime() > Date.now();
}

export function SubscriptionPage({ onNavigate }: SubscriptionPageProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const [subscriptions, setSubscriptions] = useState<SubscriptionWithPlan[]>([]);
  const [payments, setPayments] = useState<PlanPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState<string | null>(null);
  const [renewReference, setRenewReference] = useState<string | null>(null);
  const [checkoutRows, setCheckoutRows] = useState<AvailableCheckout[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    const { error: syncError } = await supabase.rpc('sync_my_subscription');
    if (syncError) console.error('Error syncing subscription:', syncError);

    const [subsRes, paymentsRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*, subscription_plans(name, slug, price_monthly)')
        .eq('user_id', userId)
        .order('current_period_end', { ascending: false }),
      supabase
        .from('plan_payments')
        .select('*, subscription_plans(name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);
    setLoading(false);

    if (subsRes.error || paymentsRes.error) {
      setError('Não foi possível carregar a tua assinatura. Tenta novamente.');
      return;
    }
    setSubscriptions((subsRes.data as SubscriptionWithPlan[]) ?? []);
    setPayments((paymentsRes.data as PlanPayment[]) ?? []);
    setCheckoutRows((await fetchAvailableCheckouts()) ?? []);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeSub = useMemo(() => subscriptions.find(isLive) ?? null, [subscriptions]);
  const suspendedSub = useMemo(() => subscriptions.find((s) => s.status === 'suspended') ?? null, [subscriptions]);
  const latestSub = subscriptions[0] ?? null;

  const viewState: SubscriptionViewState = activeSub
    ? 'active'
    : suspendedSub
      ? 'suspended'
      : latestSub
        ? 'expired'
        : 'none';

  const displaySub = activeSub ?? suspendedSub ?? latestSub;
  const canRenew = Number(displaySub?.subscription_plans?.price_monthly ?? 0) > 0;
  const pendingPayment = payments.find((p) => p.status === 'pending') ?? null;
  const latestPayment = payments[0] ?? null;
  const latestRejected = latestPayment?.status === 'rejected' ? latestPayment : null;

  async function renew() {
    if (!displaySub) return;
    const method = methodsForPlan(checkoutRows, displaySub.plan_id, displaySub.billing_cycle)[0];
    if (!method) {
      setRenewError('O checkout deste plano ainda não está disponível. Tenta novamente mais tarde.');
      return;
    }
    setRenewing(true);
    setRenewError(null);
    const { data, error: rpcError } = await supabase.rpc('request_plan_checkout', {
      p_plan_id: displaySub.plan_id,
      p_billing_cycle: displaySub.billing_cycle,
      p_payment_method: method,
    });
    setRenewing(false);

    const checkout = data as { checkout_url?: string; reference?: string } | null;
    if (rpcError || !checkout?.checkout_url) {
      setRenewError(
        rpcError?.message.includes('checkout_unavailable')
          ? 'O checkout deste plano ainda não está disponível. Tenta novamente mais tarde.'
          : 'Não foi possível abrir o checkout. Tenta novamente.',
      );
      return;
    }
    window.open(checkout.checkout_url, '_blank', 'noopener,noreferrer');
    setRenewReference(checkout.reference ?? null);
    void load();
  }

  const paymentMethods: MethodStatus[] = PAYMENT_METHOD_OPTIONS.map((m) => ({
    ...m,
    available: checkoutRows.some((r) => r.payment_method === m.id),
  }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={28} className="text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Minha assinatura</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Estado do teu plano, validade e pagamentos.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      )}

      {renewReference && (
        <Notice>
          Pedido criado com a referência <strong>{renewReference}</strong>. Depois de concluires o pagamento na Kursinha, a renovação é confirmada pela nossa equipa.
        </Notice>
      )}

      {!renewReference && pendingPayment && (
        <Notice>
          Tens um pagamento por confirmar (ref. <strong>{pendingPayment.reference}</strong>). A ativação acontece assim que a nossa equipa o verificar.
        </Notice>
      )}

      {latestRejected && (
        <Notice tone="error">
          O último pagamento (ref. <strong>{latestRejected.reference}</strong>) não foi aceite
          {latestRejected.rejection_reason ? `: ${latestRejected.rejection_reason}` : '.'} Podes tentar novamente renovando o plano.
        </Notice>
      )}

      <SubscriptionStatusCard
        state={viewState}
        subscription={displaySub}
        canRenew={canRenew}
        renewing={renewing}
        onRenew={renew}
        onViewPlans={() => onNavigate('plans')}
      />

      {renewError && <p className="text-sm text-red-600 dark:text-red-400">{renewError}</p>}

      <PaymentHistory payments={payments} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <PaymentMethodsCard
          title="Métodos de pagamento"
          description="Formas de pagar as tuas assinaturas. Os métodos sem checkout configurado aparecem como indisponíveis."
          methods={paymentMethods}
        />
        <PaymentMethodsCard
          title="Métodos de saque"
          description="Destinos para receber os teus levantamentos. Os métodos indisponíveis ficam bloqueados até serem ativados."
          methods={WITHDRAWAL_METHODS}
        />
      </div>
    </div>
  );
}

function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300'
      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300';
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${styles}`}>
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm">{children}</p>
    </div>
  );
}
