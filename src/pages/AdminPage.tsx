import { useEffect, useState } from 'react';
import { ArrowLeft, CreditCard, LayoutDashboard, Link2, Package, ShieldAlert, Users, type LucideIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminPayments } from '@/components/admin/AdminPayments';
import { AdminCustomers } from '@/components/admin/AdminCustomers';
import { AdminPlans } from '@/components/admin/AdminPlans';
import { AdminCheckouts } from '@/components/admin/AdminCheckouts';
import { cn } from '@/lib/utils';

type AdminTab = 'dashboard' | 'payments' | 'customers' | 'plans' | 'checkouts';

const TABS: { id: AdminTab; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'payments', label: 'Pagamentos', icon: CreditCard },
  { id: 'customers', label: 'Clientes', icon: Users },
  { id: 'plans', label: 'Planos', icon: Package },
  { id: 'checkouts', label: 'Checkouts', icon: Link2 },
];

export function AdminPage({ onExit }: { onExit: () => void }) {
  const { user } = useAuth();
  const [access, setAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [tab, setTab] = useState<AdminTab>('dashboard');

  useEffect(() => {
    let active = true;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!active) return;
      setAccess(!error && data === true ? 'allowed' : 'denied');
    });
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (access === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner size={32} className="text-blue-600" />
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <ShieldAlert className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Acesso restrito</h1>
          <p className="mt-2 text-sm text-slate-600">Esta área é exclusiva da administração da LoppAI.</p>
          <button
            onClick={onExit}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar à aplicação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
              <ShieldAlert className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Painel administrativo</p>
              <p className="text-xs text-slate-500">LoppAI</p>
            </div>
          </div>
          <button
            onClick={onExit}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar à aplicação
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 scrollbar-thin">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'payments' && <AdminPayments />}
        {tab === 'customers' && <AdminCustomers />}
        {tab === 'plans' && <AdminPlans />}
        {tab === 'checkouts' && <AdminCheckouts />}
      </main>
    </div>
  );
}
