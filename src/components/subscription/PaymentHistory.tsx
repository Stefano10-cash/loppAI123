import { Receipt } from 'lucide-react';
import type { PlanPayment, PlanPaymentStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

const PAYMENT_LABELS: Record<PlanPaymentStatus, { label: string; className: string }> = {
  pending: {
    label: 'Por confirmar',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  },
  rejected: {
    label: 'Rejeitado',
    className: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
  },
};

export function PaymentHistory({ payments }: { payments: PlanPayment[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <Receipt className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Histórico de pagamentos</h2>
      </div>

      {payments.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Ainda não tens pedidos de pagamento.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {payments.map((payment) => {
            const status = PAYMENT_LABELS[payment.status];
            return (
              <li key={payment.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {payment.subscription_plans?.name ?? 'Plano'} · {payment.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(payment.created_at)} · Ref. <span className="font-mono">{payment.reference}</span>
                  </p>
                  {payment.status === 'rejected' && payment.rejection_reason && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motivo: {payment.rejection_reason}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(Number(payment.expected_amount), payment.currency)}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
                      status.className,
                    )}
                  >
                    {status.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
