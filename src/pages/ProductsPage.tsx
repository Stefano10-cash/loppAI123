import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { ProductStatusBadge, ProductTypeBadge } from '@/components/ui/Badges';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Product, ProductType, ProductStatus, Store } from '@/types';
import { Package, Plus, Search, Edit2, Trash2, Eye, Upload, FileText, ImageIcon, Loader2, CreditCard, Wallet, Smartphone, Building2, Nfc, Link2, Copy, Check, Share2, X } from 'lucide-react';

const PAYMENT_METHOD_OPTIONS = [
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2 },
  { id: 'visa', label: 'Visa', icon: CreditCard },
  { id: 'mastercard', label: 'Mastercard', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
  { id: 'google_pay', label: 'Google Pay', icon: Smartphone },
  { id: 'apple_pay', label: 'Apple Pay', icon: Nfc },
  { id: 'pix', label: 'Pix', icon: Smartphone },
];

const CURRENCY_OPTIONS = [
  { code: 'AOA', flag: '🇦🇴' },
  { code: 'EUR', flag: '🇪🇺' },
  { code: 'USD', flag: '🇺🇸' },
  { code: 'BRL', flag: '🇧🇷' },
];

export function ProductsPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | ProductType>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlProduct, setUrlProduct] = useState<Product | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'digital' as ProductType,
    price: 0,
    currency: 'AOA',
    cover_image_url: '',
    file_url: '',
    stock: '',
    category: '',
    tags: '',
    status: 'draft' as ProductStatus,
    store_id: '',
    payment_methods: ['multicaixa_express'] as string[],
    accepted_currencies: ['AOA'] as string[],
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const [prodRes, storeRes] = await Promise.all([
      supabase.from('products').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('stores').select('*').eq('user_id', user.id),
    ]);
    setProducts((prodRes.data ?? []) as Product[]);
    setStores((storeRes.data ?? []) as Store[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', description: '', type: 'digital', price: 0, currency: 'AOA', cover_image_url: '', file_url: '', stock: '', category: '', tags: '', status: 'draft', store_id: '', payment_methods: ['multicaixa_express'], accepted_currencies: ['AOA'] });
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      description: product.description,
      type: product.type,
      price: Number(product.price),
      currency: product.currency,
      cover_image_url: product.cover_image_url,
      file_url: product.file_url,
      stock: product.stock?.toString() ?? '',
      category: product.category,
      tags: product.tags.join(', '),
      status: product.status,
      store_id: product.store_id ?? '',
      payment_methods: product.payment_methods ?? ['multicaixa_express'],
      accepted_currencies: product.accepted_currencies ?? ['AOA'],
    });
    setModalOpen(true);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-files')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, file_url: urlData.publicUrl }));

      // If it's a PDF, try to extract first page as cover
      if (file.type === 'application/pdf') {
        // Create cover from PDF using canvas
        const fileUrl = URL.createObjectURL(file);
        setForm((prev) => ({ ...prev, file_url: urlData.publicUrl, cover_image_url: prev.cover_image_url || '' }));

        // Store the PDF filename for reference
        await addNotification({
          title: 'Ficheiro carregado',
          message: `"${file.name}" foi carregado. A capa pode ser gerada automaticamente.`,
          type: 'success',
        });
        URL.revokeObjectURL(fileUrl);
      } else if (file.type.startsWith('image/')) {
        // If it's an image, set it as cover
        const coverFileName = `${user.id}/covers/${crypto.randomUUID()}.${fileExt}`;
        const { error: coverError } = await supabase.storage
          .from('product-files')
          .upload(coverFileName, file);

        if (!coverError) {
          const { data: coverUrlData } = supabase.storage
            .from('product-files')
            .getPublicUrl(coverFileName);
          setForm((prev) => ({ ...prev, cover_image_url: coverUrlData.publicUrl }));
        }

        await addNotification({
          title: 'Imagem carregada',
          message: `"${file.name}" foi definida como capa do produto.`,
          type: 'success',
        });
      }
    } catch (err) {
      await addNotification({
        title: 'Erro ao carregar ficheiro',
        message: 'Não foi possível carregar o ficheiro. Tenta novamente.',
        type: 'error',
      });
    }
    setUploading(false);
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/covers/${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('product-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('product-files')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, cover_image_url: urlData.publicUrl }));

      await addNotification({
        title: 'Capa carregada',
        message: 'A capa do produto foi atualizada.',
        type: 'success',
      });
    } catch (err) {
      await addNotification({
        title: 'Erro ao carregar capa',
        message: 'Não foi possível carregar a capa. Tenta novamente.',
        type: 'error',
      });
    }
    setUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      name: form.name,
      description: form.description,
      type: form.type,
      price: Number(form.price),
      currency: form.currency,
      cover_image_url: form.cover_image_url,
      file_url: form.file_url,
      stock: form.stock ? parseInt(form.stock) : null,
      category: form.category,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      status: form.status,
      store_id: form.store_id || null,
      payment_methods: form.payment_methods,
      accepted_currencies: form.accepted_currencies,
    };

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (!error) {
        await addNotification({ title: 'Produto atualizado', message: `"${form.name}" foi atualizado.`, type: 'success' });
      }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (!error) {
        await addNotification({ title: 'Produto criado', message: `"${form.name}" foi criado com sucesso.`, type: 'success' });
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(product: Product) {
    if (!confirm(`Eliminar "${product.name}"?`)) return;
    await supabase.from('products').delete().eq('id', product.id);
    await addNotification({ title: 'Produto eliminado', message: `"${product.name}" foi eliminado.`, type: 'warning' });
    load();
  }

  const filtered = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || p.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Produtos</h2>
          <p className="text-sm text-slate-500">Gere os teus produtos digitais, físicos e ebooks.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Novo Produto
        </button>
      </div>

      {/* Filters */}
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
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'all' | ProductType)}
          className="input sm:w-48"
        >
          <option value="all">Todos os tipos</option>
          <option value="digital">Digital</option>
          <option value="physical">Físico</option>
          <option value="ebook">Ebook</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum produto encontrado"
            description="Cria o teu primeiro produto digital, físico ou ebook para começar a vender."
            action={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Criar produto</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Preço</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Vistas</th>
                  <th className="px-5 py-3">Criado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                          {product.cover_image_url ? (
                            <img src={product.cover_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          ) : (
                            <Package className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{product.name}</p>
                          <p className="truncate text-xs text-slate-500">{product.category || 'Sem categoria'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><ProductTypeBadge type={product.type} /></td>
                    <td className="px-5 py-3 font-medium text-slate-900">{formatCurrency(Number(product.price), product.currency)}</td>
                    <td className="px-5 py-3"><ProductStatusBadge status={product.status} /></td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Eye className="h-3.5 w-3.5" />
                        {product.views}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(product.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setUrlProduct(product)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="URLs do produto">
                          <Share2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEdit(product)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(product)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Produto' : 'Novo Produto'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome do produto *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ex: Curso de Marketing Digital" />
            </div>
            <div>
              <label className="label">Tipo *</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ProductType })} className="input">
                <option value="digital">Digital</option>
                <option value="physical">Físico</option>
                <option value="ebook">Ebook</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px] resize-y" placeholder="Descreve o teu produto..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Preço *</label>
              <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Moeda</label>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input">
                <option value="AOA">Kwanza Angolano (Kz)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dólar ($)</option>
                <option value="BRL">Real (R$)</option>
              </select>
            </div>
            <div>
              <label className="label">Stock {form.type === 'physical' ? '*' : '(opcional)'}</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" placeholder="Ilimitado" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Categoria</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" placeholder="Ex: Marketing" />
            </div>
            <div>
              <label className="label">Tags (separadas por vírgula)</label>
              <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="input" placeholder="marketing, digital, curso" />
            </div>
          </div>

          {/* File upload section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Carregar ficheiro do telemóvel (PDF, imagem)
            </label>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Seleciona um ficheiro do teu telemóvel. PDFs são extraídos automaticamente e imagens podem ser usadas como capa.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* File upload */}
              <div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-400 dark:hover:bg-blue-500/10">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  ) : (
                    <FileText className="h-6 w-6 text-slate-400" />
                  )}
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {form.file_url ? 'Ficheiro carregado ✓' : 'Carregar PDF ou ficheiro'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.epub,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Cover upload */}
              <div>
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white p-4 text-center transition-colors hover:border-blue-500 hover:bg-blue-50/50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-400 dark:hover:bg-blue-500/10">
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                  ) : form.cover_image_url ? (
                    <img src={form.cover_image_url} alt="Capa" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    {form.cover_image_url ? 'Capa definida ✓' : 'Carregar imagem de capa'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Manual URL fields */}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">URL da capa (manual)</label>
                <div className="relative">
                  <Upload className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} className="input pl-10" placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="label">URL do ficheiro (manual)</label>
                <input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} className="input" placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Loja</label>
              <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
                <option value="">Sem loja</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })} className="input">
                <option value="draft">Rascunho</option>
                <option value="published">Publicado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          {/* Payment methods and currencies */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/30">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Métodos de pagamento aceites
            </label>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Seleciona como os compradores podem pagar este produto.
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PAYMENT_METHOD_OPTIONS.map((method) => (
                <label
                  key={method.id}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-xs font-medium transition-all ${
                    form.payment_methods.includes(method.id)
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.payment_methods.includes(method.id)}
                    onChange={() => {
                      setForm((prev) => ({
                        ...prev,
                        payment_methods: prev.payment_methods.includes(method.id)
                          ? prev.payment_methods.filter((m) => m !== method.id)
                          : [...prev.payment_methods, method.id],
                      }));
                    }}
                  />
                  <method.icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{method.label}</span>
                </label>
              ))}
            </div>

            <label className="mt-4 mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Moedas aceites
            </label>
            <div className="flex flex-wrap gap-2">
              {CURRENCY_OPTIONS.map((c) => (
                <label
                  key={c.code}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    form.accepted_currencies.includes(c.code)
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={form.accepted_currencies.includes(c.code)}
                    onChange={() => {
                      setForm((prev) => ({
                        ...prev,
                        accepted_currencies: prev.accepted_currencies.includes(c.code)
                          ? prev.accepted_currencies.filter((m) => m !== c.code)
                          : [...prev.accepted_currencies, c.code],
                      }));
                    }}
                  />
                  <span>{c.flag}</span>
                  <span>{c.code}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Criar produto'}
            </button>
          </div>
        </form>
      </Modal>

      {/* URLs Modal */}
      {urlProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setUrlProduct(null)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">URLs do produto</h3>
              </div>
              <button onClick={() => setUrlProduct(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              {(() => {
                const baseUrl = window.location.origin;
                const productUrl = `${baseUrl}/#/product/${urlProduct.id}`;
                const checkoutUrl = `${baseUrl}/#/checkout/${urlProduct.id}`;
                const paymentUrl = `${baseUrl}/#/pay/${urlProduct.id}`;
                const urls = [
                  { label: 'URL do produto', url: productUrl, desc: 'Página pública do produto' },
                  { label: 'URL de checkout', url: checkoutUrl, desc: 'Página de checkout para compra' },
                  { label: 'URL de pagamento', url: paymentUrl, desc: 'Página direta de pagamento' },
                ];
                return urls.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.url);
                          setCopiedUrl(item.label);
                          setTimeout(() => setCopiedUrl(null), 2000);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                          copiedUrl === item.label
                            ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                        }`}
                      >
                        {copiedUrl === item.label ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedUrl === item.label ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                    <div className="mt-2 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {item.url}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
