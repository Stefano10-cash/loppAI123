import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { useTheme } from '@/context/ThemeContext';
import { navItems, navGroups, type PageId } from '@/config/navigation';
import { supabase } from '@/lib/supabase';
import { Sparkles, Bell, Menu, X, LogOut, ChevronDown, Sun, Moon, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';

interface AppLayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenAdmin: () => void;
  children: ReactNode;
}

export function AppLayout({ currentPage, onNavigate, onOpenAdmin, children }: AppLayoutProps) {
  const { profile, signOut } = useAuth();
  const { unreadCount, notifications, markAsRead, markAllAsRead } = useNotifications();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.rpc('is_admin').then(({ data, error }) => {
      if (active) setIsAdmin(!error && data === true);
    });
    return () => {
      active = false;
    };
  }, []);

  const currentNav = navItems.find((n) => n.id === currentPage);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 lg:flex',
          'dark:border-slate-800 dark:bg-slate-900',
          sidebarOpen ? 'translate-x-0 flex' : '-translate-x-full'
        )}
        style={{ display: 'flex' }}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-6 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white">LoppAI</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {navGroups.map(({ group, label }) => (
            <div key={group} className="mb-4">
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {label}
              </p>
              {navItems
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebarOpen(false);
                      }}
                      className={cn(
                        'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                      )}
                    >
                      <Icon className={cn(isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500')} style={{ width: 18, height: 18 }} />
                      <span>{item.label}</span>
                      {item.id === 'notifications' && unreadCount > 0 && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* User card at bottom */}
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {isAdmin && (
            <button
              onClick={() => {
                onOpenAdmin();
                setSidebarOpen(false);
              }}
              className="mb-2 flex w-full items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <ShieldCheck className="h-4 w-4" />
              Painel Administrativo
            </button>
          )}
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {profile?.full_name || 'Utilizador'}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Plano {profile?.plan || 'free'}</p>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>

          {userMenuOpen && (
            <div className="mt-2 animate-fade-in rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <button
                onClick={() => {
                  onNavigate('settings');
                  setUserMenuOpen(false);
                  setSidebarOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <SettingsIcon className="h-4 w-4" />
                Definições
              </button>
              <button
                onClick={signOut}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
              {currentNav?.label}
            </h1>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen(!notifOpen)}
                className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-12 z-40 w-80 origin-top-right rounded-xl border border-slate-200 bg-white shadow-xl animate-slide-up dark:border-slate-700 dark:bg-slate-800">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">Notificações</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllAsRead}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-thin">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                          Sem notificações
                        </p>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              if (!n.is_read) markAsRead(n.id);
                            }}
                            className={cn(
                              'flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50',
                              'dark:border-slate-700/50 dark:hover:bg-slate-700/50',
                              !n.is_read && 'bg-blue-50/50 dark:bg-blue-500/5'
                            )}
                          >
                            <div className={cn(
                              'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                              n.is_read ? 'bg-slate-200 dark:bg-slate-600' : 'bg-blue-500'
                            )} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-900 dark:text-white">{n.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{timeAgo(n.created_at)}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={() => {
                        onNavigate('notifications');
                        setNotifOpen(false);
                      }}
                      className="w-full border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-blue-600 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-400 dark:hover:bg-slate-700/50"
                    >
                      Ver todas
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile close button */}
      {sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          className="fixed right-4 top-4 z-50 rounded-lg bg-white p-2 shadow-lg dark:bg-slate-800 lg:hidden"
        >
          <X className="h-5 w-5 text-slate-600 dark:text-slate-300" />
        </button>
      )}
    </div>
  );
}
