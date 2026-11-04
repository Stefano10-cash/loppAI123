import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { formatDate, slugify } from '@/lib/utils';
import type { Store, Product } from '@/types';
import {
  Store as StoreIcon,
  Plus,
  Edit2,
  Trash2,
  Eye,
  Package,
  Upload,
  Globe,
  CheckCircle2,
  Circle,
} from 'lucide-react';

const PRESET_COLORS = [
  { name: 'Azul', value: '#2563eb' },
  { name: 'Roxo', value: '#7c3aed' },
  { name: 'Rosa', value: '#db2777' },
  { name: 'Vermelho', value: '#dc2626' },
  { name: 'Laranja', value: '#ea580c' },
  { name: 'Âmbar', value: '#d97706' },
  { name: 'Verde', value: '#16a34a' },
  { name: 'Esmeralda', value: '#059669' },
  { name: 'Turquesa', value: '#0d9488' },
  { name: 'Ciano', value: '#0891b2' },
  { name: 'Índigo', value: '#4f46e5' },
  { name: 'Cinzento', value: '#475569' },
];

interface StoreForm {
  name: string;
  slug: string;
  description: string;
  theme_color: string;
  logo_url: string;
  banner_url: string;
  is_published: boolean;
}

const emptyForm: StoreForm = {
  name: '',
  slug: '',
  description: '',
  theme_color: PRESET_COLORS[0].value,
  logo_url: '',
  banner_url: '',
  is_published: false,
};

export function StoresPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [stores, setStores] = useState<Store[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Store | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState<StoreForm>(emptyForm);

  const [previewStore, setPreviewStore] = useState<Store | null>(null);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);

    const { data: storeData } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const storeList = (storeData ?? []) as Store[];
    setStores(storeList);

    if (storeList.length > 0) {
      const { data: productData } = await supabase
        .from('products')
        .select('store_id')
        .in(
          'store_id',
          storeList.map((s) => s.id)
        );

      const counts: Record<string, number> = {};
      (productData ?? []).forEach((p) => {
        const sid = (p as { store_id: string | null }).store_id;
        if (sid) counts[sid] = (counts[sid] ?? 0) + 1;
      });
      setProductCounts(counts);
    } else {
      setProductCounts({});
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  function openCreate() {
    setEditing(null);
    setSlugEdited(false);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(store: Store) {
    setEditing(store);
    setSlugEdited(true);
    setForm({
      name: store.name,
      slug: store.slug,
      description: store.description,
      theme_color: store.theme_color,
      logo_url: store.logo_url,
      banner_url: store.banner_url,
      is_published: store.is_published,
    });
    setModalOpen(true);
  }

  function updateName(value: string) {
    setForm((prev) => ({
      ...prev,
      name: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
  }

  function updateSlug(value: string) {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, slug: slugify(value) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      theme_color: form.theme_color,
      logo_url: form.logo_url.trim(),
      banner_url: form.banner_url.trim(),
      is_published: form.is_published,
    };

    if (editing) {
      const { error } = await supabase.from('stores').update(payload).eq('id', editing.id);
      if (!error) {
        await addNotification({
          title: 'Loja atualizada',
          message: `"${form.name}" foi atualizada.`,
          type: 'success',
        });
      }
    } else {
      const { error } = await supabase.from('stores').insert(payload);
      if (!error) {
        await addNotification({
          title: 'Loja criada',
          message: `"${form.name}" foi criada com sucesso.`,
          type: 'success',
        });
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(store: Store) {
    if (!confirm(`Eliminar a loja "${store.name}"? Os produtos associados não serão removidos.`)) return;
    const { error } = await supabase.from('stores').delete().eq('id', store.id);
    if (!error) {
      await addNotification({
        title: 'Loja eliminada',
        message: `"${store.name}" foi eliminada.`,
        type: 'warning',
      });
      load();
    }
  }

  async function openPreview(store: Store) {
    setPreviewStore(store);
    setPreviewProducts([]);
    setPreviewLoading(true);

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .order('created_at', { ascending: false });

    setPreviewProducts((data ?? []) as Product[]);
    setPreviewLoading(false);
  }

  function closePreview() {
    setPreviewStore(null);
    setPreviewProducts([]);
  }

  const filtered = stores.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Lojas</h2>
          <p className="text-sm text-slate-500">Cria e gere as tuas lojas online.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Criar Loja
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <input
          type="text"
          placeholder="Pesquisar lojas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={StoreIcon}
            title="Nenhuma loja encontrada"
            description="Cria a tua primeira loja para organizar os teus produtos e começar a vender online."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Criar loja
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((store) => {
            const count = productCounts[store.id] ?? 0;
            return (
              <div
                key={store.id}
                className="group card overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {/* Banner / theme strip */}
                <div className="relative h-28 w-full overflow-hidden">
                  {store.banner_url ? (
                    <img
                      src={store.banner_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{
                        background: `linear-gradient(135deg, ${store.theme_color} 0%, ${store.theme_color}cc 100%)`,
                      }}
                    />
                  )}
                  {/* Logo */}
                  <div className="absolute -bottom-6 left-4 flex h-14 w-14 items-center justify-center rounded-xl border-2 border-white bg-white shadow-md">
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt=""
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <StoreIcon className="h-6 w-6 text-slate-400" />
                    )}
                  </div>
                  {/* Published badge */}
                  <div className="absolute right-3 top-3">
                    {store.is_published ? (
                      <span className="badge bg-green-500/90 text-white backdrop-blur-sm">
                        <CheckCircle2 className="h-3 w-3" />
                        Publicada
                      </span>
                    ) : (
                      <span className="badge bg-white/80 text-slate-600 backdrop-blur-sm">
                        <Circle className="h-3 w-3" />
                        Rascunho
                      </span>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 pb-4 pt-8">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="truncate font-semibold text-slate-900">{store.name}</h3>
                    <span
                      className="mt-1 h-4 w-4 shrink-0 rounded-full border border-slate-200"
                      style={{ backgroundColor: store.theme_color }}
                      title="Cor do tema"
                    />
                  </div>
                  <p className="mb-3 flex items-center gap-1 truncate text-xs text-slate-400">
                    <Globe className="h-3 w-3" />
                    /{store.slug}
                  </p>
                  <p className="mb-4 line-clamp-2 min-h-[2.5rem] text-sm text-slate-600">
                    {store.description || 'Sem descrição.'}
                  </p>

                  {/* Meta */}
                  <div className="mb-4 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {count} {count === 1 ? 'produto' : 'produtos'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span>{formatDate(store.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      onClick={() => openPreview(store)}
                      className="btn-ghost flex-1 justify-center text-xs"
                      title="Ver loja"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver loja
                    </button>
                    <button
                      onClick={() => openEdit(store)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(store)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Loja' : 'Criar Loja'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome da loja *</label>
              <input
                required
                value={form.name}
                onChange={(e) => updateName(e.target.value)}
                className="input"
                placeholder="Ex: Minha Loja Digital"
              />
            </div>
            <div>
              <label className="label">Slug (URL) *</label>
              <div className="flex items-center">
                <span className="inline-flex shrink-0 items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
                  /
                </span>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => updateSlug(e.target.value)}
                  className="input rounded-l-none"
                  placeholder="minha-loja-digital"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input min-h-[80px] resize-y"
              placeholder="Descreve a tua loja..."
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="label">Cor do tema</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setForm({ ...form, theme_color: color.value })}
                  title={color.name}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-all ${
                    form.theme_color === color.value
                      ? 'border-slate-900 scale-110'
                      : 'border-slate-200 hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.value }}
                >
                  {form.theme_color === color.value && (
                    <CheckCircle2 className="h-4 w-4 text-white drop-shadow" />
                  )}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span
                className="h-4 w-4 rounded-full border border-slate-200"
                style={{ backgroundColor: form.theme_color }}
              />
              {form.theme_color}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">URL do logótipo</label>
              <div className="relative">
                <Upload className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  className="input pl-10"
                  placeholder="https://..."
                />
              </div>
            </div>
            <div>
              <label className="label">URL do banner</label>
              <div className="relative">
                <Upload className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.banner_url}
                  onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                  className="input pl-10"
                  placeholder="https://..."
                />
              </div>
            </div>
          </div>

          {/* Published checkbox */}
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="block text-sm font-medium text-slate-900">Publicar loja</span>
              <span className="block text-xs text-slate-500">
                Lojas publicadas ficam visíveis publicamente.
              </span>
            </div>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Criar loja'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal
        open={previewStore !== null}
        onClose={closePreview}
        title="Pré-visualização da loja"
        size="xl"
      >
        {previewStore && (
          <div className="space-y-4">
            {/* Banner */}
            <div className="relative h-40 w-full overflow-hidden rounded-xl">
              {previewStore.banner_url ? (
                <img
                  src={previewStore.banner_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="h-full w-full"
                  style={{
                    background: `linear-gradient(135deg, ${previewStore.theme_color} 0%, ${previewStore.theme_color}cc 100%)`,
                  }}
                />
              )}
            </div>

            {/* Store header */}
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                {previewStore.logo_url ? (
                  <img
                    src={previewStore.logo_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <StoreIcon className="h-7 w-7 text-slate-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-lg font-bold text-slate-900">
                    {previewStore.name}
                  </h3>
                  {previewStore.is_published ? (
                    <span className="badge bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Publicada
                    </span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-600">Rascunho</span>
                  )}
                </div>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <Globe className="h-3 w-3" />/{previewStore.slug}
                </p>
              </div>
            </div>

            {/* Description */}
            {previewStore.description && (
              <p className="text-sm leading-relaxed text-slate-600">
                {previewStore.description}
              </p>
            )}

            {/* Products */}
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <Package className="h-4 w-4" />
                Produtos da loja
              </h4>

              {previewLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size={24} />
                </div>
              ) : previewProducts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">
                  Esta loja ainda não tem produtos.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {previewProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                        {product.cover_image_url ? (
                          <img
                            src={product.cover_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {product.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {product.category || 'Sem categoria'}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-slate-900">
                        {new Intl.NumberFormat('pt-PT', {
                          style: 'currency',
                          currency: product.currency,
                        }).format(Number(product.price))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={closePreview} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
