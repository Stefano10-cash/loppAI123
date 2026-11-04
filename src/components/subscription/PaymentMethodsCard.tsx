import { Lock } from 'lucide-react';
import type { MethodStatus } from '@/config/paymentMethods';

interface PaymentMethodsCardProps {
  title: string;
  description: string;
  methods: MethodStatus[];
}

export function PaymentMethodsCard({ title, description, methods }: PaymentMethodsCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>

      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
        {methods.map((method) => {
          const Icon = method.icon;
          return (
            <li key={method.id} className="flex items-center gap-3 py-3">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  method.available
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p
                className={`flex-1 text-sm font-medium ${
                  method.available ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {method.label}
              </p>
              {method.available ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20">
                  Disponível
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/30">
                  <Lock className="h-3 w-3" />
                  Indisponível
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
