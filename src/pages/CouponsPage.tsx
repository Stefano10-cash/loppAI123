import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Coupon, DiscountType, Product, Store } from '@/types';
import { Ticket, Plus, Search, Edit2, Trash2, RefreshCw, Check, X } from 'lucide-react';

function randomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `LOPP-${seg()}-${seg()}`;
}

export function CouponsPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: '',
    discount_type: 'percentage' as DiscountType,
    discount_value: 10,
    max_uses: '',
    expires_at: '',
    is_active: true,
    product_id: '',
    store_id: '',
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const [cRes, pRes, sRes] = await Promise.all([
      supabase.from('coupons').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('user_id', user.id),
      supabase.from('stores').select('id, name').eq('user_id', user.id),
    ]);
    setCoupons((cRes.data ?? []) as Coupon[]);
    setProducts((pRes.data ?? []) as Product[]);
    setStores((sRes.data ?? []) as Store[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function openCreate() {
    setEditing(null);
    setForm({ code: randomCode(), discount_type: 'percentage', discount_value: 10, max_uses: '', expires_at: '', is_active: true, product_id: '', store_id: '' });
    setModalOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      max_uses: coupon.max_uses?.toString() ?? '',
      expires_at: coupon.expires_at ? new Date(coupon.expires_at).toISOString().slice(0, 10) : '',
      is_active: coupon.is_active,
      product_id: coupon.product_id ?? '',
      store_id: coupon.store_id ?? '',
    });
    setModalOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const payload = {
      user_id: user.id,
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
      product_id: form.product_id || null,
      store_id: form.store_id || null,
    };

    if (editing) {
      const { error } = await supabase.from('coupons').update(payload).eq('id', editing.id);
      if (!error) await addNotification({ title: 'Cupão atualizado', message: `Cupão "${form.code}" atualizado.`, type: 'success' });
    } else {
      const { error } = await supabase.from('coupons').insert(payload);
      if (!error) await addNotification({ title: 'Cupão criado', message: `Cupão "${form.code}" criado.`, type: 'success' });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function toggleActive(coupon: Coupon) {
    await supabase.from('coupons').update({ is_active: !coupon.is_active }).eq('id', coupon.id);
    load();
  }

  async function handleDelete(coupon: Coupon) {
    if (!confirm(`Eliminar o cupão "${coupon.code}"?`)) return;
    await supabase.from('coupons').delete().eq('id', coupon.id);
    await addNotification({ title: 'Cupão eliminado', message: `Cupão "${coupon.code}" eliminado.`, type: 'warning' });
    load();
  }

  const filtered = coupons.filter((c) => c.code.toLowerCase().includes(search.toLowerCase()));

  function isExpired(c: Coupon): boolean {
    return !!c.expires_at && new Date(c.expires_at) < new Date();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cupões de Desconto</h2>
          <p className="text-sm text-slate-500">Gere cupões promocionais para os teus produtos e lojas.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Criar Cupão
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Pesquisar cupões..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="Nenhum cupão encontrado"
            description="Cria cupões de desconto para promover os teus produtos e aumentar as vendas."
            action={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Criar cupão</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Desconto</th>
                  <th className="px-5 py-3">Usos</th>
                  <th className="px-5 py-3">Expira</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((coupon) => {
                  const expired = isExpired(coupon);
                  return (
                    <tr key={coupon.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{coupon.code}</code>
                        </div>
                        {coupon.product_id && <p className="mt-0.5 text-xs text-slate-500">{products.find((p) => p.id === coupon.product_id)?.name}</p>}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        {coupon.discount_type === 'percentage'
                          ? `${Number(coupon.discount_value)}%`
                          : formatCurrency(Number(coupon.discount_value))}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {coupon.used_count}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                      </td>
                      <td className="px-5 py-3 text-slate-500">
                        {coupon.expires_at ? formatDate(coupon.expires_at) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => toggleActive(coupon)}
                          className={`badge ${expired ? 'bg-slate-100 text-slate-400' : coupon.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                        >
                          {expired ? 'Expirado' : coupon.is_active ? (
                            <><Check className="h-3 w-3" /> Ativo</>
                          ) : (
                            <><X className="h-3 w-3" /> Inativo</>
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(coupon)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(coupon)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Cupão' : 'Novo Cupão'} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Código *</label>
            <div className="flex gap-2">
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="input" placeholder="LOPP-XXXX-XXXX" />
              <button type="button" onClick={() => setForm({ ...form, code: randomCode() })} className="btn-secondary shrink-0">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Tipo de desconto *</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as DiscountType })} className="input">
                <option value="percentage">Percentagem (%)</option>
                <option value="fixed">Valor fixo</option>
              </select>
            </div>
            <div>
              <label className="label">Valor do desconto *</label>
              <input required type="number" step="0.01" min="0" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} className="input" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Limite de usos</label>
              <input type="number" min="1" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} className="input" placeholder="Ilimitado" />
            </div>
            <div>
              <label className="label">Data de expiração</label>
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="input" />
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
              <label className="label">Loja (opcional)</label>
              <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
                <option value="">Todas as lojas</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <span className="text-sm font-medium text-slate-700">Cupão ativo</span>
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Criar cupão'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
