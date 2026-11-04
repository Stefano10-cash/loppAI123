import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { TicketStatusBadge, TicketPriorityBadge } from '@/components/ui/Badges';
import { formatDateTime, timeAgo, cn } from '@/lib/utils';
import type { SupportTicket, SupportTicketMessage, TicketStatus, TicketPriority, TicketCategory } from '@/types';
import {
  LifeBuoy, Plus, Search, Edit2, Trash2, Send, MessageSquare,
  User as UserIcon, Bot, Headphones,
} from 'lucide-react';

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'general', label: 'Geral' },
  { value: 'billing', label: 'Faturação' },
  { value: 'technical', label: 'Técnico' },
  { value: 'feature_request', label: 'Pedido de funcionalidade' },
  { value: 'bug', label: 'Bug' },
  { value: 'account', label: 'Conta' },
];

const priorities: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

const statuses: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Aberto' },
  { value: 'pending', label: 'Em análise' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];

const senderIcons: Record<string, typeof UserIcon> = {
  user: UserIcon,
  support: Headphones,
  ai: Bot,
};

const senderLabels: Record<string, string> = {
  user: 'Tu',
  support: 'Suporte',
  ai: 'IA',
};

export function TicketsPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | TicketStatus>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailsTicket, setDetailsTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const [form, setForm] = useState({
    subject: '',
    category: 'general' as TicketCategory,
    priority: 'normal' as TicketPriority,
    message: '',
  });

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    setTickets((data ?? []) as SupportTicket[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function openDetails(ticket: SupportTicket) {
    setDetailsTicket(ticket);
    setMessagesLoading(true);
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as SupportTicketMessage[]);
    setMessagesLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { data: ticketData, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        status: 'open',
      })
      .select()
      .single();

    if (!error && ticketData) {
      const ticket = ticketData as SupportTicket;
      await supabase.from('support_ticket_messages').insert({
        ticket_id: ticket.id,
        user_id: user.id,
        sender: 'user',
        message: form.message.trim(),
      });

      // Auto AI response
      setTimeout(async () => {
        await supabase.from('support_ticket_messages').insert({
          ticket_id: ticket.id,
          user_id: user.id,
          sender: 'ai',
          message: `Recebemos o teu ticket sobre "${form.subject}". A nossa equipa irá analisar e responder o mais brevemente possível. Para questões urgentes, utiliza também o chat de Suporte IA disponível na plataforma.`,
        });
      }, 500);

      await addNotification({ title: 'Ticket criado', message: `"${form.subject}" foi criado.`, type: 'info' });
      setForm({ subject: '', category: 'general', priority: 'normal', message: '' });
      setCreateOpen(false);
      load();
    }
    setSaving(false);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !detailsTicket || !user) return;
    setSendingReply(true);

    await supabase.from('support_ticket_messages').insert({
      ticket_id: detailsTicket.id,
      user_id: user.id,
      sender: 'user',
      message: replyText.trim(),
    });

    setReplyText('');

    // Reload messages
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('*')
      .eq('ticket_id', detailsTicket.id)
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as SupportTicketMessage[]);

    setSendingReply(false);
  }

  async function updateStatus(status: TicketStatus) {
    if (!detailsTicket) return;
    await supabase.from('support_tickets').update({ status }).eq('id', detailsTicket.id);
    setDetailsTicket({ ...detailsTicket, status });
    load();
  }

  async function handleDelete(ticket: SupportTicket) {
    if (!confirm(`Eliminar o ticket "${ticket.subject}"?`)) return;
    await supabase.from('support_tickets').delete().eq('id', ticket.id);
    await addNotification({ title: 'Ticket eliminado', message: `"${ticket.subject}" eliminado.`, type: 'warning' });
    load();
  }

  const filtered = tickets.filter((t) => {
    const matchesSearch = t.subject.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tickets de Suporte</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Abre tickets para questões que precisam de acompanhamento.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Novo Ticket
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Pesquisar tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as 'all' | TicketStatus)} className="input sm:w-40">
          <option value="all">Todos os estados</option>
          {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6"><TableSkeleton /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="Nenhum ticket encontrado"
            description="Abre um ticket de suporte para questões que precisam de acompanhamento detalhado."
            action={<button onClick={() => setCreateOpen(true)} className="btn-primary"><Plus className="h-4 w-4" />Criar ticket</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                  <th className="px-5 py-3">Assunto</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3">Prioridade</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Mensagens</th>
                  <th className="px-5 py-3">Atualizado</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((ticket) => (
                  <tr key={ticket.id} className="cursor-pointer transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50" onClick={() => openDetails(ticket)}>
                    <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{ticket.subject}</td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {categories.find((c) => c.value === ticket.category)?.label ?? ticket.category}
                    </td>
                    <td className="px-5 py-3"><TicketPriorityBadge priority={ticket.priority} /></td>
                    <td className="px-5 py-3"><TicketStatusBadge status={ticket.status} /></td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {ticket.message_count}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{timeAgo(ticket.updated_at)}</td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openDetails(ticket)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDelete(ticket)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
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

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Novo Ticket" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Assunto *</label>
            <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input" placeholder="Descreve brevemente o problema" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Categoria</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as TicketCategory })} className="input">
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TicketPriority })} className="input">
                {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Mensagem *</label>
            <textarea required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input min-h-[120px] resize-y" placeholder="Descreve o teu problema em detalhe..." />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <LoadingSpinner size={18} className="text-white" /> : 'Criar ticket'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Details modal */}
      <Modal open={!!detailsTicket} onClose={() => setDetailsTicket(null)} title={detailsTicket?.subject ?? ''} size="lg">
        {detailsTicket && (
          <div className="space-y-4">
            {/* Ticket meta */}
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={detailsTicket.status} />
              <TicketPriorityBadge priority={detailsTicket.priority} />
              <span className="text-xs text-slate-400">
                {categories.find((c) => c.value === detailsTicket.category)?.label} • {formatDateTime(detailsTicket.created_at)}
              </span>
              <select
                value={detailsTicket.status}
                onChange={(e) => updateStatus(e.target.value as TicketStatus)}
                className="ml-auto input w-auto py-1 text-xs"
              >
                {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>

            {/* Messages */}
            <div className="max-h-[400px] space-y-3 overflow-y-auto scrollbar-thin rounded-lg bg-slate-50 p-4 dark:bg-slate-800/50">
              {messagesLoading ? (
                <div className="flex justify-center py-8"><LoadingSpinner size={24} /></div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-slate-400">Sem mensagens</p>
              ) : (
                messages.map((msg) => {
                  const SenderIcon = senderIcons[msg.sender] ?? UserIcon;
                  return (
                    <div key={msg.id} className={cn('flex gap-3', msg.sender === 'user' ? 'justify-end' : 'justify-start')}>
                      {msg.sender !== 'user' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-500/20">
                          <SenderIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div className={cn('max-w-[75%]')}>
                        <div className="mb-0.5 flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{senderLabels[msg.sender]}</span>
                          <span className="text-xs text-slate-400">{timeAgo(msg.created_at)}</span>
                        </div>
                        <div className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm',
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                        )}>
                          {msg.message}
                        </div>
                      </div>
                      {msg.sender === 'user' && (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600">
                          <UserIcon className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply */}
            <form onSubmit={sendReply} className="flex gap-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Escreve uma resposta..."
                className="input flex-1"
              />
              <button type="submit" disabled={!replyText.trim() || sendingReply} className="btn-primary shrink-0">
                {sendingReply ? <LoadingSpinner size={18} className="text-white" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}
