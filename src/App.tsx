import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { NotificationsProvider } from '@/context/NotificationsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthPage } from '@/pages/AuthPage';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProductsPage } from '@/pages/ProductsPage';
import { EbooksPage } from '@/pages/EbooksPage';
import { StoresPage } from '@/pages/StoresPage';
import { SalesPagesPage } from '@/pages/SalesPagesPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { CouponsPage } from '@/pages/CouponsPage';
import { CampaignsPage } from '@/pages/CampaignsPage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { AffiliatesPage } from '@/pages/AffiliatesPage';
import { PlansPage } from '@/pages/PlansPage';
import { SubscriptionPage } from '@/pages/SubscriptionPage';
import { AdminPage } from '@/pages/AdminPage';
import { RankingPage } from '@/pages/RankingPage';
import { WithdrawalsPage } from '@/pages/WithdrawalsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { AIStudioPage } from '@/pages/AIStudioPage';
import { AISupportPage } from '@/pages/AISupportPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { GoalsJourneyPage } from '@/pages/GoalsJourneyPage';
import { BuyerMarketPage } from '@/pages/BuyerMarketPage';
import { StudentLibraryPage } from '@/pages/StudentLibraryPage';
import { AgeVerificationPage } from '@/pages/AgeVerificationPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { FullPageLoader } from '@/components/ui/Loading';
import type { PageId } from '@/config/navigation';

function AppContent() {
  const { user, loading, isPasswordRecovery, clearPasswordRecovery } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [adminOpen, setAdminOpen] = useState(false);

  if (loading) return <FullPageLoader />;

  if (isPasswordRecovery) {
    return <ResetPasswordPage onBackToLogin={() => { clearPasswordRecovery(); window.location.hash = ''; window.location.href = window.location.origin; }} />;
  }

  if (!user) return <AuthPage />;

  if (adminOpen) return <AdminPage onExit={() => setAdminOpen(false)} />;

  const pages: Record<PageId, React.ReactNode> = {
    dashboard: <DashboardPage onNavigate={setCurrentPage} />,
    products: <ProductsPage />,
    ebooks: <EbooksPage />,
    stores: <StoresPage />,
    'sales-pages': <SalesPagesPage />,
    orders: <OrdersPage />,
    coupons: <CouponsPage />,
    campaigns: <CampaignsPage />,
    analytics: <AnalyticsPage />,
    affiliates: <AffiliatesPage />,
    plans: <PlansPage />,
    subscription: <SubscriptionPage onNavigate={setCurrentPage} />,
    goals: <GoalsJourneyPage />,
    ranking: <RankingPage />,
    withdrawals: <WithdrawalsPage onNavigate={setCurrentPage} />,
    integrations: <IntegrationsPage />,
    'ai-studio': <AIStudioPage onNavigate={setCurrentPage} />,
    'ai-support': <AISupportPage onNavigate={setCurrentPage} />,
    tickets: <TicketsPage />,
    marketplace: <BuyerMarketPage />,
    library: <StudentLibraryPage />,
    'age-verification': <AgeVerificationPage />,
    notifications: <NotificationsPage />,
    settings: <SettingsPage />,
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage} onOpenAdmin={() => setAdminOpen(true)}>
      {pages[currentPage]}
    </AppLayout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationsProvider>
          <AppContent />
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
