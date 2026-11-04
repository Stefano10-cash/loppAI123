import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Purchase, Product } from '@/types';
import { BookOpen, Package, Download, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';

export function StudentLibraryPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<(Purchase & { product?: Product })[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('purchases')
      .select(`
        *,
        product:products(*)
      `)
      .eq('buyer_id', user.id)
      .eq('payment_status', 'paid')
      .order('purchased_at', { ascending: false });

    setPurchases((data ?? []) as (Purchase & { product?: Product })[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">A minha biblioteca</h2>
            <p className="mt-0.5 text-sm text-emerald-100">
              Os produtos que compraste estão aqui. Acede ao conteúdo quando quiseres.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{purchases.length}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Produtos comprados</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {purchases.filter((p) => p.product?.type === 'ebook').length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ebooks</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {formatCurrency(purchases.reduce((sum, p) => sum + Number(p.amount), 0), purchases[0]?.currency ?? 'AOA')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total investido</p>
            </div>
          </div>
        </div>
      </div>

      {/* Purchases grid */}
      {purchases.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Ainda não compraste produtos"
          description="Explora o marketplace e encontra produtos digitais, ebooks e cursos para comprar."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {purchases.map((purchase) => {
            const product = purchase.product;
            if (!product) return null;
            return (
              <div
                key={purchase.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {product.cover_image_url ? (
                    <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 rounded-full bg-green-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                    Pago
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{product.name}</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{product.category || product.type}</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    Comprado em {formatDate(purchase.purchased_at)}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {formatCurrency(Number(purchase.amount), purchase.currency)}
                    </span>
                    <span className="text-xs text-slate-500 capitalize dark:text-slate-400">{purchase.payment_method.replace(/_/g, ' ')}</span>
                  </div>
                  {product.file_url && (
                    <a
                      href={product.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                    >
                      {product.type === 'ebook' ? <BookOpen className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                      {product.type === 'ebook' ? 'Ler agora' : 'Descarregar'}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
