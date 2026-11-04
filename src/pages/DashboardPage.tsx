import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { CardSkeleton, EmptyState } from '@/components/ui/Loading';
import { formatCurrency, timeAgo, convertCurrency } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/ui/Badges';
import { Package, ShoppingBag, DollarSign, Eye, TrendingUp, ArrowUpRight, Plus, Megaphone } from 'lucide-react';
import type { PageId } from '@/config/navigation';
import type { Order, Product } from '@/types';

interface DashboardData {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalViews: number;
  recentOrders: Order[];
  topProducts: Product[];
  revenueByMonth: { month: string; revenue: number }[];
}

export function DashboardPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const [ordersRes, productsRes] = await Promise.all([
        supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('user_id', user.id).order('views', { ascending: false }),
      ]);

      const orders = (ordersRes.data ?? []) as Order[];
      const products = (productsRes.data ?? []) as Product[];

      const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'completed');
      const totalRevenue = paidOrders.reduce(
        (sum, o) => sum + convertCurrency(Number(o.total), (o.currency || 'AOA'), 'AOA'),
        0,
      );

      const totalViews = products.reduce((sum, p) => sum + p.views, 0);

      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const now = new Date();
      const revenueByMonth: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthRevenue = paidOrders
          .filter((o) => {
            const od = new Date(o.created_at);
            return od.getMonth() === d.getMonth() &&
              od.getFullYear() === d.getFullYear();
          })
          .reduce((sum, o) => sum + convertCurrency(Number(o.total), (o.currency || 'AOA'), 'AOA'), 0);
        revenueByMonth.push({ month: monthNames[d.getMonth()], revenue: monthRevenue });
      }

      setData({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalViews,
        recentOrders: orders.slice(0, 5),
        topProducts: products.slice(0, 5),
        revenueByMonth,
      });
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  if (!data) return null;

  const stats = [
    { label: 'Receita Total', value: formatCurrency(data.totalRevenue, 'AOA'), icon: DollarSign, color: 'bg-green-500', trend: '+12.5%' },
    { label: 'Pedidos', value: data.totalOrders.toString(), icon: ShoppingBag, color: 'bg-blue-500', trend: '+8.2%' },
    { label: 'Produtos', value: data.totalProducts.toString(), icon: Package, color: 'bg-orange-500', trend: `${data.totalProducts} ativos` },
    { label: 'Visualizações', value: data.totalViews.toString(), icon: Eye, color: 'bg-purple-500', trend: '+23.1%' },
  ];

  const maxRevenue = Math.max(...data.revenueByMonth.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 p-6 text-white">
        <div className="relative z-10">
          <h2 className="text-xl font-bold">Bem-vindo ao LoppAI</h2>
          <p className="mt-1 text-sm text-blue-100">
            Aqui está o resumo da tua atividade. Cria produtos, lojas e campanhas para crescer o teu negócio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => onNavigate('products')}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-all hover:bg-white/20"
            >
              <Plus className="h-4 w-4" />
              Novo Produto
            </button>
            <button
              onClick={() => onNavigate('ebooks')}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-all hover:bg-white/20"
            >
              <Plus className="h-4 w-4" />
              Criar Ebook
            </button>
            <button
              onClick={() => onNavigate('campaigns')}
              className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2 text-sm font-medium text-white backdrop-blur transition-all hover:bg-white/20"
            >
              <Megaphone className="h-4 w-4" />
              Nova Campanha
            </button>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-12 right-20 h-32 w-32 rounded-full bg-blue-400/20 blur-2xl" />
      </div>

      {/* Stats grid */}
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
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.color}/10`}>
                  <Icon className="h-5 w-5" style={{ color: stat.color.replace('bg-', '').replace('-500', '') }} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="font-medium text-green-600">{stat.trend}</span>
                <span className="text-slate-400 dark:text-slate-500">vs. mês anterior</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue chart */}
      <div className="card p-6">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Receita dos últimos 6 meses</h3>
          <button
            onClick={() => onNavigate('orders')}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Ver pedidos <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex h-48 items-end justify-between gap-3">
          {data.revenueByMonth.map((item, i) => (
            <div key={i} className="group flex flex-1 flex-col items-center gap-2">
              <div className="relative w-full max-w-[60px]">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-300 group-hover:from-blue-700 group-hover:to-blue-500"
                  style={{ height: `${(item.revenue / maxRevenue) * 160}px`, minHeight: '4px' }}
                />
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {formatCurrency(item.revenue, 'AOA')}
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: recent orders + top products */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Pedidos recentes</h3>
            <button
              onClick={() => onNavigate('orders')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Ver todos
            </button>
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Sem pedidos"
              description="Os pedidos dos teus clientes aparecem aqui."
            />
          ) : (
            <div className="space-y-3">
              {data.recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{order.customer_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(order.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(convertCurrency(Number(order.total), (order.currency || 'AOA'), 'AOA'), 'AOA')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Produtos mais vistos</h3>
            <button
              onClick={() => onNavigate('products')}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Ver todos
            </button>
          </div>
          {data.topProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sem produtos"
              description="Cria o teu primeiro produto para começar a vender."
              action={
                <button onClick={() => onNavigate('products')} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Criar produto
                </button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data.topProducts.map((product) => (
                <div key={product.id} className="flex items-center gap-3 border-b border-slate-50 pb-3 last:border-0 dark:border-slate-800">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    {product.cover_image_url ? (
                      <img src={product.cover_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <Package className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{product.name}</p>
                    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Eye className="h-3 w-3" />
                      {product.views} visualizações
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(convertCurrency(Number(product.price), (product.currency || 'AOA'), 'AOA'), 'AOA')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
