import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';
import { CheckoutPage } from './CheckoutPage';
import { Search, Package, Eye, ArrowRight, CreditCard, Wallet, Building2, Smartphone, Store } from 'lucide-react';

const METHOD_ICONS: Record<string, typeof CreditCard> = {
  multicaixa_express: Building2,
  visa: CreditCard,
  mastercard: CreditCard,
  paypal: Wallet,
  google_pay: Smartphone,
  apple_pay: Smartphone,
  pix: Smartphone,
};

export function BuyerMarketPage() {
  const { user } = useAuth();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('status', 'published')
      .order('views', { ascending: false });
    setAllProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  const products = tab === 'mine' ? allProducts.filter((p) => p.user_id === user?.id) : allProducts;
  const categories = Array.from(new Set(allProducts.map((p) => p.category).filter(Boolean)));

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (checkoutProduct) {
    return <CheckoutPage product={checkoutProduct} onBack={() => { setCheckoutProduct(null); load(); }} />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Store className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Marketplace</h2>
            <p className="mt-0.5 text-sm text-blue-100">
              Explora produtos digitais, ebooks e cursos de todos os vendedores do LoppAI, incluindo os teus.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'all' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          Todos os produtos ({allProducts.length})
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === 'mine' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
        >
          Os meus produtos ({allProducts.filter((p) => p.user_id === user?.id).length})
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input sm:w-48">
          <option value="all">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={tab === 'mine' ? 'Não tens produtos publicados' : 'Nenhum produto encontrado'}
          description={tab === 'mine' ? 'Publica os teus produtos para os veres no marketplace.' : 'Ainda não há produtos publicados. Volta mais tarde!'}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const isOwn = product.user_id === user?.id;
            return (
              <div
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-slate-800">
                  {product.cover_image_url ? (
                    <img src={product.cover_image_url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package className="h-12 w-12 text-slate-300" />
                    </div>
                  )}
                  <div className="absolute right-2 top-2 flex gap-1.5">
                    <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur">
                      {product.type}
                    </span>
                    {isOwn && (
                      <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
                        Teu
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-white">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{product.description || product.category}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      <Eye className="mr-1 inline h-3 w-3" />{product.views}
                    </span>
                    {product.payment_methods?.slice(0, 3).map((m) => {
                      const Icon = METHOD_ICONS[m] ?? CreditCard;
                      return <Icon key={m} className="h-3.5 w-3.5 text-slate-400" />;
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                      {formatCurrency(Number(product.price), product.currency)}
                    </span>
                  </div>

                  <button
                    onClick={() => setCheckoutProduct(product)}
                    className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all active:scale-[0.98] ${
                      isOwn
                        ? 'bg-slate-400 hover:bg-slate-500'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isOwn ? 'Ver produto' : 'Comprar'} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
