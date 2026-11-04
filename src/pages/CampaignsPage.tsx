import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { CampaignStatusBadge } from '@/components/ui/Badges';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { AdAccount, AdPlatform, Campaign, CampaignPlatform, CampaignStatus, Product, Store } from '@/types';
import {
  Megaphone, Plus, Search, Edit2, Trash2, Facebook, MessageCircle,
  Instagram, Globe, Eye, MousePointerClick, Target, DollarSign,
  Link2, Unlink, RefreshCw, CheckCircle2, AlertCircle, Settings2,
} from 'lucide-react';

const platformIcons: Record<CampaignPlatform, typeof Megaphone> = {
  facebook: Facebook,
  whatsapp: MessageCircle,
  instagram: Instagram,
  google: Globe,
};

const platformLabels: Record<CampaignPlatform, string> = {
  facebook: 'Facebook Ads',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  google: 'Google Ads',
};

const platformColors: Record<CampaignPlatform, string> = {
  facebook: 'text-blue-600 bg-blue-100',
  whatsapp: 'text-green-600 bg-green-100',
  instagram: 'text-pink-600 bg-pink-100',
  google: 'text-orange-600 bg-orange-100',
};

const META_PLATFORMS = ['facebook', 'instagram', 'whatsapp'] as const;

export function CampaignsPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState<'all' | CampaignPlatform>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState<AdPlatform | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    platform: 'facebook' as CampaignPlatform,
    product_id: '',
    store_id: '',
    budget: 50,
    daily_budget: 5,
    start_date: '',
    end_date: '',
    target_audience: '',
    ad_headline: '',
    ad_description: '',
    ad_image_url: '',
    status: 'draft' as CampaignStatus,
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const [cRes, pRes, sRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('products').select('id, name').eq('user_id', user.id),
      supabase.from('stores').select('id, name').eq('user_id', user.id),
    ]);
    setCampaigns((cRes.data ?? []) as Campaign[]);
    setProducts((pRes.data ?? []) as Product[]);
    setStores((sRes.data ?? []) as Store[]);
    setLoading(false);
  }

  async function loadAdAccounts() {
    if (!user) return;
    setAccountsLoading(true);
    const { data } = await supabase
      .from('ad_accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setAdAccounts((data ?? []) as AdAccount[]);
    setAccountsLoading(false);
  }

  useEffect(() => { load(); loadAdAccounts(); }, [user]);

  // Listen for the postMessage from the OAuth callback popup.
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== 'object') return;
      const { type, success, error } = event.data;
      if (type !== 'meta-oauth' && type !== 'google-oauth') return;

      setConnecting(null);
      if (success) {
        setOauthError(null);
        addNotification({
          title: 'Conta conectada',
          message: type === 'meta-oauth' ? 'A tua conta Meta foi conectada com sucesso.' : 'A tua conta Google Ads foi conectada com sucesso.',
          type: 'success',
        });
        loadAdAccounts();
      } else {
        const errorMessages: Record<string, string> = {
          authorization_failed: 'A autorização foi cancelada ou falhou. Tenta novamente.',
          not_configured: 'A integração ainda não foi configurada. Contacta o suporte.',
          token_exchange_failed: 'Não foi possível obter o token de acesso. Tenta novamente.',
          missing_user: 'Não foi possível identificar a tua conta. Tenta novamente.',
        };
        setOauthError(errorMessages[error as string] ?? 'Ocorreu um erro durante a autorização. Tenta novamente.');
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [addNotification]);

  const startOAuth = useCallback(async (platform: AdPlatform) => {
    if (!user) return;
    setOauthError(null);
    setConnecting(platform);

    const fnName = platform === 'meta' ? 'meta-oauth' : 'google-oauth';
    const { data: fnData } = await supabase.functions.invoke(fnName, {
      method: 'GET',
      headers: { 'X-Client-Info': 'bolt' },
    }).catch(() => ({ data: null }));

    // The edge function returns a redirect on GET ?action=connect, but
    // functions.invoke doesn't follow redirects well. Instead, open the
    // function URL directly in a new window so the browser handles the
    // OAuth redirect flow.
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}?action=connect&state=${user.id}`;
    const popup = window.open(functionUrl, '_blank', 'width=600,height=700,scrollbars=yes');

    if (!popup) {
      setConnecting(null);
      setOauthError('O navegador bloqueou a janela de autorização. Permite pop-ups para este site e tenta novamente.');
      return;
    }

    // Fallback timeout: if no postMessage arrives within 5 minutes, clear the loading state.
    setTimeout(() => setConnecting((current) => (current === platform ? null : current)), 300000);
  }, [user]);

  async function disconnectAccount(account: AdAccount) {
    if (!confirm(`Desconectar a conta "${account.platform_account_name ?? account.platform}"?`)) return;
    await supabase.from('ad_accounts').update({ status: 'disconnected', disconnected_at: new Date().toISOString() }).eq('id', account.id);
    addNotification({ title: 'Conta desconectada', message: 'A conta foi desconectada.', type: 'warning' });
    loadAdAccounts();
  }

  async function reconnectAccount(account: AdAccount) {
    await supabase.from('ad_accounts').delete().eq('id', account.id);
    loadAdAccounts();
    startOAuth(account.platform);
  }

  function openCreate() {
    setEditing(null);
    setForm({
      name: '', platform: 'facebook', product_id: '', store_id: '',
      budget: 50, daily_budget: 5, start_date: '', end_date: '',
      target_audience: '', ad_headline: '', ad_description: '', ad_image_url: '', status: 'draft',
    });
    setModalOpen(true);
  }

  function openEdit(c: Campaign) {
    setEditing(c);
    setForm({
      name: c.name,
      platform: c.platform,
      product_id: c.product_id ?? '',
      store_id: c.store_id ?? '',
      budget: Number(c.budget),
      daily_budget: Number(c.daily_budget),
      start_date: c.start_date ? new Date(c.start_date).toISOString().slice(0, 10) : '',
      end_date: c.end_date ? new Date(c.end_date).toISOString().slice(0, 10) : '',
      target_audience: c.target_audience,
      ad_headline: (c.ad_creative as Record<string, string>)?.headline ?? '',
      ad_description: (c.ad_creative as Record<string, string>)?.description ?? '',
      ad_image_url: (c.ad_creative as Record<string, string>)?.image_url ?? '',
      status: c.status,
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
      platform: form.platform,
      product_id: form.product_id || null,
      store_id: form.store_id || null,
      budget: Number(form.budget),
      daily_budget: Number(form.daily_budget),
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      target_audience: form.target_audience,
      ad_creative: {
        headline: form.ad_headline,
        description: form.ad_description,
        image_url: form.ad_image_url,
      },
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('campaigns').update(payload).eq('id', editing.id);
      if (!error) await addNotification({ title: 'Campanha atualizada', message: `"${form.name}" atualizada.`, type: 'campaign' });
    } else {
      const { error } = await supabase.from('campaigns').insert(payload);
      if (!error) await addNotification({ title: 'Campanha criada', message: `"${form.name}" criada.`, type: 'campaign' });
    }

    setSaving(false);
    setModalOpen(false);
    load();
  }

  async function handleDelete(c: Campaign) {
    if (!confirm(`Eliminar a campanha "${c.name}"?`)) return;
    await supabase.from('campaigns').delete().eq('id', c.id);
    await addNotification({ title: 'Campanha eliminada', message: `"${c.name}" eliminada.`, type: 'warning' });
    load();
  }

  const filtered = campaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || c.platform === filterPlatform;
    return matchesSearch && matchesPlatform;
  });

  const metaAccounts = adAccounts.filter((a) => a.platform === 'meta' && a.status !== 'disconnected');
  const googleAccounts = adAccounts.filter((a) => a.platform === 'google' && a.status !== 'disconnected');
  const disconnectedAccounts = adAccounts.filter((a) => a.status === 'disconnected');

  return (
    <div className="space-y-5">
      {/* Connected Accounts Section */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Contas de Anúncios</h2>
            <p className="text-sm text-slate-500">Conecta e gere as tuas contas de publicidade.</p>
          </div>
        </div>

        {oauthError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{oauthError}</span>
          </div>
        )}

        {accountsLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size={24} className="text-blue-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Meta Ads Account Card */}
            <AccountCard
              platform="meta"
              accounts={metaAccounts}
              connecting={connecting === 'meta'}
              onConnect={() => startOAuth('meta')}
              onDisconnect={disconnectAccount}
              onReconnect={reconnectAccount}
            />

            {/* Google Ads Account Card */}
            <AccountCard
              platform="google"
              accounts={googleAccounts}
              connecting={connecting === 'google'}
              onConnect={() => startOAuth('google')}
              onDisconnect={disconnectAccount}
              onReconnect={reconnectAccount}
            />

            {/* Disconnected accounts */}
            {disconnectedAccounts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contas desconectadas</p>
                {disconnectedAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-500">{account.platform_account_name ?? account.platform}</span>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-500">Desconectada</span>
                    </div>
                    <button onClick={() => reconnectAccount(account)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                      <RefreshCw className="h-3.5 w-3.5" /> Reconectar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Connect another account */}
            <button
              onClick={() => startOAuth('meta')}
              disabled={connecting !== null}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Conectar outra conta
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <hr className="border-slate-200" />

      {/* Campaigns Section */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campanhas Publicitárias</h2>
          <p className="text-sm text-slate-500">Cria e gere campanhas para Facebook Ads, WhatsApp e mais.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Nova Campanha
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Pesquisar campanhas..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value as 'all' | CampaignPlatform)} className="input sm:w-48">
          <option value="all">Todas as plataformas</option>
          <option value="facebook">Facebook Ads</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="google">Google Ads</option>
        </select>
      </div>

      {loading ? (
        <div className="card p-6"><TableSkeleton /></div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Megaphone}
            title="Nenhuma campanha encontrada"
            description="Cria a tua primeira campanha publicitária para promover os teus produtos."
            action={<button onClick={openCreate} className="btn-primary"><Plus className="h-4 w-4" />Criar campanha</button>}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const Icon = platformIcons[c.platform];
            const metrics = c.metrics ?? { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
            return (
              <div key={c.id} className="card p-5 transition-all hover:shadow-md">
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${platformColors[c.platform]}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{platformLabels[c.platform]}</p>
                    </div>
                  </div>
                  <CampaignStatusBadge status={c.status} />
                </div>

                <div className="mb-3 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                  <div>
                    <p className="text-xs text-slate-500">Impressões</p>
                    <p className="text-sm font-semibold text-slate-900">{metrics.impressions.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Cliques</p>
                    <p className="text-sm font-semibold text-slate-900">{metrics.clicks.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Conversões</p>
                    <p className="text-sm font-semibold text-slate-900">{metrics.conversions}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Gasto</p>
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(Number(metrics.spend), c.currency)}</p>
                  </div>
                </div>

                <div className="mb-3 space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between"><span>Orçamento:</span><span className="font-medium text-slate-700">{formatCurrency(Number(c.budget), c.currency)}</span></div>
                  <div className="flex justify-between"><span>Início:</span><span>{c.start_date ? formatDate(c.start_date) : 'Por agendar'}</span></div>
                </div>

                <div className="flex items-center justify-end gap-1 border-t border-slate-100 pt-3">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(c)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Campanha' : 'Nova Campanha'} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome da campanha *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Ex: Promoção de Verão" />
            </div>
            <div>
              <label className="label">Plataforma *</label>
              <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as CampaignPlatform })} className="input">
                <option value="facebook">Facebook Ads</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="google">Google Ads</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Produto (opcional)</label>
              <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="input">
                <option value="">Sem produto</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Loja (opcional)</label>
              <select value={form.store_id} onChange={(e) => setForm({ ...form, store_id: e.target.value })} className="input">
                <option value="">Sem loja</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Criativo do anúncio</p>
            <div className="space-y-3">
              <div>
                <label className="label">Headline do anúncio</label>
                <input value={form.ad_headline} onChange={(e) => setForm({ ...form, ad_headline: e.target.value })} className="input" placeholder="A headline do teu anúncio" />
              </div>
              <div>
                <label className="label">Descrição do anúncio</label>
                <textarea value={form.ad_description} onChange={(e) => setForm({ ...form, ad_description: e.target.value })} className="input min-h-[60px] resize-y" placeholder="O texto do anúncio" />
              </div>
              <div>
                <label className="label">URL da imagem do anúncio</label>
                <input value={form.ad_image_url} onChange={(e) => setForm({ ...form, ad_image_url: e.target.value })} className="input" placeholder="https://..." />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Público-alvo</label>
            <textarea value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} className="input min-h-[60px] resize-y" placeholder="Descreve o público-alvo: idade, interesses, localização..." />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Orçamento total (€) *</label>
              <input required type="number" min="0" step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} className="input" />
            </div>
            <div>
              <label className="label">Orçamento diário (€)</label>
              <input type="number" min="0" step="0.01" value={form.daily_budget} onChange={(e) => setForm({ ...form, daily_budget: Number(e.target.value) })} className="input" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Data de início</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Data de fim</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Estado</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CampaignStatus })} className="input">
              <option value="draft">Rascunho</option>
              <option value="scheduled">Agendada</option>
              <option value="active">Ativa</option>
              <option value="paused">Pausada</option>
              <option value="completed">Concluída</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : editing ? 'Guardar' : 'Criar campanha'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AccountCard({
  platform,
  accounts,
  connecting,
  onConnect,
  onDisconnect,
  onReconnect,
}: {
  platform: AdPlatform;
  accounts: AdAccount[];
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: (account: AdAccount) => void;
  onReconnect: (account: AdAccount) => void;
}) {
  const isConnected = accounts.length > 0;
  const hasExpired = accounts.some((a) => a.status === 'expired');

  const platformInfo = platform === 'meta'
    ? { label: 'Meta Ads', sub: 'Facebook / Instagram / WhatsApp', icon: Facebook, color: 'text-blue-600 bg-blue-100' }
    : { label: 'Google Ads', sub: 'Google Ads', icon: Globe, color: 'text-orange-600 bg-orange-100' };

  const Icon = platformInfo.icon;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${platformInfo.color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{platformInfo.label}</p>
            <p className="text-xs text-slate-500">{platformInfo.sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              hasExpired ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
            }`}>
              {hasExpired ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
              {hasExpired ? 'Expirada' : 'Conectado'}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-400">
              Não conectado
            </span>
          )}
        </div>
      </div>

      {isConnected ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {accounts.map((account) => (
            <div key={account.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">
                  {account.platform_account_name ?? 'Conta'}
                </p>
                {account.platform_account_id && (
                  <p className="text-xs text-slate-400">ID: {account.platform_account_id}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Gerir">
                  <Settings2 className="h-4 w-4" />
                </button>
                {account.status === 'expired' && (
                  <button onClick={() => onReconnect(account)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Reconectar">
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => onDisconnect(account)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Desconectar">
                  <Unlink className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={onConnect}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <Link2 className="h-4 w-4" />
            Conectar outra conta {platformInfo.label}
          </button>
        </div>
      ) : (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            onClick={onConnect}
            disabled={connecting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {connecting ? <LoadingSpinner size={16} className="text-white" /> : <Link2 className="h-4 w-4" />}
            Conectar {platformInfo.label}
          </button>
        </div>
      )}
    </div>
  );
}
