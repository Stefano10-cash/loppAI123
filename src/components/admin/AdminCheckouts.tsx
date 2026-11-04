import { useEffect, useState } from 'react';
import { ExternalLink, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PaymentMethodId, PlanCheckout, SubscriptionPlan } from '@/types';
import { PAYMENT_METHOD_OPTIONS } from '@/config/paymentMethods';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  adminCardClass,
  AdminField,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  AdminErrorBanner,
  getAdminErrorMessage,
} from '@/components/admin/adminUi';
import {
  BILLING_CYCLE_LABELS,
  isValidCheckoutUrl,
  saveCheckoutLink,
  type BillingCycle,
} from '@/components/admin/checkoutLinks';
import { CheckoutLinkFields } from '@/components/admin/CheckoutLinkFields';

const CYCLES: BillingCycle[] = ['monthly', 'yearly'];

interface EditTarget {
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  method: PaymentMethodId;
}

export function AdminCheckouts() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [checkouts, setCheckouts] = useState<PlanCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [plansRes, checkoutsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true }),
        supabase.from('plan_checkouts').select('*').order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (plansRes.error || checkoutsRes.error) {
        setError('Não foi possível carregar os checkouts. Tenta novamente.');
        return;
      }
      setPlans((plansRes.data as SubscriptionPlan[]) ?? []);
      setCheckouts((checkoutsRes.data as PlanCheckout[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function latestFor(planId: string, cycle: BillingCycle, method: PaymentMethodId): PlanCheckout | null {
    return checkouts.find((c) => c.plan_id === planId && c.billing_cycle === cycle && c.payment_method === method) ?? null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Checkouts da Kursinha</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cada método de pagamento tem o seu link por plano e por ciclo. Métodos sem link ativo aparecem como indisponíveis para o cliente.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={28} className="text-blue-600" />
        </div>
      ) : error ? (
        <AdminErrorBanner message={error} />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <div key={plan.id} className={`${adminCardClass} p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <p className="font-semibold text-slate-900">{plan.name}</p>
                {!plan.is_active && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Plano inativo</span>
                )}
              </div>

              {CYCLES.map((cycle) => {
                const hasPrice = cycle === 'monthly' ? Number(plan.price_monthly) > 0 : Number(plan.price_yearly) > 0;
                return (
                  <div key={cycle} className="mt-4 first:mt-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {BILLING_CYCLE_LABELS[cycle]}
                    </p>
                    {!hasPrice ? (
                      <p className="text-sm text-slate-400">Sem preço definido para este ciclo.</p>
                    ) : (
                      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                        {PAYMENT_METHOD_OPTIONS.map((method) => {
                          const checkout = latestFor(plan.id, cycle, method.id);
                          const active = checkout?.is_active ?? false;
                          return (
                            <li key={method.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-800">{method.label}</p>
                                  <span
                                    className={
                                      active
                                        ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                                        : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500'
                                    }
                                  >
                                    {active ? 'Disponível' : 'Indisponível'}
                                  </span>
                                </div>
                                {checkout && (
                                  <a
                                    href={checkout.checkout_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-blue-600 hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{checkout.checkout_url}</span>
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => setEditing({ plan, cycle, method: method.id })}
                                className={`${adminSecondaryButtonClass} shrink-0`}
                              >
                                <Pencil className="h-4 w-4" /> {checkout ? 'Alterar link' : 'Definir link'}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <CheckoutFormModal
          key={`${editing.plan.id}-${editing.cycle}-${editing.method}`}
          target={editing}
          current={latestFor(editing.plan.id, editing.cycle, editing.method)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function CheckoutFormModal({
  target,
  current,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  current: PlanCheckout | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { plan, cycle, method } = target;
  const methodLabel = PAYMENT_METHOD_OPTIONS.find((m) => m.id === method)?.label ?? method;
  const [productName, setProductName] = useState(current?.product_name ?? plan.name);
  const [checkoutUrl, setCheckoutUrl] = useState(current?.checkout_url ?? '');
  const [isActive, setIsActive] = useState(current?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    const url = checkoutUrl.trim();
    const name = productName.trim();
    if (!name) {
      setFormError('Indica o nome do produto na Kursinha.');
      return;
    }
    if (!isValidCheckoutUrl(url)) {
      setFormError('Indica um link completo começado por https://');
      return;
    }

    setSaving(true);
    setFormError(null);
    const { error } = await saveCheckoutLink({
      planId: plan.id,
      billingCycle: cycle,
      paymentMethod: method,
      productName: name,
      checkoutUrl: url,
      isActive,
    });
    setSaving(false);

    if (error) {
      setFormError(getAdminErrorMessage(error));
      return;
    }
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={`${methodLabel} · ${BILLING_CYCLE_LABELS[cycle]} · ${plan.name}`} size="md">
      <div className="space-y-5">
        <AdminField label="Nome do produto na Kursinha">
          <input value={productName} onChange={(e) => setProductName(e.target.value)} className={adminInputClass} />
        </AdminField>
        <CheckoutLinkFields
          url={checkoutUrl}
          isActive={isActive}
          onUrlChange={setCheckoutUrl}
          onActiveChange={setIsActive}
        />

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className={adminSecondaryButtonClass}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className={adminPrimaryButtonClass}>
            {saving && <LoadingSpinner size={16} className="text-white" />}
            Guardar link
          </button>
        </div>
      </div>
    </Modal>
  );
}
