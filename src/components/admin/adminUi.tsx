import type { ReactNode } from 'react';
import type { PlanPaymentStatus, SubscriptionStatus } from '@/types';
import { cn } from '@/lib/utils';

export const adminInputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20';

export const adminPrimaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

export const adminSecondaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

export const adminCardClass = 'rounded-xl border border-slate-200 bg-white shadow-sm';

const ERROR_MESSAGES: Record<string, string> = {
  forbidden: 'Não tens permissões de administrador para esta ação.',
  not_authenticated: 'Inicia sessão para continuares.',
  transaction_id_required: 'Indica o ID da transação da Kursinha.',
  transaction_already_used: 'Este ID de transação já foi usado noutro pagamento.',
  payment_not_found: 'Pagamento não encontrado.',
  payment_already_processed: 'Este pagamento já foi processado.',
  subscription_not_found: 'Subscrição não encontrada.',
  invalid_status: 'Estado de subscrição inválido.',
  invalid_billing_cycle: 'Ciclo de pagamento inválido.',
  invalid_payment_method: 'Método de pagamento inválido.',
  product_name_required: 'Indica o nome do produto na Kursinha.',
  invalid_checkout_url: 'Indica um link completo começado por https://',
  plan_not_found: 'Plano não encontrado.',
};

export function getAdminErrorMessage(error: { message: string }): string {
  return ERROR_MESSAGES[error.message] ?? 'Não foi possível concluir a ação. Tenta novamente.';
}

const SUBSCRIPTION_STYLES: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  expired: { label: 'Expirada', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  suspended: { label: 'Suspensa', className: 'bg-red-50 text-red-700 ring-red-600/20' },
  cancelled: { label: 'Cancelada', className: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

const PAYMENT_STYLES: Record<PlanPaymentStatus, { label: string; className: string }> = {
  pending: { label: 'Por confirmar', className: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  confirmed: { label: 'Confirmado', className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  rejected: { label: 'Rejeitado', className: 'bg-red-50 text-red-700 ring-red-600/20' },
};

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', className)}>
      {label}
    </span>
  );
}

export function SubscriptionStatusPill({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <Pill label="Sem assinatura" className="bg-slate-100 text-slate-600 ring-slate-500/20" />;
  return <Pill {...SUBSCRIPTION_STYLES[status]} />;
}

export function PaymentStatusPill({ status }: { status: PlanPaymentStatus }) {
  return <Pill {...PAYMENT_STYLES[status]} />;
}

export function AdminErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
  );
}

export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
