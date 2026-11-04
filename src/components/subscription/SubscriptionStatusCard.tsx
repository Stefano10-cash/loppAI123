import { CalendarClock, Clock, Crown, Sparkles, ShieldAlert } from 'lucide-react';
import type { SubscriptionWithPlan } from '@/types';
import { formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/Loading';

export type SubscriptionViewState = 'active' | 'suspended' | 'expired' | 'none';

const DAY_MS = 24 * 60 * 60 * 1000;

interface SubscriptionStatusCardProps {
  state: SubscriptionViewState;
  subscription: SubscriptionWithPlan | null;
  canRenew: boolean;
  renewing: boolean;
  onRenew: () => void;
  onViewPlans: () => void;
}

export function SubscriptionStatusCard({
  state,
  subscription,
  canRenew,
  renewing,
  onRenew,
  onViewPlans,
}: SubscriptionStatusCardProps) {
  const planName = subscription?.subscription_plans?.name ?? 'Plano';
  const cardClass =
    'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8';

  if (state === 'none' || !subscription) {
    return (
      <div className={cardClass}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <Sparkles className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Ainda não tens um plano pago</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Escolhe um plano para desbloqueares as funcionalidades avançadas da LoppAI.
              </p>
            </div>
          </div>
          <button
            onClick={onViewPlans}
            className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Ver planos
          </button>
        </div>
      </div>
    );
  }

  if (state === 'suspended') {
    return (
      <div className={cardClass}>
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10">
            <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Assinatura suspensa</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              O teu plano {planName} está suspenso, por isso as funcionalidades pagas estão bloqueadas. Contacta a equipa de suporte para o reativar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const end = subscription.current_period_end ? new Date(subscription.current_period_end) : null;

  if (state === 'expired') {
    return (
      <div className={cardClass}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">A tua assinatura expirou</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                O plano {planName} terminou{end ? ` em ${formatDate(end)}` : ''}. Renova para voltares a usar as funcionalidades pagas.
              </p>
            </div>
          </div>
          <RenewButton canRenew={canRenew} renewing={renewing} onRenew={onRenew} onViewPlans={onViewPlans} primary />
        </div>
      </div>
    );
  }

  const start = new Date(subscription.current_period_start);
  const totalMs = end ? end.getTime() - start.getTime() : 0;
  const elapsedMs = Date.now() - start.getTime();
  const progress = totalMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;
  const daysLeft = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY_MS)) : 0;
  const expiringSoon = daysLeft <= 3;

  return (
    <div className={cardClass}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
            <Crown className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Plano {planName}</h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400">
                Ativo
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {subscription.billing_cycle === 'yearly' ? 'Faturação anual' : 'Faturação mensal'} · Desde {formatDate(start)}
            </p>
          </div>
        </div>
        {canRenew && <RenewButton canRenew renewing={renewing} onRenew={onRenew} onViewPlans={onViewPlans} />}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-2 text-sm">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <CalendarClock className="h-4 w-4" />
            Válido até {end ? formatDate(end) : '-'}
          </div>
          <p
            className={
              expiringSoon
                ? 'font-semibold text-amber-600 dark:text-amber-400'
                : 'font-medium text-slate-600 dark:text-slate-400'
            }
          >
            {daysLeft} {daysLeft === 1 ? 'dia restante' : 'dias restantes'}
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={expiringSoon ? 'h-full rounded-full bg-amber-500 transition-all duration-700' : 'h-full rounded-full bg-emerald-500 transition-all duration-700'}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function RenewButton({
  canRenew,
  renewing,
  onRenew,
  onViewPlans,
  primary = false,
}: {
  canRenew: boolean;
  renewing: boolean;
  onRenew: () => void;
  onViewPlans: () => void;
  primary?: boolean;
}) {
  if (!canRenew) {
    return (
      <button
        onClick={onViewPlans}
        className="shrink-0 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Ver planos
      </button>
    );
  }
  return (
    <button
      onClick={onRenew}
      disabled={renewing}
      className={
        primary
          ? 'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
          : 'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
      }
    >
      {renewing && <LoadingSpinner size={16} />}
      Renovar plano
    </button>
  );
}
