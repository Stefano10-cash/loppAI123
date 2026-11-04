import { useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { PlanCheckout, SubscriptionPlan } from '@/types';
import { formatCurrency, slugify } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  AdminErrorBanner,
  AdminField,
  getAdminErrorMessage,
} from '@/components/admin/adminUi';
import { CheckoutLinkFields } from '@/components/admin/CheckoutLinkFields';
import { isValidCheckoutUrl, saveCheckoutLink } from '@/components/admin/checkoutLinks';

const CURRENCIES = ['AOA', 'EUR', 'USD', 'BRL'];

interface PlanForm {
  name: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  currency: string;
  duration_days: string;
  features: string;
  is_active: boolean;
  yearly_checkout_url: string;
  yearly_checkout_active: boolean;
}

function toForm(plan: SubscriptionPlan | null, yearlyCheckout: PlanCheckout | null): PlanForm {
  if (!plan) {
    return {
      name: '',
      description: '',
      price_monthly: '0',
      price_yearly: '0',
      currency: 'AOA',
      duration_days: '30',
      features: '',
      is_active: true,
      yearly_checkout_url: '',
      yearly_checkout_active: true,
    };
  }
  return {
    name: plan.name,
    description: plan.description ?? '',
    price_monthly: String(plan.price_monthly),
    price_yearly: String(plan.price_yearly),
    currency: plan.currency,
    duration_days: String(plan.duration_days),
    features: (plan.features ?? []).join('\n'),
    is_active: plan.is_active,
    yearly_checkout_url: yearlyCheckout?.checkout_url ?? '',
    yearly_checkout_active: yearlyCheckout?.is_active ?? true,
  };
}

export function AdminPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [yearlyCheckouts, setYearlyCheckouts] = useState<PlanCheckout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlan | 'new' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const [plansRes, checkoutsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('sort_order', { ascending: true }),
        supabase
          .from('plan_checkouts')
          .select('*')
          .eq('billing_cycle', 'yearly')
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (plansRes.error || checkoutsRes.error) {
        setError('Não foi possível carregar os planos. Tenta novamente.');
        return;
      }
      setPlans((plansRes.data as SubscriptionPlan[]) ?? []);
      setYearlyCheckouts((checkoutsRes.data as PlanCheckout[]) ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function latestYearlyCheckout(planId: string): PlanCheckout | null {
    return yearlyCheckouts.find((c) => c.plan_id === planId) ?? null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Planos</h1>
          <p className="mt-1 text-sm text-slate-500">Preços, duração, funcionalidades e checkout anual.</p>
        </div>
        <button onClick={() => setEditing('new')} className={adminPrimaryButtonClass}>
          <Plus className="h-4 w-4" /> Novo plano
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={28} className="text-blue-600" />
        </div>
      ) : error ? (
        <AdminErrorBanner message={error} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => {
            const yearlyCheckout = latestYearlyCheckout(plan.id);
            const yearlyMissing = Number(plan.price_yearly) > 0 && !yearlyCheckout?.is_active;
            return (
              <div key={plan.id} className={`${adminCardClass} flex flex-col p-5`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{plan.name}</h2>
                    <p className="font-mono text-xs text-slate-400">{plan.slug}</p>
                  </div>
                  <span
                    className={
                      plan.is_active
                        ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                        : 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20'
                    }
                  >
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                <div className="mt-4 space-y-1 text-sm text-slate-600">
                  <p>Mensal: <span className="font-medium text-slate-900">{formatCurrency(Number(plan.price_monthly), plan.currency)}</span></p>
                  <p>Anual: <span className="font-medium text-slate-900">{formatCurrency(Number(plan.price_yearly), plan.currency)}</span></p>
                  <p>Duração: {plan.duration_days} dias</p>
                  {Number(plan.price_yearly) > 0 && (
                    <p className={yearlyMissing ? 'text-amber-700' : 'text-emerald-700'}>
                      {yearlyMissing ? 'Checkout anual: sem link ativo' : 'Checkout anual: ativo'}
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-5">
                  <button onClick={() => setEditing(plan)} className={`${adminSecondaryButtonClass} w-full`}>
                    <Pencil className="h-4 w-4" /> Editar plano
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== null && (
        <PlanFormModal
          key={editing === 'new' ? 'new' : editing.id}
          plan={editing === 'new' ? null : editing}
          yearlyCheckout={editing === 'new' ? null : latestYearlyCheckout(editing.id)}
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

function PlanFormModal({
  plan,
  yearlyCheckout,
  onClose,
  onSaved,
}: {
  plan: SubscriptionPlan | null;
  yearlyCheckout: PlanCheckout | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanForm>(() => toForm(plan, yearlyCheckout));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function update<K extends keyof PlanForm>(key: K, value: PlanForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    const name = form.name.trim();
    const monthly = Number(form.price_monthly);
    const yearly = Number(form.price_yearly);
    const duration = Number(form.duration_days);
    const yearlyUrl = form.yearly_checkout_url.trim();
    if (!name) {
      setFormError('Indica o nome do plano.');
      return;
    }
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(yearly) || yearly < 0) {
      setFormError('Os preços têm de ser valores válidos e não negativos.');
      return;
    }
    if (!Number.isInteger(duration) || duration <= 0) {
      setFormError('A duração tem de ser um número de dias maior que zero.');
      return;
    }
    const yearlyCheckoutChanged =
      yearly > 0 &&
      (yearlyUrl !== (yearlyCheckout?.checkout_url ?? '') ||
        form.yearly_checkout_active !== (yearlyCheckout?.is_active ?? false));
    if (yearlyCheckoutChanged) {
      if (!yearlyUrl) {
        if (yearlyCheckout) {
          setFormError('Mantém o link anual e desmarca "Checkout ativo" para o desativar.');
          return;
        }
        if (form.yearly_checkout_active) {
          setFormError('Indica o link de checkout anual.');
          return;
        }
      } else if (!isValidCheckoutUrl(yearlyUrl)) {
        setFormError('O link de checkout anual tem de começar por https://');
        return;
      }
    }

    const features = form.features
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    const payload = {
      name,
      description: form.description.trim(),
      price_monthly: monthly,
      price_yearly: yearly,
      currency: form.currency,
      duration_days: duration,
      features,
      is_active: form.is_active,
    };

    setSaving(true);
    setFormError(null);
    let planId = plan?.id ?? null;
    if (plan) {
      const { error } = await supabase.from('subscription_plans').update(payload).eq('id', plan.id);
      if (error) {
        setSaving(false);
        setFormError(
          error.code === '23505'
            ? 'Já existe um plano com este nome. Escolhe outro nome.'
            : 'Não foi possível guardar o plano. Tenta novamente.',
        );
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('subscription_plans')
        .insert({ ...payload, slug: slugify(name), limits: {}, sort_order: 99 })
        .select('id')
        .single();
      if (error || !data) {
        setSaving(false);
        setFormError(
          error?.code === '23505'
            ? 'Já existe um plano com este nome. Escolhe outro nome.'
            : 'Não foi possível guardar o plano. Tenta novamente.',
        );
        return;
      }
      planId = data.id as string;
    }

    if (planId && yearlyCheckoutChanged && yearlyUrl) {
      const { error: checkoutError } = await saveCheckoutLink({
        planId,
        billingCycle: 'yearly',
        paymentMethod: 'multicaixa_express',
        productName: name,
        checkoutUrl: yearlyUrl,
        isActive: form.yearly_checkout_active,
      });
      if (checkoutError) {
        setSaving(false);
        setFormError(`O plano foi guardado, mas o checkout anual não: ${getAdminErrorMessage(checkoutError)}`);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal open onClose={onClose} title={plan ? `Editar ${plan.name}` : 'Novo plano'} size="lg">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AdminField label="Nome">
            <input value={form.name} onChange={(e) => update('name', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="Moeda">
            <select value={form.currency} onChange={(e) => update('currency', e.target.value)} className={adminInputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </AdminField>
          <AdminField label="Preço mensal">
            <input type="number" min={0} value={form.price_monthly} onChange={(e) => update('price_monthly', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="Preço anual">
            <input type="number" min={0} value={form.price_yearly} onChange={(e) => update('price_yearly', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="Duração (dias)">
            <input type="number" min={1} value={form.duration_days} onChange={(e) => update('duration_days', e.target.value)} className={adminInputClass} />
          </AdminField>
          <AdminField label="Visível para clientes">
            <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={form.is_active} onChange={(e) => update('is_active', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
              Plano ativo
            </label>
          </AdminField>
        </div>

        <AdminField label="Descrição">
          <input value={form.description} onChange={(e) => update('description', e.target.value)} className={adminInputClass} />
        </AdminField>

        <AdminField label="Funcionalidades (uma por linha)">
          <textarea rows={6} value={form.features} onChange={(e) => update('features', e.target.value)} className={adminInputClass} />
        </AdminField>

        <div className="space-y-4 rounded-xl border border-slate-200 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Link de Checkout Anual</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Usado quando o cliente escolhe o plano anual. Guardar um novo link substitui o anterior.
            </p>
          </div>
          {Number(form.price_yearly) > 0 ? (
            <CheckoutLinkFields
              url={form.yearly_checkout_url}
              isActive={form.yearly_checkout_active}
              onUrlChange={(v) => update('yearly_checkout_url', v)}
              onActiveChange={(v) => update('yearly_checkout_active', v)}
            />
          ) : (
            <p className="text-sm text-slate-500">Define um preço anual acima de zero para configurar o checkout anual.</p>
          )}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className={adminSecondaryButtonClass}>
            Cancelar
          </button>
          <button onClick={save} disabled={saving} className={adminPrimaryButtonClass}>
            {saving && <LoadingSpinner size={16} className="text-white" />}
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
