import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { EmptyState } from '@/components/ui/Loading';
import { timeAgo, cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/types';
import { Bell, Check, CheckCheck, Trash2, BellOff } from 'lucide-react';

const typeConfig: Record<NotificationType, { color: string; bg: string }> = {
  info: { color: 'text-blue-600', bg: 'bg-blue-100' },
  success: { color: 'text-green-600', bg: 'bg-green-100' },
  warning: { color: 'text-amber-600', bg: 'bg-amber-100' },
  error: { color: 'text-red-600', bg: 'bg-red-100' },
  sale: { color: 'text-green-600', bg: 'bg-green-100' },
  order: { color: 'text-blue-600', bg: 'bg-blue-100' },
  campaign: { color: 'text-purple-600', bg: 'bg-purple-100' },
};

export function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Notificações</h2>
          <p className="text-sm text-slate-500">
            {unreadCount > 0 ? `Tens ${unreadCount} notificações por ler.` : 'Todas as notificações foram lidas.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllAsRead} className="btn-secondary">
            <CheckCheck className="h-4 w-4" />
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn('rounded-lg px-3.5 py-2 text-sm font-medium transition-colors', filter === 'all' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100')}
        >
          Todas ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={cn('rounded-lg px-3.5 py-2 text-sm font-medium transition-colors', filter === 'unread' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100')}
        >
          Por ler ({unreadCount})
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">A carregar...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'unread' ? BellOff : Bell}
            title={filter === 'unread' ? 'Sem notificações por ler' : 'Sem notificações'}
            description="As tuas notificações aparecem aqui quando houver novidades na tua conta."
          />
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map((n) => {
              const cfg = typeConfig[n.type] ?? typeConfig.info;
              return (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-5 py-4 transition-colors hover:bg-slate-50/50',
                    !n.is_read && 'bg-blue-50/30'
                  )}
                >
                  <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', cfg.bg)}>
                    <Bell className={cn('h-4.5 w-4.5', cfg.color)} style={{ width: 18, height: 18 }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Marcar como lida"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
