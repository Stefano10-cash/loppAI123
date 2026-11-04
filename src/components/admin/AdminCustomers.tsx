import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, PauseCircle, PlayCircle, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminCustomer, AdminPaymentRow, SubscriptionStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  adminCardClass,
  adminInputClass,
  AdminErrorBanner,
  getAdminErrorMessage,
  PaymentStatusPill,
  SubscriptionStatusPill,
} from '@/components/admin/adminUi';

export function AdminCustomers() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [historyCustomer, setHistoryCustomer] = useState<AdminCustomer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_list_customers');
    setLoading(false);
    if (rpcError) {
      setError(getAdminErrorMessage(rpcError));
      return;
    }
    setCustomers((data as AdminCustomer[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(
      (c) => c.email?.toLowerCase().includes(term) || c.full_name?.toLowerCase().includes(term),
    );
  }, [customers, search]);

  async function toggleSuspension(customer: AdminCustomer) {
    if (!customer.subscription_id) return;
    const nextStatus: SubscriptionStatus = customer.subscription_status === 'suspended' ? 'active' : 'suspended';
    setBusyId(customer.subscription_id);
    setActionError(null);
    const { error: rpcError } = await supabase.rpc('admin_set_subscription_status', {
      p_subscription_id: customer.subscription_id,
      p_status: nextStatus,
    });
    setBusyId(null);
    if (rpcError) {
      setActionError(getAdminErrorMessage(rpcError));
      return;
    }
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Plano, validade e estado de cada conta.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou email"
            className={`${adminInputClass} pl-9`}
          />
        </div>
      </div>

      {actionError && <AdminErrorBanner message={actionError} />}

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={28} className="text-blue-600" />
        </div>
      ) : error ? (
        <AdminErrorBanner message={error} />
      ) : filtered.length === 0 ? (
        <div className={`${adminCardClass} p-10 text-center text-sm text-slate-500`}>Nenhum cliente encontrado.</div>
      ) : (
        <div className={`${adminCardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Validade</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.user_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.full_name || 'Sem nome'}</p>
                      <p className="text-xs text-slate-500">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-700">{c.plan}</td>
                    <td className="px-4 py-3">
                      <SubscriptionStatusPill status={c.subscription_status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.period_end ? `Até ${formatDate(c.period_end)}` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setHistoryCustomer(c)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <History className="h-3.5 w-3.5" /> Histórico
                        </button>
                        {(c.subscription_status === 'active' || c.subscription_status === 'suspended') && (
                          <button
                            onClick={() => toggleSuspension(c)}
                            disabled={busyId === c.subscription_id}
                            className={
                              c.subscription_status === 'active'
                                ? 'inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50'
                                : 'inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50'
                            }
                          >
                            {c.subscription_status === 'active' ? (
                              <>
                                <PauseCircle className="h-3.5 w-3.5" /> Suspender
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3.5 w-3.5" /> Reativar
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomerHistoryModal customer={historyCustomer} onClose={() => setHistoryCustomer(null)} />
    </div>
  );
}

function CustomerHistoryModal({ customer, onClose }: { customer: AdminCustomer | null; onClose: () => void }) {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customer) return;
    let active = true;
    setLoading(true);
    setError(null);
    supabase.rpc('admin_list_payments').then(({ data, error: rpcError }) => {
      if (!active) return;
      setLoading(false);
      if (rpcError) {
        setError(getAdminErrorMessage(rpcError));
        return;
      }
      setPayments(((data as AdminPaymentRow[]) ?? []).filter((p) => p.user_id === customer.user_id));
    });
    return () => {
      active = false;
    };
  }, [customer]);

  return (
    <Modal open={customer !== null} onClose={onClose} title="Histórico de pagamentos" size="lg">
      {customer && (
        <div className="space-y-4">
          <div>
            <p className="font-medium text-slate-900">{customer.full_name || 'Sem nome'}</p>
            <p className="text-sm text-slate-500">{customer.email}</p>
          </div>
          {loading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner size={24} className="text-blue-600" />
            </div>
          ) : error ? (
            <AdminErrorBanner message={error} />
          ) : payments.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Este cliente ainda não fez pedidos de pagamento.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.payment_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {p.plan_name} · {p.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(p.created_at)} · Ref. <span className="font-mono">{p.reference}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrency(Number(p.expected_amount), p.currency)}
                    </span>
                    <PaymentStatusPill status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
