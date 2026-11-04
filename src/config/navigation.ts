import {
  LayoutDashboard,
  Package,
  BookOpen,
  Store,
  ShoppingBag,
  Ticket,

  Bell,
  Settings,
  FileText,
  BarChart3,
  Users,
  CreditCard,
  Bot,
  LifeBuoy,
  Trophy,
  Wallet,
  Wand2,
  Plug,
  Rocket,
  ShoppingBag as Store2,
  GraduationCap,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'products'
  | 'ebooks'
  | 'stores'
  | 'sales-pages'
  | 'orders'
  | 'coupons'
  | 'campaigns'
  | 'analytics'
  | 'affiliates'
  | 'plans'
  | 'subscription'
  | 'ranking'
  | 'withdrawals'
  | 'integrations'
  | 'ai-studio'
  | 'ai-support'
  | 'tickets'
  | 'notifications'
  | 'settings'
  | 'goals'
  | 'marketplace'
  | 'library'
  | 'age-verification';

export interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
  group: 'main' | 'marketing' | 'growth' | 'support' | 'system' | 'modes';
}

export const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'products', label: 'Produtos', icon: Package, group: 'main' },
  { id: 'ebooks', label: 'Ebooks', icon: BookOpen, group: 'main' },
  { id: 'stores', label: 'Lojas', icon: Store, group: 'main' },
  { id: 'sales-pages', label: 'Páginas de Vendas', icon: FileText, group: 'main' },
  { id: 'orders', label: 'Pedidos', icon: ShoppingBag, group: 'main' },
  { id: 'coupons', label: 'Cupons', icon: Ticket, group: 'marketing' },

  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'growth' },
  { id: 'affiliates', label: 'Afiliados', icon: Users, group: 'growth' },
  { id: 'plans', label: 'Planos', icon: CreditCard, group: 'growth' },
  { id: 'subscription', label: 'Minha Assinatura', icon: CalendarDays, group: 'system' },
  { id: 'goals', label: 'Jornada', icon: Rocket, group: 'growth' },
  { id: 'ranking', label: 'Ranking', icon: Trophy, group: 'growth' },
  { id: 'withdrawals', label: 'Saques', icon: Wallet, group: 'growth' },
  { id: 'integrations', label: 'Integrações', icon: Plug, group: 'support' },
  { id: 'ai-studio', label: 'Estúdio IA', icon: Wand2, group: 'support' },
  { id: 'ai-support', label: 'LoppAI Assistente', icon: Bot, group: 'support' },
  { id: 'tickets', label: 'Tickets', icon: LifeBuoy, group: 'support' },
  { id: 'marketplace', label: 'Marketplace', icon: Store2, group: 'modes' },
  { id: 'library', label: 'Minha Biblioteca', icon: GraduationCap, group: 'modes' },
  { id: 'age-verification', label: 'Verificação KYC', icon: ShieldCheck, group: 'system' },
  { id: 'notifications', label: 'Notificações', icon: Bell, group: 'system' },
  { id: 'settings', label: 'Definições', icon: Settings, group: 'system' },
];

export const navGroups: { group: NavItem['group']; label: string }[] = [
  { group: 'main', label: 'Principal' },
  { group: 'marketing', label: 'Marketing' },
  { group: 'growth', label: 'Crescimento' },
  { group: 'support', label: 'Suporte' },
  { group: 'modes', label: 'Modos' },
  { group: 'system', label: 'Sistema' },
];
