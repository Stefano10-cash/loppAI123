import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { formatDate, slugify, generateId } from '@/lib/utils';
import type { SalesPage, SalesPageBlock, Product, Store } from '@/types';
import {
  FileText, Plus, Search, Edit2, Trash2, Eye, Type, AlignLeft,
  Image as ImageIcon, ListChecks, MessageSquare, MousePointerClick, Trash,
} from 'lucide-react';

const blockTypes: { type: SalesPageBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'heading', label: 'Título', icon: Type },
  { type: 'paragraph', label: 'Parágrafo', icon: AlignLeft },
  { type: 'image', label: 'Imagem', icon: ImageIcon },
  { type: 'features', label: 'Features', icon: ListChecks },
  { type: 'testimonial', label: 'Testemunho', icon: MessageSquare },
  { type: 'cta', label: 'Call-to-Action', icon: MousePointerClick },
];

interface SPForm {
  title: string;
  slug: string;
  product_id: string;
  store_id: string;
  headline: string;
  subheadline: string;
  hero_image_url: string;
  cta_text: string;
  is_published: boolean;
  blocks: SalesPageBlock[];
}

const emptyForm: SPForm = {
  title: '',
  slug: '',
  product_id: '',
  store_id: '',
  headline: '',
  subheadline: '',
  hero_image_url: '',
  cta_text: 'Comprar Agora',
  is_published: false,
  blocks: [],
};

export function SalesPagesPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [pages, setPages] = useState<SalesPage[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesPage | null>(null);
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [previewPage, setPreviewPage] = useState<SalesPage | null>(null);
  const [form, setForm] = useState<SPForm>(emptyForm);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [spRes, prodRes, storeRes] = await Promise.all([
      supabase.from('sales_pages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('user_id', user.id),
      supabase.from('stores').select('*').eq('user_id', user.id),
    ]);
    setPages((spRes.data ?? []) as SalesPage[]);
    setProducts((prodRes.data ?? []) as Product[]);
    setStores((storeRes.data ?? []) as Store[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function openCreate() {
    setEditing(null);
    setSlugEdited(false);
    setForm({ ...emptyForm, blocks: [] });
    setModalOpen(true);
  }

  function openEdit(page: SalesPage) {
    setEditing(page);
    setSlugEdited(true);
    setForm({
      title: page.title,
      slug: page.slug,
      product_id: page.product_id ?? '',
      store_id: page.store_id ?? '',
      headline: page.headline,
      subheadline: page.subheadline,
      hero_image_url: page.hero_image_url,
      cta_text: page.cta_text,
      is_published: page.is_published,
      blocks: page.body_content ?? [],
    });
    setModalOpen(true);
  }

  function updateTitle(value: string) {
    setForm((f) => ({ ...f, title: value, slug: slugEdited ? f.slug : slugify(value) }));
  }

  function addBlock(type: SalesPageBlock['type']) {
    setForm((f) => ({
      ...f,
      blocks: [...f.blocks, { id: generateId(), type, content: '', data: {} }],
    }));
  }

  function updateBlock(id: string, content: string) {
    setForm((f) => ({
      ...f,
      blocks: f.blocks.map((b) => (b.id === id ? { ...b, content } : b)),
    }));
  }

  function removeBlock(id: string) {
    setForm((f) => ({ ...f, blocks: f.blocks.filter((b) => b.id !== id) }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      product_id: form.product_id || null,
      store_id: form.store_id || null,
      headline: form.headline,
      subheadline: form.subheadline,
      hero_image_url: form.hero_image_url,
      cta_text: form.cta_text,
      is_published: form.is_published,
      body_content: form.blocks,
    };

    if (editing) {
      const { error } = await supabase.from('sales_pages').update(payload).eq('id', editing.id);
      if (!error) await addNotification({ title: 'Página atualizada', message: `"${form.title}" foi atualizada.`, type: 'success' });
    } else {
      const { error } = await supabase.from('sales_pages').insert(payload);
      if (!error) await addNotification({ title: 'Página criada', message: `"${form.title}" foi criada.`, type: 'success' });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(page: SalesPage) {
    if (!confirm(`Eliminar a página "${page.title}"?`)) return;
    await supabase.from('sales_pages').delete().eq('id', page.id);
    await addNotification({ title: 'Página eliminada', message: `"${page.title}" foi eliminada.`, type: 'warning' });
    load();
  }

  const filtered = pages.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Páginas de Vendas</h2>
          <p className="text-sm text-slate-500">Cria páginas de vendas personalizadas para os teus produtos.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Nova Página
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Pesquisar páginas..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhuma página encontrada"
            description="Cria a tua primeira página de vendas para aumentar a conversão dos teus produtos."
            action={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Criar página</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Página</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Vistas</th>
                  <th className="px-5 py-3">Criado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((page) => {
                  const product = products.find((p) => p.id === page.product_id);
                  return (
                    <tr key={page.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-900">{page.title}</p>
                        <p className="text-xs text-slate-500">/{page.slug}</p>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{product?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`badge ${page.is_published ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                          {page.is_published ? 'Publicada' : 'Rascunho'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-slate-600">
                          <Eye className="h-3.5 w-3.5" />
                          {page.views}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{formatDate(page.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setPreviewPage(page)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => openEdit(page)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(page)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Editor Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Página' : 'Nova Página de Vendas'} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Basic info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Título *</label>
              <input required value={form.title} onChange={(e) => updateTitle(e.target.value)} className="input" placeholder="Ex: Curso de Marketing" />
            </div>
            <div>
              <label className="label">Slug (URL)</label>
              <input value={form.slug} onChange={(e) => { setSlugEdited(true); setForm((f) => ({ ...f, slug: slugify(e.target.value) })); }} className="input" placeholder="curso-de-marketing" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Produto associado</label>
              <select value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} className="input">
                <option value="">Sem produto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Loja</label>
              <select value={form.store_id} onChange={(e) => setForm((f) => ({ ...f, store_id: e.target.value }))} className="input">
                <option value="">Sem loja</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Headline principal</label>
            <input value={form.headline} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} className="input" placeholder="A headline que vai capturar a atenção" />
          </div>

          <div>
            <label className="label">Subheadline</label>
            <input value={form.subheadline} onChange={(e) => setForm((f) => ({ ...f, subheadline: e.target.value }))} className="input" placeholder="Uma frase de apoio à headline" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">URL da imagem hero</label>
              <input value={form.hero_image_url} onChange={(e) => setForm((f) => ({ ...f, hero_image_url: e.target.value }))} className="input" placeholder="https://..." />
            </div>
            <div>
              <label className="label">Texto do botão (CTA)</label>
              <input value={form.cta_text} onChange={(e) => setForm((f) => ({ ...f, cta_text: e.target.value }))} className="input" />
            </div>
          </div>

          {/* Block builder */}
          <div>
            <label className="label">Conteúdo da página</label>
            <div className="mb-3 flex flex-wrap gap-2">
              {blockTypes.map((bt) => {
                const Icon = bt.icon;
                return (
                  <button
                    key={bt.type}
                    type="button"
                    onClick={() => addBlock(bt.type)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {bt.label}
                  </button>
                );
              })}
            </div>

            {form.blocks.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center">
                <p className="text-sm text-slate-400">Adiciona blocos de conteúdo usando os botões acima</p>
              </div>
            ) : (
              <div className="space-y-2">
                {form.blocks.map((block) => {
                  const bt = blockTypes.find((t) => t.type === block.type);
                  const Icon = bt?.icon ?? Type;
                  return (
                    <div key={block.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <Icon className="h-3.5 w-3.5" />
                          {bt?.label}
                        </span>
                        <button type="button" onClick={() => removeBlock(block.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {block.type === 'image' ? (
                        <input
                          value={block.content}
                          onChange={(e) => updateBlock(block.id, e.target.value)}
                          className="input"
                          placeholder="URL da imagem..."
                        />
                      ) : (
                        <textarea
                          value={block.content}
                          onChange={(e) => updateBlock(block.id, e.target.value)}
                          className="input min-h-[60px] resize-y"
                          placeholder="Conteúdo do bloco..."
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((f) => ({ ...f, is_published: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-medium text-slate-700">Publicar página</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Criar página'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Preview Modal */}
      <Modal open={!!previewPage} onClose={() => setPreviewPage(null)} title="Pré-visualização" size="lg">
        {previewPage && (
          <div className="space-y-4">
            {previewPage.hero_image_url && (
              <img src={previewPage.hero_image_url} alt="" className="h-40 w-full rounded-lg object-cover" />
            )}
            <h2 className="text-2xl font-bold text-slate-900">{previewPage.headline || previewPage.title}</h2>
            {previewPage.subheadline && <p className="text-slate-600">{previewPage.subheadline}</p>}
            <div className="space-y-3">
              {previewPage.body_content?.map((block) => {
                switch (block.type) {
                  case 'heading':
                    return <h3 key={block.id} className="text-lg font-semibold text-slate-900">{block.content}</h3>;
                  case 'paragraph':
                    return <p key={block.id} className="text-sm text-slate-600">{block.content}</p>;
                  case 'image':
                    return block.content && <img key={block.id} src={block.content} alt="" className="w-full rounded-lg" />;
                  case 'features':
                    return <div key={block.id} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{block.content}</div>;
                  case 'testimonial':
                    return <blockquote key={block.id} className="border-l-4 border-blue-500 pl-4 text-sm italic text-slate-700">{block.content}</blockquote>;
                  case 'cta':
                    return <div key={block.id} className="text-center"><span className="btn-primary">{previewPage.cta_text}</span></div>;
                  default:
                    return null;
                }
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
