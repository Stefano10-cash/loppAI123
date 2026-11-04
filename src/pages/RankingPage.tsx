import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardSkeleton, EmptyState } from '@/components/ui/Loading';
import { formatCurrency, convertCurrency } from '@/lib/utils';
import type { Order, Product, Profile } from '@/types';
import { Trophy, Crown, Medal, Award, TrendingUp, Package, ShoppingBag } from 'lucide-react';

interface SellerStats {
  userId: string;
  name: string;
  avatarUrl: string;
  totalRevenueAOA: number;
  orderCount: number;
  productCount: number;
  topProductName: string;
}

export function RankingPage() {
  const { user } = useAuth();
  const [ranking, setRanking] = useState<SellerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'year' | 'all'>('month');

  useEffect(() => {
    async function load() {
      if (!user) return;
      setLoading(true);

      const now = new Date();
      let startDate: Date;
      if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else {
        startDate = new Date(2000, 0, 1);
      }

      const [ordersRes, productsRes, profilesRes] = await Promise.all([
        supabase.from('orders').select('*').gte('created_at', startDate.toISOString()).order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const allOrders = (ordersRes.data ?? []) as Order[];
      const allProducts = (productsRes.data ?? []) as Product[];
      const allProfiles = (profilesRes.data ?? []) as Profile[];

      const paidOrders = allOrders.filter((o) => o.status === 'paid' || o.status === 'completed');

      const byUser: Record<string, { orders: Order[]; productIds: Set<string> }> = {};
      for (const o of paidOrders) {
        if (!byUser[o.user_id]) byUser[o.user_id] = { orders: [], productIds: new Set() };
        byUser[o.user_id].orders.push(o);
      }
      for (const p of allProducts) {
        if (!byUser[p.user_id]) byUser[p.user_id] = { orders: [], productIds: new Set() };
        byUser[p.user_id].productIds.add(p.id);
      }

      const stats: SellerStats[] = Object.entries(byUser).map(([userId, data]) => {
        const profile = allProfiles.find((p) => p.id === userId);
        const userProducts = allProducts.filter((p) => p.user_id === userId);
        const revenue = data.orders.reduce(
          (sum, o) => sum + convertCurrency(Number(o.total), (o.currency || 'AOA'), 'AOA'),
          0,
        );

        const productRevenue: Record<string, number> = {};
        for (const o of data.orders) {
          productRevenue[o.id] = (productRevenue[o.id] ?? 0) + convertCurrency(Number(o.total), (o.currency || 'AOA'), 'AOA');
        }

        const topProduct = userProducts[0]?.name ?? '—';

        return {
          userId,
          name: profile?.full_name || profile?.company || 'Vendedor',
          avatarUrl: profile?.avatar_url ?? '',
          totalRevenueAOA: revenue,
          orderCount: data.orders.length,
          productCount: userProducts.length,
          topProductName: topProduct,
        };
      });

      stats.sort((a, b) => b.totalRevenueAOA - a.totalRevenueAOA);
      setRanking(stats.slice(0, 50));
      setLoading(false);
    }
    load();
  }, [user, period]);

  const periodLabels: Record<typeof period, string> = {
    month: 'Este mês',
    year: 'Este ano',
    all: 'Todo o tempo',
  };

  const podiumIcons = [Crown, Medal, Award];
  const podiumColors = [
    'from-amber-400 to-amber-600',
    'from-slate-300 to-slate-500',
    'from-orange-400 to-orange-600',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ranking de Vendedores</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Os melhores vendedores da plataforma LoppAI.</p>
        </div>
        <div className="flex gap-2">
          {(['month', 'year', 'all'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
          <div className="card p-6"><CardSkeleton /></div>
        </div>
      ) : ranking.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={Trophy}
            title="Sem dados suficientes"
            description="Ainda não há vendas registadas no período selecionado. O ranking aparecerá assim que houver vendas."
          />
        </div>
      ) : (
        <>
          {ranking.length >= 3 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {ranking.slice(0, 3).map((seller, index) => {
                const Icon = podiumIcons[index];
                const gradient = podiumColors[index];
                return (
                  <div
                    key={seller.userId}
                    className={`card relative overflow-hidden p-6 text-center ${
                      index === 0 ? 'sm:order-2 sm:-translate-y-2' : index === 1 ? 'sm:order-1' : 'sm:order-3'
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${gradient}`} />
                    <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-7 w-7 text-white" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {index === 0 ? '1º Lugar' : index === 1 ? '2º Lugar' : '3º Lugar'}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      {seller.avatarUrl ? (
                        <img src={seller.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : null}
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{seller.name}</p>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                      {formatCurrency(seller.totalRevenueAOA, 'AOA')}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5" />{seller.orderCount} vendas</span>
                      <span className="flex items-center gap-1"><Package className="h-3.5 w-3.5" />{seller.productCount} produtos</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Classificação completa</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                    <th className="px-6 py-3 font-medium">#</th>
                    <th className="px-6 py-3 font-medium">Vendedor</th>
                    <th className="px-6 py-3 font-medium">Receita (AOA)</th>
                    <th className="px-6 py-3 font-medium">Vendas</th>
                    <th className="px-6 py-3 font-medium">Produtos</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((seller, index) => {
                    const isCurrentUser = seller.userId === user?.id;
                    return (
                      <tr
                        key={seller.userId}
                        className={`border-b border-slate-50 last:border-0 dark:border-slate-800/50 ${
                          isCurrentUser ? 'bg-blue-50/50 dark:bg-blue-500/5' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            index < 3
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            {seller.avatarUrl ? (
                              <img src={seller.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  {seller.name.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">
                                {seller.name}
                                {isCurrentUser && <span className="ml-1.5 text-xs text-blue-600 dark:text-blue-400">(tu)</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                            {formatCurrency(seller.totalRevenueAOA, 'AOA')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{seller.orderCount}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{seller.productCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
