import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, CardSkeleton } from '@/components/ui/Loading';
import { useNotifications } from '@/context/NotificationsContext';
import { cn, formatDateTime } from '@/lib/utils';
import type { Integration, IntegrationProvider } from '@/types';
import {
  Plug, Webhook, Link2, BarChart3, Plus, Check, X, Copy,
  RefreshCw, Power, Trash2, ExternalLink, Info, Zap, Activity,
} from 'lucide-react';

interface ProviderDef {
  id: IntegrationProvider;
  label: string;
  icon: typeof Plug;
  color: string;
  bgColor: string;
  description: string;
  fields: { key: string; label: string; placeholder: string; type: 'text' | 'url' | 'password'; required: boolean }[];
  helpText: string;
  externalUrl?: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'webhook',
    label: 'Webhooks',
    icon: Webhook,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-500/20',
    description: 'Recebe notificações em tempo real sobre eventos da plataforma: novos pedidos, pagamentos, saques e mais.',
    fields: [
      { key: 'url', label: 'URL do Webhook', placeholder: 'https://api.exemplo.com/webhook', type: 'url', required: true },
      { key: 'secret', label: 'Token secreto (opcional)', placeholder: 'whsec_...', type: 'password', required: false },
    ],
    helpText: 'Os eventos são enviados via POST para o URL configurado. Inclui o token no header X-Webhook-Signature para verificação.',
  },
  {
    id: 'utmify',
    label: 'UTMify',
    icon: Link2,
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-500/20',
    description: 'Gera e faz tracking de links UTM para as tuas campanhas. Mede conversões por fonte, meio e campanha.',
    fields: [
      { key: 'api_key', label: 'Chave de API UTMify', placeholder: 'utm_pk_...', type: 'password', required: true },
      { key: 'default_source', label: 'Fonte padrão (opcional)', placeholder: 'facebook', type: 'text', required: false },
    ],
    helpText: 'A chave de API da UTMify permite gerar links tracking automaticamente e sincronizar dados de conversão.',
    externalUrl: 'https://utmify.com',
  },
  {
    id: 'otimizaai',
    label: 'OtimizaAI',
    icon: BarChart3,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-500/20',
    description: 'Otimização automática de campanhas com IA. Analisa performance e sugere melhorias de orçamento e criativo.',
    fields: [
      { key: 'api_key', label: 'Chave de API OtimizaAI', placeholder: 'oai_sk_...', type: 'password', required: true },
      { key: 'account_id', label: 'ID da conta (opcional)', placeholder: 'acc_...', type: 'text', required: false },
    ],
    helpText: 'Conecta a OtimizaAI para receber recomendações de otimização baseadas em IA para as tuas campanhas.',
    externalUrl: 'https://otimiza.ai',
  },
];

const WEBHOOK_EVENTS = [
  { event: 'order.created', label: 'Novo pedido' },
  { event: 'order.paid', label: 'Pagamento confirmado' },
  { event: 'order.shipped', label: 'Pedido enviado' },
  { event: 'withdrawal.requested', label: 'Saque solicitado' },
  { event: 'affiliate.signup', label: 'Novo afiliado' },
  { event: 'ticket.created', label: 'Ticket aberto' },
];

export function IntegrationsPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Integration | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider>('webhook');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [integrationName, setIntegrationName] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['order.created', 'order.paid']);
  const [submitting, setSubmitting] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [copied, setCopied] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('integrations')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setIntegrations((data ?? []) as Integration[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    const baseUrl = `https://webhooks.loppai.com/receiver`;
    setWebhookUrl(baseUrl);
  }, []);

  function openNewIntegration(provider: IntegrationProvider) {
    setSelectedProvider(provider);
    setEditing(null);
    setFormData({});
    setIntegrationName('');
    setSelectedEvents(['order.created', 'order.paid']);
    setShowModal(true);
  }

  function openEditIntegration(integration: Integration) {
    const provider = PROVIDERS.find((p) => p.id === integration.provider)!;
    setSelectedProvider(provider.id);
    setEditing(integration);
    setIntegrationName(integration.name);
    setFormData(
      Object.fromEntries(
        Object.entries(integration.config).map(([k, v]) => [k, String(v ?? '')]),
      ),
    );
    const events = (integration.config as Record<string, unknown>).events;
    if (Array.isArray(events)) {
      setSelectedEvents(events as string[]);
    }
    setShowModal(true);
  }

  async function saveIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const providerDef = PROVIDERS.find((p) => p.id === selectedProvider)!;
    const config: Record<string, unknown> = { ...formData };
    if (selectedProvider === 'webhook') {
      config.events = selectedEvents;
    }

    if (editing) {
      const { error } = await supabase
        .from('integrations')
        .update({ name: integrationName, config })
        .eq('id', editing.id);
      if (!error) {
        addNotification({
          title: 'Integração atualizada',
          message: `${integrationName} foi atualizada com sucesso.`,
          type: 'success',
          link: 'integrations',
        });
      }
    } else {
      const { error } = await supabase
        .from('integrations')
        .insert({
          user_id: user.id,
          provider: selectedProvider,
          name: integrationName || providerDef.label,
          config,
          is_active: true,
        });
      if (!error) {
        addNotification({
          title: 'Integração criada',
          message: `${integrationName || providerDef.label} foi configurada com sucesso.`,
          type: 'success',
          link: 'integrations',
        });
      }
    }

    setSubmitting(false);
    setShowModal(false);
    load();
  }

  async function toggleActive(integration: Integration) {
    await supabase
      .from('integrations')
      .update({ is_active: !integration.is_active })
      .eq('id', integration.id);
    load();
  }

  async function deleteIntegration(integration: Integration) {
    if (!confirm(`Eliminar a integração "${integration.name}"?`)) return;
    await supabase.from('integrations').delete().eq('id', integration.id);
    load();
  }

  async function testWebhook(integration: Integration) {
    addNotification({
      title: 'Teste enviado',
      message: `Um evento de teste foi enviado para ${integration.name}. Verifica o teu endpoint.`,
      type: 'info',
      link: 'integrations',
    });
  }

  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  const currentProvider = PROVIDERS.find((p) => p.id === selectedProvider)!;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <Plug className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          Integrações
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Conecta Webhooks, UTMify e OtimizaAI para automatizar e otimizar o teu negócio.
        </p>
      </div>

      {/* Available integrations */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PROVIDERS.map((provider) => {
          const Icon = provider.icon;
          const connected = integrations.filter((i) => i.provider === provider.id);
          return (
            <div key={provider.id} className="card p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', provider.bgColor)}>
                  <Icon className={cn('h-5.5 w-5.5', provider.color)} style={{ width: 22, height: 22 }} />
                </div>
                {connected.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/20 dark:text-green-400">
                    <Check className="h-3 w-3" />
                    {connected.length} ativa{connected.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">{provider.label}</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{provider.description}</p>
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => openNewIntegration(provider.id)}
                  className="btn-primary flex-1 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  {connected.length > 0 ? 'Nova conexão' : 'Conectar'}
                </button>
                {provider.externalUrl && (
                  <a
                    href={provider.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook URL info */}
      <div className="card p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
            <Activity className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" style={{ width: 18, height: 18 }} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">URL base de Webhooks</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Usa este URL ao configurar webhooks externos</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {webhookUrl || 'A carregar...'}
          </code>
          <button
            onClick={copyWebhookUrl}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Connected integrations list */}
      {integrations.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            icon={Plug}
            title="Sem integrações configuradas"
            description="Conecta Webhooks, UTMify ou OtimizaAI para automatizar tarefas e otimizar campanhas."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Integrações ativas</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {integrations.map((integration) => {
              const provider = PROVIDERS.find((p) => p.id === integration.provider)!;
              const Icon = provider.icon;
              return (
                <div key={integration.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', provider.bgColor)}>
                    <Icon className={cn('h-5 w-5', provider.color)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{integration.name}</p>
                      <span className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        integration.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
                      )}>
                        {integration.is_active ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      {provider.label}
                      {integration.last_triggered_at && ` · Último evento: ${formatDateTime(integration.last_triggered_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {integration.provider === 'webhook' && integration.is_active && (
                      <button
                        onClick={() => testWebhook(integration)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10"
                        title="Enviar teste"
                      >
                        <Zap className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => openEditIntegration(integration)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                      title="Editar"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(integration)}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                        integration.is_active
                          ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-500/10'
                          : 'text-slate-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-500/10',
                      )}
                      title={integration.is_active ? 'Desativar' : 'Ativar'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteIntegration(integration)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          As integrações permitem conectar ferramentas externas ao LoppAI. Webhooks enviam eventos em tempo real,
          UTMify faz tracking de campanhas com links UTM, e OtimizaAI usa IA para otimizar orçamentos e criativos.
          As chaves de API são armazenadas de forma segura e nunca expostas publicamente.
        </p>
      </div>

      {/* Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? `Editar ${currentProvider.label}` : `Conectar ${currentProvider.label}`}
        size="md"
      >
        <form onSubmit={saveIntegration} className="space-y-4">
          <div>
            <label className="label">Nome da integração</label>
            <input
              type="text"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
              placeholder={`Minha integração ${currentProvider.label}`}
              className="input"
            />
          </div>

          {currentProvider.fields.map((field) => (
            <div key={field.key}>
              <label className="label">
                {field.label}
                {field.required && <span className="ml-1 text-red-500">*</span>}
              </label>
              <input
                type={field.type}
                value={formData[field.key] ?? ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="input"
                required={field.required}
              />
            </div>
          ))}

          {selectedProvider === 'webhook' && (
            <div>
              <label className="label">Eventos a enviar</label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((evt) => (
                  <label
                    key={evt.event}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 p-2.5 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(evt.event)}
                      onChange={() => toggleEvent(evt.event)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">{evt.label}</span>
                    <code className="ml-auto text-xs text-slate-400">{evt.event}</code>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p className="text-xs text-slate-600 dark:text-slate-400">{currentProvider.helpText}</p>
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? (
                <LoadingSpinner size={18} className="text-white" />
              ) : editing ? (
                <><Check className="h-4 w-4" /> Guardar alterações</>
              ) : (
                <><Plug className="h-4 w-4" /> Conectar</>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
