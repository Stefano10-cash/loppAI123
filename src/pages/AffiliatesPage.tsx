import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { AffiliateStatusBadge } from '@/components/ui/Badges';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Affiliate, AffiliateStatus, Product } from '@/types';
import { Users, Plus, Search, Edit2, Trash2, Copy, Mail, MousePointerClick, Target, DollarSign } from 'lucide-react';

function randomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function AffiliatesPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Affiliate | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    referral_code: '',
    commission_rate: 10,
    status: 'active' as AffiliateStatus,
    product_id: '',
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      supabase.from('affiliates').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('user_id', user.id),
    ]);
    setAffiliates((aRes.data ?? []) as Affiliate[]);
    setProducts((pRes.data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', referral_code: randomCode(), commission_rate: 10, status: 'active', product_id: '' });
    setModalOpen(true);
  }

  function openEdit(a: Affiliate) {
    setEditing(a);
    setForm({
      name: a.name, email: a.email, referral_code: a.referral_code,
      commission_rate: Number(a.commission_rate), status: a.status, product_id: a.product_id ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      email: form.email.trim(),
      referral_code: form.referral_code.toUpperCase(),
      commission_rate: Number(form.commission_rate),
      status: form.status,
      product_id: form.product_id || null,
    };
    if (editing) {
      const { error } = await supabase.from('affiliates').update(payload).eq('id', editing.id);
      if (!error) await addNotification({ title: 'Afiliado atualizado', message: `"${form.name}" atualizado.`, type: 'success' });
    } else {
      const { error } = await supabase.from('affiliates').insert(payload);
      if (!error) await addNotification({ title: 'Afiliado criado', message: `"${form.name}" adicionado.`, type: 'success' });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(a: Affiliate) {
    if (!confirm(`Eliminar o afiliado "${a.name}"?`)) return;
    await supabase.from('affiliates').delete().eq('id', a.id);
    await addNotification({ title: 'Afiliado eliminado', message: `"${a.name}" eliminado.`, type: 'warning' });
    load();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  const filtered = affiliates.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.referral_code.toLowerCase().includes(search.toLowerCase())
  );

  const totalEarnings = affiliates.reduce((sum, a) => sum + Number(a.total_earnings), 0);
  const totalClicks = affiliates.reduce((sum, a) => sum + a.clicks, 0);
  const totalConversions = affiliates.reduce((sum, a) => sum + a.conversions, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Afiliados</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Gere o teu programa de afiliados e comissões.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Novo Afiliado
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Ganhos Totais', value: formatCurrency(totalEarnings), icon: DollarSign, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Cliques', value: totalClicks.toLocaleString(), icon: MousePointerClick, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Conversões', value: totalConversions.toString(), icon: Target, color: 'text-orange-500', bg: 'bg-orange-500/10' },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.bg}`}>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Pesquisar afiliados..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum afiliado encontrado"
            description="Adiciona afiliados para promover os teus produtos e pagar comissões."
            action={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Adicionar afiliado</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-5 py-3">Afiliado</th>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Comissão</th>
                  <th className="px-5 py-3">Cliques</th>
                  <th className="px-5 py-3">Conv.</th>
                  <th className="px-5 py-3">Ganhos</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((a) => (
                  <tr key={a.id} className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{a.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{a.email}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-300">{a.referral_code}</code>
                        <button onClick={() => copyCode(a.referral_code)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">{Number(a.commission_rate)}%</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{a.clicks}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{a.conversions}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">{formatCurrency(Number(a.total_earnings))}</td>
                    <td className="px-5 py-3"><AffiliateStatusBadge status={a.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(a)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(a)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Afiliado' : 'Novo Afiliado'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nome *</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Nome do afiliado" />
          </div>
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input pl-10" placeholder="email@exemplo.com" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Código de referência *</label>
              <div className="flex gap-2">
                <input required value={form.referral_code} onChange={(e) => setForm({ ...form, referral_code: e.target.value.toUpperCase() })} className="input" />
                <button type="button" onClick={() => setForm({ ...form, referral_code: randomCode() })} className="btn-secondary shrink-0">Gerar</button>
              </div>
            </div>
            <div>
              <label className="label">Comissão (%) *</label>
              <input required type="number" min="0" max="100" step="0.1" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} className="input" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Produto (opcional)</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input">
                <option value="">Todos os produtos</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Estado</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as AffiliateStatus })} className="input">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Adicionar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
