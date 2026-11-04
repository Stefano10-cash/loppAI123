import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState } from '@/components/ui/Loading';
import { EbookStatusBadge } from '@/components/ui/Badges';
import { formatDate, generateId } from '@/lib/utils';
import type { Ebook, EbookChapter, EbookStatus, Product, ProductStatus } from '@/types';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Sparkles,
  FileText,
  Type,
  AlignLeft,
  BookMarked,
  Languages,
  Image as ImageIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Approximate page count: ~3000 characters per page (standard ebook estimate). */
function calculatePageCount(chapters: EbookChapter[]): number {
  const totalChars = chapters.reduce((sum, ch) => sum + ch.content.length, 0);
  if (totalChars === 0) return 0;
  return Math.max(1, Math.ceil(totalChars / 3000));
}

const languageLabels: Record<string, string> = {
  pt: 'Português',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
};

const ebookStatusToProductStatus: Record<EbookStatus, ProductStatus> = {
  draft: 'draft',
  generating: 'draft',
  completed: 'published',
};

// ---------------------------------------------------------------------------
// Form type
// ---------------------------------------------------------------------------

interface EbookForm {
  title: string;
  author: string;
  language: string;
  description: string;
  chapters: EbookChapter[];
  cover_prompt: string;
  cover_url: string;
  status: EbookStatus;
}

const emptyForm: EbookForm = {
  title: '',
  author: '',
  language: 'pt',
  description: '',
  chapters: [{ id: generateId(), title: 'Capítulo 1', content: '' }],
  cover_prompt: '',
  cover_url: '',
  status: 'draft',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EbooksPage() {
  const { user, profile } = useAuth();
  const { addNotification } = useNotifications();

  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | EbookStatus>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ebook | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<EbookForm>(emptyForm);

  // AI mock loading states
  const [aiLoading, setAiLoading] = useState<'title' | 'description' | 'content' | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('ebooks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading ebooks:', error);
    }
    setEbooks((data ?? []) as Ebook[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  // -------------------------------------------------------------------------
  // Modal helpers
  // -------------------------------------------------------------------------

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, chapters: [{ id: generateId(), title: 'Capítulo 1', content: '' }], author: profile?.full_name ?? '' });
    setModalOpen(true);
  }

  function openEdit(ebook: Ebook) {
    setEditing(ebook);
    setForm({
      title: ebook.title,
      author: ebook.author,
      language: ebook.language,
      description: '',
      chapters: ebook.content?.length ? ebook.content : [{ id: generateId(), title: 'Capítulo 1', content: '' }],
      cover_prompt: ebook.cover_prompt,
      cover_url: ebook.cover_url,
      status: ebook.status,
    });
    // Fetch the linked product to retrieve the description
    if (ebook.product_id) {
      supabase
        .from('products')
        .select('description')
        .eq('id', ebook.product_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setForm((f) => ({ ...f, description: (data as Pick<Product, 'description'>).description }));
        });
    }
    setModalOpen(true);
  }

  // -------------------------------------------------------------------------
  // Chapter manipulation
  // -------------------------------------------------------------------------

  function addChapter() {
    setForm((f) => ({
      ...f,
      chapters: [...f.chapters, { id: generateId(), title: `Capítulo ${f.chapters.length + 1}`, content: '' }],
    }));
  }

  function removeChapter(id: string) {
    setForm((f) => ({
      ...f,
      chapters: f.chapters.length > 1 ? f.chapters.filter((c) => c.id !== id) : f.chapters,
    }));
  }

  function updateChapter(id: string, field: keyof EbookChapter, value: string) {
    setForm((f) => ({
      ...f,
      chapters: f.chapters.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  }

  function moveChapter(index: number, direction: 'up' | 'down') {
    setForm((f) => {
      const chapters = [...f.chapters];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= chapters.length) return f;
      [chapters[index], chapters[target]] = [chapters[target], chapters[index]];
      return { ...f, chapters };
    });
  }

  // -------------------------------------------------------------------------
  // Mock AI assistance
  // -------------------------------------------------------------------------

  function generateTitle() {
    setAiLoading('title');
    setTimeout(() => {
      setForm((f) => ({
        ...f,
        title: f.title.trim()
          ? `[Sugestão IA] ${f.title}`
          : '[Sugestão IA] O Guia Definitivo para o Sucesso Digital',
      }));
      setAiLoading(null);
    }, 900);
  }

  function generateDescription() {
    setAiLoading('description');
    setTimeout(() => {
      setForm((f) => ({
        ...f,
        description:
          f.description.trim() ||
          'Este ebook oferece uma visão abrangente e prática sobre o tema, combinando teoria e exemplos reais. ' +
          'Ao longo dos capítulos, irá descobrir estratégias acionáveis, casos de estudo e exercícios práticos ' +
          'que o ajudarão a aplicar imediatamente os conceitos apresentados. Ideal para quem procura resultados ' +
          'concretos e quer elevar o seu conhecimento para o próximo nível.',
      }));
      setAiLoading(null);
    }, 1100);
  }

  function generateContent() {
    setAiLoading('content');
    setTimeout(() => {
      setForm((f) => ({
        ...f,
        chapters: f.chapters.map((c, i) => ({
          ...c,
          content:
            c.content.trim() ||
            `Neste capítulo, exploramos os fundamentos essenciais do tema em questão. ` +
            `Começamos por analisar o contexto histórico e as principais evoluções que moldaram ` +
            `a área até aos dias de hoje.\n\n` +
            `De seguida, abordamos os conceitos-chave de forma estruturada, apresentando exemplos ` +
            `práticos que ilustram cada ponto. É importante que o leitor compreenda não só a teoria, ` +
            `mas também a sua aplicação no mundo real.\n\n` +
            `Por fim, propomos um conjunto de exercícios e perguntas de reflexão que permitem ` +
            `consolidar a matéria do ${i + 1}º capítulo. Recomendamos que dedique tempo a estas ` +
            `atividades, pois são fundamentais para o processo de aprendizagem.`,
        })),
      }));
      setAiLoading(null);
    }, 1300);
  }

  // -------------------------------------------------------------------------
  // Save / Delete
  // -------------------------------------------------------------------------

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!form.title.trim()) {
      await addNotification({ title: 'Erro', message: 'O título é obrigatório.', type: 'error' });
      return;
    }

    setSaving(true);

    const pageCount = calculatePageCount(form.chapters);

    const productPayload = {
      user_id: user.id,
      name: form.title.trim(),
      description: form.description,
      type: 'ebook' as const,
      price: 0,
      currency: profile?.currency ?? 'EUR',
      cover_image_url: form.cover_url,
      file_url: '',
      stock: null,
      category: 'Ebook',
      tags: ['ebook', form.language],
      status: ebookStatusToProductStatus[form.status],
    };

    try {
      if (editing) {
        // Update linked product
        const { error: prodError } = await supabase
          .from('products')
          .update(productPayload)
          .eq('id', editing.product_id);

        if (prodError) throw prodError;

        // Update ebook
        const { error: ebookError } = await supabase
          .from('ebooks')
          .update({
            title: form.title.trim(),
            author: form.author.trim(),
            content: form.chapters,
            cover_prompt: form.cover_prompt,
            cover_url: form.cover_url,
            page_count: pageCount,
            language: form.language,
            status: form.status,
          })
          .eq('id', editing.id);

        if (ebookError) throw ebookError;

        await addNotification({ title: 'Ebook atualizado', message: `"${form.title}" foi atualizado com sucesso.`, type: 'success' });
      } else {
        // Create product first
        const { data: prodData, error: prodError } = await supabase
          .from('products')
          .insert(productPayload)
          .select()
          .single();

        if (prodError) throw prodError;

        const product = prodData as Product;

        // Create ebook linked to product
        const { error: ebookError } = await supabase.from('ebooks').insert({
          product_id: product.id,
          user_id: user.id,
          title: form.title.trim(),
          author: form.author.trim(),
          content: form.chapters,
          cover_prompt: form.cover_prompt,
          cover_url: form.cover_url,
          page_count: pageCount,
          language: form.language,
          status: form.status,
        });

        if (ebookError) {
          // Attempt to roll back the product if ebook creation fails
          await supabase.from('products').delete().eq('id', product.id);
          throw ebookError;
        }

        await addNotification({ title: 'Ebook criado', message: `"${form.title}" foi criado com sucesso.`, type: 'success' });
      }

      setModalOpen(false);
      load();
    } catch (err) {
      console.error('Error saving ebook:', err);
      await addNotification({ title: 'Erro', message: 'Ocorreu um erro ao guardar o ebook.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ebook: Ebook) {
    if (!confirm(`Eliminar "${ebook.title}"? Esta ação não pode ser desfeita.`)) return;

    // Delete the ebook first, then the linked product
    const { error: ebookError } = await supabase.from('ebooks').delete().eq('id', ebook.id);
    if (ebookError) {
      console.error('Error deleting ebook:', ebookError);
      await addNotification({ title: 'Erro', message: 'Não foi possível eliminar o ebook.', type: 'error' });
      return;
    }

    if (ebook.product_id) {
      await supabase.from('products').delete().eq('id', ebook.product_id);
    }

    await addNotification({ title: 'Ebook eliminado', message: `"${ebook.title}" foi eliminado.`, type: 'warning' });
    load();
  }

  // -------------------------------------------------------------------------
  // Filtering
  // -------------------------------------------------------------------------

  const filtered = ebooks.filter((ebook) => {
    const matchesSearch =
      ebook.title.toLowerCase().includes(search.toLowerCase()) ||
      ebook.author.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || ebook.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const previewPageCount = calculatePageCount(form.chapters);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Ebooks</h2>
          <p className="text-sm text-slate-500">Cria e gere os teus ebooks com assistência IA.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Criar Ebook
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por título ou autor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | EbookStatus)}
          className="input sm:w-48"
        >
          <option value="all">Todos os estados</option>
          <option value="draft">Rascunho</option>
          <option value="generating">A gerar</option>
          <option value="completed">Concluído</option>
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card overflow-hidden animate-pulse">
              <div className="aspect-[3/4] bg-slate-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 rounded-full bg-slate-100" />
                  <div className="h-5 w-12 rounded-full bg-slate-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BookOpen}
            title="Nenhum ebook encontrado"
            description="Cria o teu primeiro ebook com capítulos, capa e assistência IA para começar a publicar."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Criar ebook
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((ebook) => (
            <div key={ebook.id} className="card group overflow-hidden transition-shadow hover:shadow-lg">
              {/* Cover */}
              <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-blue-100 to-slate-200">
                {ebook.cover_url ? (
                  <img
                    src={ebook.cover_url}
                    alt={ebook.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                    <BookOpen className="h-12 w-12" />
                    <span className="text-xs font-medium">Sem capa</span>
                  </div>
                )}
                <div className="absolute right-3 top-3">
                  <EbookStatusBadge status={ebook.status} />
                </div>
              </div>

              {/* Body */}
              <div className="p-4">
                <h3 className="truncate font-semibold text-slate-900" title={ebook.title}>
                  {ebook.title}
                </h3>
                <p className="mt-0.5 truncate text-sm text-slate-500" title={ebook.author}>
                  {ebook.author || 'Autor desconhecido'}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {ebook.page_count} pág.
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <BookMarked className="h-3.5 w-3.5" />
                    {ebook.content?.length ?? 0} cap.
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Languages className="h-3.5 w-3.5" />
                    {languageLabels[ebook.language] ?? ebook.language}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{formatDate(ebook.created_at)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(ebook)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ebook)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Create / Edit Modal                                                */}
      {/* ----------------------------------------------------------------- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Ebook' : 'Novo Ebook'}
        size="xl"
      >
        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic info */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <BookOpen className="h-4 w-4" />
              Informação Geral
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="Ex: O Guia do Marketing Digital"
                />
              </div>
              <div>
                <label className="label">Autor</label>
                <input
                  value={form.author}
                  onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className="input"
                  placeholder="Nome do autor"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Idioma</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="input"
                >
                  <option value="pt">Português</option>
                  <option value="en">Inglês</option>
                  <option value="es">Espanhol</option>
                  <option value="fr">Francês</option>
                </select>
              </div>
              <div>
                <label className="label">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as EbookStatus })}
                  className="input"
                >
                  <option value="draft">Rascunho</option>
                  <option value="generating">A gerar</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Descrição</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input min-h-[80px] resize-y"
                placeholder="Breve descrição do ebook..."
              />
            </div>
          </div>

          {/* Cover */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <ImageIcon className="h-4 w-4" />
              Capa
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Prompt para capa (IA)</label>
                <input
                  value={form.cover_prompt}
                  onChange={(e) => setForm({ ...form, cover_prompt: e.target.value })}
                  className="input"
                  placeholder="Ex: capa minimalista azul com ícone de livro"
                />
                <p className="mt-1 text-xs text-slate-400">Guardado para futura geração de capa por IA.</p>
              </div>
              <div>
                <label className="label">URL da capa</label>
                <input
                  value={form.cover_url}
                  onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                  className="input"
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Cover preview */}
            {(form.cover_url || form.cover_prompt) && (
              <div className="flex items-center gap-4">
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                  {form.cover_url ? (
                    <img src={form.cover_url} alt="Pré-visualização da capa" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <BookOpen className="h-6 w-6 text-slate-300" />
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  {form.cover_url ? (
                    <p>Capa definida via URL.</p>
                  ) : (
                    <p>Sem URL de capa. O prompt será usado quando a geração por IA estiver configurada.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Assistance */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-blue-900">Assistência IA</h3>
            </div>
            <p className="text-xs text-blue-700">
              A assistência IA requer configuração de API externa. As funções abaixo geram conteúdo de exemplo para demonstração.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={generateTitle}
                disabled={aiLoading !== null}
                className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {aiLoading === 'title' ? <LoadingSpinner size={16} /> : <Type className="h-4 w-4" />}
                Gerar Título
              </button>
              <button
                type="button"
                onClick={generateDescription}
                disabled={aiLoading !== null}
                className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {aiLoading === 'description' ? <LoadingSpinner size={16} /> : <AlignLeft className="h-4 w-4" />}
                Gerar Descrição
              </button>
              <button
                type="button"
                onClick={generateContent}
                disabled={aiLoading !== null}
                className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
              >
                {aiLoading === 'content' ? <LoadingSpinner size={16} /> : <FileText className="h-4 w-4" />}
                Gerar Conteúdo
              </button>
            </div>
          </div>

          {/* Chapter editor */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <FileText className="h-4 w-4" />
                Capítulos
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                  {form.chapters.length}
                </span>
              </h3>
              <button type="button" onClick={addChapter} className="btn-secondary inline-flex items-center gap-1.5 text-sm">
                <Plus className="h-4 w-4" />
                Adicionar capítulo
              </button>
            </div>

            <div className="space-y-3">
              {form.chapters.map((chapter, index) => (
                <div key={chapter.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  {/* Chapter header */}
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 shrink-0 text-slate-300" />
                    <span className="shrink-0 text-sm font-semibold text-slate-400">#{index + 1}</span>
                    <input
                      value={chapter.title}
                      onChange={(e) => updateChapter(chapter.id, 'title', e.target.value)}
                      className="input flex-1"
                      placeholder="Título do capítulo"
                    />
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveChapter(index, 'up')}
                        disabled={index === 0}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Mover para cima"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveChapter(index, 'down')}
                        disabled={index === form.chapters.length - 1}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Mover para baixo"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeChapter(chapter.id)}
                        disabled={form.chapters.length === 1}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        title="Remover capítulo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Chapter content */}
                  <textarea
                    value={chapter.content}
                    onChange={(e) => updateChapter(chapter.id, 'content', e.target.value)}
                    className="input mt-3 min-h-[120px] resize-y font-mono text-sm"
                    placeholder="Conteúdo do capítulo..."
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">
                    {chapter.content.length} caracteres
                  </p>
                </div>
              ))}
            </div>

            {/* Page count estimate */}
            <div className="flex items-center justify-end gap-2 text-sm text-slate-500">
              <FileText className="h-4 w-4" />
              Estimativa: <span className="font-semibold text-slate-700">{previewPageCount} páginas</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : <BookOpen className="h-4 w-4" />}
              {editing ? 'Guardar alterações' : 'Criar ebook'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
