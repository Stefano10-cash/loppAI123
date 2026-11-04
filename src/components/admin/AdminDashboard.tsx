import { useCallback, useEffect, useState } from 'react';
import { Users, UserCheck, UserX, CalendarCheck, Clock, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AdminDashboardStats } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/Loading';
import { adminCardClass, AdminErrorBanner, getAdminErrorMessage } from '@/components/admin/adminUi';

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_dashboard_stats');
    setLoading(false);
    if (rpcError) {
      setError(getAdminErrorMessage(rpcError));
      return;
    }
    setStats(data as AdminDashboardStats);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size={28} className="text-blue-600" />
      </div>
    );
  }

  if (error || !stats) {
    return <AdminErrorBanner message={error ?? 'Não foi possível carregar as estatísticas.'} />;
  }

  const cards = [
    { label: 'Clientes', value: stats.total_customers, icon: Users, tone: 'text-slate-700 bg-slate-100' },
    { label: 'Com plano ativo', value: stats.active_customers, icon: UserCheck, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Com plano expirado', value: stats.expired_customers, icon: UserX, tone: 'text-slate-600 bg-slate-100' },
    { label: 'Subscrições ativas', value: stats.active_subscriptions, icon: CalendarCheck, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Pagamentos por confirmar', value: stats.pending_payments, icon: Clock, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Pagamentos confirmados', value: stats.confirmed_payments, icon: Wallet, tone: 'text-emerald-700 bg-emerald-50' },
  ];

  const revenueEntries = Object.entries(stats.revenue ?? {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Visão geral</h1>
        <p className="mt-1 text-sm text-slate-500">Resumo dos clientes, assinaturas e pagamentos.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`${adminCardClass} flex items-center gap-4 p-5`}>
            <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`${adminCardClass} p-5`}>
        <h2 className="text-base font-semibold text-slate-900">Receita confirmada</h2>
        {revenueEntries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Ainda não há pagamentos confirmados.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {revenueEntries.map(([currency, amount]) => (
              <div key={currency} className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{currency}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{formatCurrency(Number(amount), currency)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
