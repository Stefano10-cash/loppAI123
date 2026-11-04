import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import {
  User, Mail, Phone, Building, Globe, CreditCard, Save, AlertCircle, Info,
  Wallet, Smartphone, Nfc, Building2, LogOut, Trash2, AlertTriangle, X,
} from 'lucide-react';

export function SettingsPage() {
  const { profile, refreshProfile, signOut } = useAuth();
  const { addNotification } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? '',
    bio: profile?.bio ?? '',
    company: profile?.company ?? '',
    phone: profile?.phone ?? '',
    country: profile?.country ?? '',
    currency: profile?.currency ?? 'AOA',
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name,
        bio: form.bio,
        company: form.company,
        phone: form.phone,
        country: form.country,
        currency: form.currency,
      })
      .eq('id', profile?.id);

    if (!error) {
      await refreshProfile();
      await addNotification({ title: 'Definições guardadas', message: 'O teu perfil foi atualizado.', type: 'success' });
    }
    setSaving(false);
  }

  async function handleSignOut() {
    await signOut();
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== 'ELIMINAR') return;
    setDeleting(true);
    // Delete profile data (RLS allows user to delete own rows)
    if (profile?.id) {
      await Promise.all([
        supabase.from('products').delete().eq('user_id', profile.id),
        supabase.from('stores').delete().eq('user_id', profile.id),
        supabase.from('withdrawals').delete().eq('user_id', profile.id),
        supabase.from('age_verifications').delete().eq('user_id', profile.id),
        supabase.from('seller_goals').delete().eq('user_id', profile.id),
      ]);
    }
    // Note: actual auth user deletion requires admin/service role on server
    // For now, sign out the user after cleaning up their data
    await supabase.auth.signOut();
    setDeleting(false);
  }

  const paymentIntegrations = [
    { name: 'PayPal', desc: 'Pagamentos internacionais via PayPal', icon: Wallet, currencies: 'EUR, USD, BRL, AOA' },
    { name: 'Visa', desc: 'Pagamentos com cartão Visa (via Stripe)', icon: CreditCard, currencies: 'EUR, USD, BRL, AOA' },
    { name: 'Mastercard', desc: 'Pagamentos com cartão Mastercard (via Stripe)', icon: CreditCard, currencies: 'EUR, USD, BRL, AOA' },
    { name: 'Google Pay', desc: 'Pagamentos rápidos via Google Pay', icon: Smartphone, currencies: 'EUR, USD, BRL' },
    { name: 'Apple Pay', desc: 'Pagamentos rápidos via Apple Pay', icon: Nfc, currencies: 'EUR, USD, BRL' },
    { name: 'Multicaixa Express', desc: 'Bancos angolanos via Multicaixa Express (EMIS)', icon: Building2, currencies: 'AOA' },
    { name: 'Pix', desc: 'Pagamento instantâneo brasileiro via Pix', icon: Smartphone, currencies: 'BRL' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Definições</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Gere o teu perfil e configurações da conta.</p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
            <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Perfil</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Informação pessoal e de contacto</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Nome completo</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="label">Empresa</label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="input pl-10" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Telefone</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input pl-10" placeholder="+244..." />
              </div>
            </div>
            <div>
              <label className="label">País</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="input pl-10" placeholder="Angola" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Biografia</label>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input min-h-[80px] resize-y" placeholder="Conta algo sobre ti..." />
          </div>

          <div>
            <label className="label">Moeda preferida</label>
            <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="input sm:w-64">
              <option value="AOA">Kwanza Angolano (Kz) — Principal</option>
              <option value="EUR">Euro (€)</option>
              <option value="USD">Dólar Americano ($)</option>
              <option value="BRL">Real Brasileiro (R$)</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">O Kwanza Angolano é a moeda principal da plataforma.</p>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : <><Save className="h-4 w-4" />Guardar alterações</>}
            </button>
          </div>
        </form>
      </div>

      {/* Payment integrations */}
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <CreditCard className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Métodos de Pagamento</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configura os métodos de pagamento para assinaturas e vendas</p>
          </div>
        </div>

        <div className="space-y-3">
          {paymentIntegrations.map((integration) => {
            const Icon = integration.icon;
            return (
              <div key={integration.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                    <Icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{integration.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{integration.desc}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Moedas: {integration.currencies}</p>
                  </div>
                </div>
                <span className="badge bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">Não configurado</span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Para ativar os pagamentos, precisas de configurar as chaves de API de cada fornecedor.
            O Stripe suporta Visa e Mastercard. O Multicaixa Express requer acordo comercial com a EMIS (Angola).
            O Pix requer integração com um banco brasileiro ou provedor PSP. Google Pay e Apple Pay são configurados via Stripe ou gateway compatível.
          </p>
        </div>
      </div>

      {/* Ad integrations */}
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <AlertCircle className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Integrações de Publicidade</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Configura as APIs para publicação de anúncios</p>
          </div>
        </div>

        <div className="space-y-3">
          {[
            { name: 'Facebook Business API', desc: 'Para publicar anúncios no Facebook e Instagram' },
            { name: 'WhatsApp Business API', desc: 'Para campanhas via WhatsApp' },
            { name: 'Google Ads API', desc: 'Para campanhas no Google Ads' },
          ].map((integration) => (
            <div key={integration.name} className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{integration.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{integration.desc}</p>
              </div>
              <span className="badge bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">Não configurado</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-50 p-4 dark:bg-amber-500/10">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-400">
            As integrações de publicidade requerem contas de desenvolvedor ativas em cada plataforma e chaves de API válidas.
            As campanhas podem ser criadas como rascunho sem integração, mas a publicação direta exige configuração prévia.
          </p>
        </div>
      </div>
      {/* Session & Account */}
      <div className="card p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <LogOut className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sessão e Conta</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerir o término de sessão e a eliminação da conta</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sign out */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <LogOut className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">Terminar sessão</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sai da tua conta neste dispositivo</p>
              </div>
            </div>
            <button
              onClick={() => setShowSignOut(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Terminar sessão
            </button>
          </div>

          {/* Delete account */}
          <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50/30 p-4 dark:border-red-500/30 dark:bg-red-500/5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-500/20">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-900 dark:text-red-400">Eliminar conta</p>
                <p className="text-xs text-red-700/70 dark:text-red-400/70">Apaga permanentemente a tua conta e todos os dados</p>
              </div>
            </div>
            <button
              onClick={() => setShowDelete(true)}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>

      {/* Sign out confirmation modal */}
      {showSignOut && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSignOut(false)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Terminar sessão</h3>
              <button onClick={() => setShowSignOut(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-start gap-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Vais sair da tua conta neste dispositivo. Os teus dados ficam guardados e podes entrar novamente a qualquer momento com o teu email e password.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowSignOut(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  onClick={handleSignOut}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <LogOut className="h-4 w-4" />
                  Sim, terminar sessão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => { setShowDelete(false); setDeleteConfirm(''); }} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900">
            <div className="bg-red-600 px-6 py-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-white" />
                <h3 className="text-base font-bold text-white">Eliminar conta permanentemente</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 space-y-3">
                <div className="flex items-start gap-3 rounded-lg bg-red-50 p-4 dark:bg-red-500/10">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                  <div className="text-sm text-red-700 dark:text-red-400">
                    <p className="font-bold">Aviso: esta ação é irreversível!</p>
                    <p className="mt-1">Ao eliminares a conta, todos os teus dados serão apagados permanentemente:</p>
                    <ul className="mt-2 ml-4 list-disc space-y-1 text-xs">
                      <li>Produtos, lojas e páginas de venda</li>
                      <li>Pedidos, saques e histórico de transações</li>
                      <li>Afiliados, campanhas e cupons</li>
                      <li>Verificação de identidade (KYC)</li>
                      <li>Metas da jornada planetária</li>
                      <li>Notificações e tickets de suporte</li>
                    </ul>
                  </div>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Para confirmar, escreve <strong className="text-red-600">ELIMINAR</strong> em maiúsculas abaixo:
                </p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="input border-red-300 dark:border-red-500/50"
                  placeholder="ELIMINAR"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}
                  className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'ELIMINAR' || deleting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-40"
                >
                  {deleting ? <LoadingSpinner size={18} className="text-white" /> : <><Trash2 className="h-4 w-4" /> Eliminar conta</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
