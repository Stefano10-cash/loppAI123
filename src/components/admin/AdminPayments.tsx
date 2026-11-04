import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminPaymentRow, PlanPaymentStatus } from '@/types';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  adminInputClass,
  adminSecondaryButtonClass,
  adminCardClass,
  AdminErrorBanner,
  getAdminErrorMessage,
  PaymentStatusPill,
} from '@/components/admin/adminUi';

type StatusFilter = PlanPaymentStatus | 'all';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'Por confirmar' },
  { id: 'confirmed', label: 'Confirmados' },
  { id: 'rejected', label: 'Rejeitados' },
  { id: 'all', label: 'Todos' },
];

type PaymentAction = { type: 'confirm' | 'reject'; payment: AdminPaymentRow };

export function AdminPayments() {
  const [payments, setPayments] = useState<AdminPaymentRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<PaymentAction | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_list_payments');
    setLoading(false);
    if (rpcError) {
      setError(getAdminErrorMessage(rpcError));
      return;
    }
    setPayments((data as AdminPaymentRow[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(
    () => (filter === 'all' ? payments : payments.filter((p) => p.status === filter)),
    [payments, filter],
  );

  function openAction(type: PaymentAction['type'], payment: AdminPaymentRow) {
    setAction({ type, payment });
    setInputValue('');
    setFormError(null);
  }

  function closeAction() {
    if (submitting) return;
    setAction(null);
  }

  async function submitAction() {
    if (!action) return;
    const value = inputValue.trim();
    if (!value) {
      setFormError(action.type === 'confirm' ? 'Indica o ID da transação da Kursinha.' : 'Indica o motivo da rejeição.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    const { error: rpcError } =
      action.type === 'confirm'
        ? await supabase.rpc('admin_confirm_payment', {
            p_payment_id: action.payment.payment_id,
            p_kursinha_transaction_id: value,
          })
        : await supabase.rpc('admin_reject_payment', {
            p_payment_id: action.payment.payment_id,
            p_reason: value,
          });
    setSubmitting(false);

    if (rpcError) {
      setFormError(getAdminErrorMessage(rpcError));
      return;
    }
    setAction(null);
    void load();
  }

  const isConfirm = action?.type === 'confirm';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Pagamentos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirma um pagamento apenas depois de verificares a transação na Kursinha.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? 'rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner size={28} className="text-blue-600" />
        </div>
      ) : error ? (
        <AdminErrorBanner message={error} />
      ) : visible.length === 0 ? (
        <div className={`${adminCardClass} p-10 text-center text-sm text-slate-500`}>
          Não há pagamentos nesta lista.
        </div>
      ) : (
        <div className={`${adminCardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Plano</th>
                  <th className="px-4 py-3 font-medium">Referência</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => (
                  <tr key={p.payment_id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{p.customer_name || 'Sem nome'}</p>
                      <p className="text-xs text-slate-500">{p.customer_email}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {p.plan_name}
                      <span className="ml-1 text-xs text-slate-400">({p.billing_cycle === 'yearly' ? 'anual' : 'mensal'})</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.reference}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(Number(p.expected_amount), p.currency)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusPill status={p.status} />
                      {p.kursinha_transaction_id && (
                        <p className="mt-1 font-mono text-xs text-slate-400">{p.kursinha_transaction_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.status === 'pending' ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openAction('confirm', p)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                          </button>
                          <button
                            onClick={() => openAction('reject', p)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Rejeitar
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          {p.processed_at ? formatDateTime(p.processed_at) : '-'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={action !== null}
        onClose={closeAction}
        title={isConfirm ? 'Confirmar pagamento' : 'Rejeitar pagamento'}
        size="md"
      >
        {action && (
          <div className="space-y-5">
            <div className="rounded-lg bg-slate-50 p-4 text-sm">
              <p className="font-medium text-slate-900">{action.payment.customer_name || action.payment.customer_email}</p>
              <p className="text-slate-600">
                {action.payment.plan_name} · {formatCurrency(Number(action.payment.expected_amount), action.payment.currency)} · Ref.{' '}
                <span className="font-mono">{action.payment.reference}</span>
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {isConfirm ? 'ID da transação na Kursinha' : 'Motivo da rejeição'}
              </label>
              {isConfirm ? (
                <input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ex.: TRX-123456"
                  className={adminInputClass}
                />
              ) : (
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  rows={3}
                  placeholder="Ex.: pagamento não encontrado na Kursinha"
                  className={adminInputClass}
                />
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                {isConfirm
                  ? 'Cada ID de transação só pode ser usado uma vez.'
                  : 'O cliente vê o motivo na área da sua assinatura.'}
              </p>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex justify-end gap-3">
              <button onClick={closeAction} disabled={submitting} className={adminSecondaryButtonClass}>
                Cancelar
              </button>
              <button
                onClick={submitAction}
                disabled={submitting}
                className={
                  isConfirm
                    ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50'
                    : 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50'
                }
              >
                {submitting && <LoadingSpinner size={16} className="text-white" />}
                {isConfirm ? 'Confirmar e ativar plano' : 'Rejeitar pagamento'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
