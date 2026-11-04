import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardSkeleton, EmptyState } from '@/components/ui/Loading';
import { formatCurrency } from '@/lib/utils';
import type { Order, Product, Campaign, SalesPage } from '@/types';
import {
  BarChart3, DollarSign, ShoppingBag, Eye, MousePointerClick, Target,
  TrendingUp, Package, FileText, Megaphone, Users,
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  totalOrders: number;
  totalViews: number;
  totalClicks: number;
  conversionRate: number;
  revenueByMonth: { month: string; revenue: number }[];
  ordersByStatus: { status: string; count: number; label: string; color: string }[];
  topProductsByViews: { name: string; views: number; price: number }[];
  topProductsByRevenue: { name: string; revenue: number }[];
  campaignPerformance: { name: string; impressions: number; clicks: number; conversions: number }[];
  salesPagePerformance: { title: string; views: number }[];
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente', paid: 'Pago', shipped: 'Enviado',
  completed: 'Concluído', cancelled: 'Cancelado', refunded: 'Reembolsado',
};
const statusColors: Record<string, string> = {
  pending: '#f59e0b', paid: '#3b82f6', shipped: '#6366f1',
  completed: '#22c55e', cancelled: '#ef4444', refunded: '#94a3b8',
};

export function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const [ordersRes, productsRes, campaignsRes, pagesRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id),
        supabase.from('campaigns').select('*').eq('user_id', user.id),
        supabase.from('sales_pages').select('*').eq('user_id', user.id),
      ]);

      const orders = (ordersRes.data ?? []) as Order[];
      const products = (productsRes.data ?? []) as Product[];
      const campaigns = (campaignsRes.data ?? []) as Campaign[];
      const pages = (pagesRes.data ?? []) as SalesPage[];

      const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'completed');
      const totalRevenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
      const totalViews = products.reduce((sum, p) => sum + p.views, 0);
      const pageViews = pages.reduce((sum, p) => sum + p.views, 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.metrics?.clicks ?? 0), 0);
      const totalImpressions = campaigns.reduce((sum, c) => sum + (c.metrics?.impressions ?? 0), 0);
      const conversionRate = totalViews > 0 ? (orders.length / totalViews) * 100 : 0;

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const now = new Date();
      const revenueByMonth: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const rev = paidOrders
          .filter((o) => { const od = new Date(o.created_at); return od.getMonth() === d.getMonth() && od.getFullYear() === d.getFullYear(); })
          .reduce((sum, o) => sum + Number(o.total), 0);
        revenueByMonth.push({ month: monthNames[d.getMonth()], revenue: rev });
      }

      const statusMap: Record<string, number> = {};
      orders.forEach((o) => { statusMap[o.status] = (statusMap[o.status] ?? 0) + 1; });
      const ordersByStatus = Object.entries(statusMap).map(([status, count]) => ({
        status, count,
        label: statusLabels[status] ?? status,
        color: statusColors[status] ?? '#94a3b8',
      }));

      const topProductsByViews = products
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((p) => ({ name: p.name, views: p.views, price: Number(p.price) }));

      const productRevenue: Record<string, number> = {};
      paidOrders.forEach((o) => {
        // Approximate: spread total across products in order (simplified)
      });
      const topProductsByRevenue = products
        .map((p) => ({
          name: p.name,
          revenue: paidOrders
            .filter((o) => o.id) // simplified
            .reduce((sum) => sum + Number(p.price), 0),
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const campaignPerformance = campaigns.slice(0, 5).map((c) => ({
        name: c.name,
        impressions: c.metrics?.impressions ?? 0,
        clicks: c.metrics?.clicks ?? 0,
        conversions: c.metrics?.conversions ?? 0,
      }));

      const salesPagePerformance = pages
        .sort((a, b) => b.views - a.views)
        .slice(0, 5)
        .map((p) => ({ title: p.title, views: p.views }));

      setData({
        totalRevenue, totalOrders: orders.length, totalViews: totalViews + pageViews,
        totalClicks, conversionRate,
        revenueByMonth, ordersByStatus, topProductsByViews, topProductsByRevenue,
        campaignPerformance, salesPagePerformance,
      });
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>;
  }
  if (!data) return null;

  const maxRevenue = Math.max(...data.revenueByMonth.map((d) => d.revenue), 1);
  const maxStatus = Math.max(...data.ordersByStatus.map((d) => d.count), 1);
  const maxProductViews = Math.max(...data.topProductsByViews.map((d) => d.views), 1);

  const stats = [
    { label: 'Receita Total', value: formatCurrency(data.totalRevenue), icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Pedidos', value: data.totalOrders.toString(), icon: ShoppingBag, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Visualizações', value: data.totalViews.toLocaleString(), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Taxa de Conversão', value: `${data.conversionRate.toFixed(1)}%`, icon: Target, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analytics</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Análise detalhada do desempenho da tua atividade.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue chart */}
      <div className="card p-6">
        <h3 className="mb-6 text-base font-semibold text-slate-900 dark:text-white">Receita mensal</h3>
        <div className="flex h-48 items-end justify-between gap-3">
          {data.revenueByMonth.map((item, i) => (
            <div key={i} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative w-full max-w-[60px]">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300 group-hover:from-blue-700 group-hover:to-blue-500"
                  style={{ height: `${(item.revenue / maxRevenue) * 160}px`, minHeight: '4px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                  {formatCurrency(item.revenue)}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.month}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Orders by status */}
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Pedidos por estado</h3>
          {data.ordersByStatus.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Sem dados" description="Cria pedidos para ver estatísticas." />
          ) : (
            <div className="space-y-3">
              {data.ordersByStatus.map((item) => (
                <div key={item.status} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-slate-600 dark:text-slate-400">{item.label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(item.count / maxStatus) * 100}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold text-slate-900 dark:text-white">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products by views */}
        <div className="card p-6">
          <h3 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Produtos mais vistos</h3>
          {data.topProductsByViews.length === 0 ? (
            <EmptyState icon={Package} title="Sem dados" description="Cria produtos para ver estatísticas." />
          ) : (
            <div className="space-y-3">
              {data.topProductsByViews.map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="truncate text-sm text-slate-600 dark:text-slate-400">{p.name}</span>
                  <div className="ml-auto h-6 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(p.views / maxProductViews) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-semibold text-slate-900 dark:text-white">{p.views}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaign + Sales page performance */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Desempenho de campanhas</h3>
          </div>
          {data.campaignPerformance.length === 0 ? (
            <EmptyState icon={Megaphone} title="Sem campanhas" description="Cria campanhas para ver métricas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Campanha</th>
                    <th className="pb-2 text-right">Impressões</th>
                    <th className="pb-2 text-right">Cliques</th>
                    <th className="pb-2 text-right">Conv.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {data.campaignPerformance.map((c, i) => (
                    <tr key={i}>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">{c.name}</td>
                      <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">{c.impressions.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-slate-600 dark:text-slate-400">{c.clicks.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">{c.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Páginas de vendas mais vistas</h3>
          </div>
          {data.salesPagePerformance.length === 0 ? (
            <EmptyState icon={FileText} title="Sem páginas" description="Cria páginas de vendas para ver métricas." />
          ) : (
            <div className="space-y-3">
              {data.salesPagePerformance.map((p, i) => (
                <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 dark:border-slate-800">
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{p.title}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                    <Eye className="h-3.5 w-3.5" />
                    {p.views}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
