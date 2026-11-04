import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { SubscriptionPlan, Subscription } from '@/types';
import {
  CreditCard, Check, Sparkles, Zap, Crown, Info, X,
  Wallet, Building2, Smartphone, Nfc, Wand2, Bot,
  Package, Megaphone, BarChart3, Globe, LifeBuoy, Shield,
  Star, TrendingUp, Rocket,
} from 'lucide-react';

const planIcons: Record<string, typeof CreditCard> = {
  free: Sparkles,
  starter: Rocket,
  pro: Zap,
  business: Package,
  premium: Crown,
};

const planGradients: Record<string, string> = {
  free: 'from-slate-600 to-slate-800',
  starter: 'from-teal-500 to-teal-700',
  pro: 'from-blue-600 to-blue-800',
  business: 'from-indigo-600 to-indigo-800',
  premium: 'from-amber-500 to-amber-700',
};

const CURRENCIES = [
  { code: 'AOA', label: 'Kwanza', symbol: 'Kz', flag: '🇦🇴' },
  { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', label: 'Dólar', symbol: '$', flag: '🇺🇸' },
  { code: 'BRL', label: 'Real', symbol: 'R$', flag: '🇧🇷' },
];

const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', icon: Wallet, desc: 'Pagamentos internacionais', currencies: ['EUR', 'USD', 'BRL', 'AOA'], available: false },
  { id: 'visa', label: 'Visa', icon: CreditCard, desc: 'Cartão Visa', currencies: ['EUR', 'USD', 'BRL', 'AOA'], available: false },
  { id: 'mastercard', label: 'Mastercard', icon: CreditCard, desc: 'Cartão Mastercard', currencies: ['EUR', 'USD', 'BRL', 'AOA'], available: false },
  { id: 'google_pay', label: 'Google Pay', icon: Smartphone, desc: 'Pagamento rápido', currencies: ['EUR', 'USD', 'BRL'], available: false },
  { id: 'apple_pay', label: 'Apple Pay', icon: Nfc, desc: 'Pagamento rápido', currencies: ['EUR', 'USD', 'BRL'], available: false },
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2, desc: 'Bancos angolanos', currencies: ['AOA'], available: true },
  { id: 'pix', label: 'Pix', icon: Smartphone, desc: 'Pagamento instantâneo', currencies: ['BRL'], available: false },
];

// Conversion rates relative to AOA (new base currency)
const CONVERSION_RATES: Record<string, number> = { AOA: 1, EUR: 1 / 1050, USD: 1 / 1134, BRL: 1 / 193 };

const COMPARISON: { category: string; icon: typeof Package; items: { label: string; plans: (boolean | string)[] }[] }[] = [
  {
    category: 'Produtos e Lojas', icon: Package,
    items: [
      { label: 'Produtos', plans: ['3', '10', 'Ilimitados', 'Ilimitados', 'Ilimitados'] },
      { label: 'Lojas', plans: ['1', '2', '3', '5', 'Ilimitadas'] },
      { label: 'Páginas de vendas', plans: ['Básicas', 'Premium', 'Premium', 'Premium', 'Premium'] },
    ],
  },
  {
    category: 'Estúdio IA', icon: Wand2,
    items: [
      { label: 'Gerar Imagens', plans: ['3/mês', '10/mês', '50/mês', '200/mês', 'Ilimitado'] },
      { label: 'Gerar Vídeos', plans: [false, false, true, true, true] },
      { label: 'Criar Capas', plans: [false, false, true, true, true] },
      { label: 'Criar E-books com IA', plans: [false, false, false, false, true] },
    ],
  },
  {
    category: 'LoppAI Assistente', icon: Bot,
    items: [{ label: 'Mensagens por conversa', plans: ['3', '20', '50', '200', 'Ilimitado'] }],
  },
  {
    category: 'Marketing', icon: Megaphone,
    items: [
      { label: 'Cupões e descontos', plans: [false, true, true, true, true] },
      { label: 'Campanhas publicitárias', plans: [false, false, true, true, true] },
      { label: 'Analytics avançado', plans: [false, false, true, true, true] },
      { label: 'Programa de afiliados', plans: [false, false, false, 'Básico', 'Ilimitado'] },
    ],
  },
  {
    category: 'Integrações', icon: Globe,
    items: [
      { label: 'Webhooks', plans: [false, false, false, true, true] },
      { label: 'UTMify', plans: [false, false, false, true, true] },
      { label: 'OtimizaAI', plans: [false, false, false, true, true] },
    ],
  },
  {
    category: 'Suporte', icon: LifeBuoy,
    items: [
      { label: 'Suporte por email', plans: [true, true, true, true, true] },
      { label: 'Suporte prioritário', plans: [false, false, true, true, true] },
      { label: 'Suporte 24/7', plans: [false, false, false, false, true] },
      { label: 'Gestor de conta dedicado', plans: [false, false, false, false, true] },
    ],
  },
];

const FAQS = [
  { q: 'O plano Free é mesmo gratuito?', a: 'Sim! O plano Free permite-te experimentar a plataforma durante 1 mês sem pagar. Após esse mês, o plano expira e precisas de fazer upgrade para um plano pago para continuar.' },
  { q: 'Posso mudar de plano a qualquer momento?', a: 'Sim. Podes fazer upgrade ou downgrade do teu plano quando quiseres. O valor é ajustado proporcionalmente ao período restante.' },
  { q: 'O Estúdio IA está incluído em todos os planos?', a: 'Todos os planos incluem acesso ao Estúdio IA. O plano Free tem 3 imagens/mês, o Starter 10, o Pro 50 (com vídeos e capas), o Business 200 e o Premium é ilimitado.' },
  { q: 'Quais métodos de pagamento são aceites?', a: 'Neste momento, aceitamos Multicaixa Express. Os restantes métodos ficam disponíveis em breve.' },
  { q: 'A assinatura anual tem desconto?', a: 'Sim. Ao escolher o ciclo anual, beneficias de aproximadamente 17% de desconto face ao pagamento mensal, poupando o equivalente a 2 meses por ano.' },
];

function ComparisonCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-green-500" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-slate-300 dark:text-slate-600" />;
  return <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>;
}

export function PlansPage() {
  const { user, profile } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('AOA');
  const [paymentMethod, setPaymentMethod] = useState<string>('multicaixa_express');
  const [showPaymentModal, setShowPaymentModal] = useState<SubscriptionPlan | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showComparison, setShowComparison] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [pendingReference, setPendingReference] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const [pRes, sRes] = await Promise.all([
      supabase.from('subscription_plans').select('*').eq('is_active', true).order('sort_order', { ascending: true }),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').order('current_period_end', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setPlans((pRes.data ?? []) as SubscriptionPlan[]);
    setSubscription((sRes.data ?? null) as Subscription | null);

    const profileCurrency = profile?.currency ?? 'AOA';
    setSelectedCurrency(CURRENCIES.some((c) => c.code === profileCurrency) ? profileCurrency : 'AOA');
    if (profileCurrency === 'AOA') setPaymentMethod('multicaixa_express');
    else if (profileCurrency === 'BRL') setPaymentMethod('pix');
    else setPaymentMethod('paypal');
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  function convertPrice(aoaPrice: number, targetCurrency: string): number {
    const rate = CONVERSION_RATES[targetCurrency] ?? 1;
    return Math.round(aoaPrice * rate * 100) / 100;
  }

  function getAvailablePaymentMethods() {
    return PAYMENT_METHODS.filter((m) => m.currencies.includes(selectedCurrency));
  }

  async function subscribe(plan: SubscriptionPlan) {
    if (!user || Number(plan.price_monthly) === 0) return;
    setCheckoutError(null);
    setShowPaymentModal(plan);
  }

  async function confirmPayment() {
    if (!user || !showPaymentModal) return;
    setProcessing(showPaymentModal.id);
    setCheckoutError(null);
    const { data, error } = await supabase.rpc('request_plan_checkout', {
      p_plan_id: showPaymentModal.id,
      p_billing_cycle: billingCycle,
      p_payment_method: paymentMethod,
    });
    setProcessing(null);
    const checkout = data as { checkout_url?: string; reference?: string } | null;
    if (error || !checkout?.checkout_url) {
      setCheckoutError(
        error?.message.includes('checkout_unavailable')
          ? 'Este plano ainda não tem checkout disponível. Tenta novamente mais tarde.'
          : 'Não foi possível abrir o checkout deste plano. Tenta novamente mais tarde.',
      );
      return;
    }
    window.open(checkout.checkout_url, '_blank', 'noopener,noreferrer');
    setPendingReference(checkout.reference ?? null);
    setShowPaymentModal(null);
  }

  if (loading) {
    return <div className="flex justify-center py-16"><LoadingSpinner size={32} /></div>;
  }

  const currentPlanSlug = subscription ? plans.find((p) => p.id === subscription.plan_id)?.slug : profile?.plan ?? 'free';
  const currentCurrency = CURRENCIES.find((c) => c.code === selectedCurrency)!;
  const availableMethods = getAvailablePaymentMethods();
  const planNames = plans.map((p) => p.name);
  const modalPrice = showPaymentModal ? convertPrice(billingCycle === 'monthly' ? Number(showPaymentModal.price_monthly) : Number(showPaymentModal.price_yearly), selectedCurrency) : 0;

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-center dark:from-slate-900 dark:via-slate-800 dark:to-black">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-blue-300 ring-1 ring-white/10">
            <Sparkles className="h-3.5 w-3.5" />
            Estúdio IA incluído em todos os planos
          </div>
          <h2 className="text-3xl font-extrabold text-white">Escolhe o teu plano</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Experimenta grátis durante 1 mês. Sem contratos, cancela a qualquer momento.
          </p>
        </div>
      </div>

      {/* Pending checkout notice */}
      {pendingReference && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Pedido criado com a referência <strong>{pendingReference}</strong>. Depois de concluires o pagamento na Kursinha, a ativação é confirmada pela nossa equipa.
          </p>
        </div>
      )}

      {/* Current subscription */}
      {subscription && (
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-500/20 dark:bg-blue-500/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
            <Check className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Plano atual: {plans.find((p) => p.id === subscription.plan_id)?.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {subscription.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'} · Renova em {subscription.current_period_end ? formatDate(subscription.current_period_end) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* Currency + Billing controls */}
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-xs font-medium text-slate-400">Moeda:</span>
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => {
                setSelectedCurrency(c.code);
                if (c.code === 'AOA') setPaymentMethod('multicaixa_express');
                else if (c.code === 'BRL') setPaymentMethod('pix');
                else setPaymentMethod('paypal');
              }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all ${
                selectedCurrency === c.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <span>{c.flag}</span>{c.code}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
              billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`flex items-center gap-1.5 rounded-lg px-6 py-2.5 text-sm font-semibold transition-all ${
              billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Anual
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 dark:bg-green-500/20 dark:text-green-400">-17%</span>
          </button>
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => {
          const Icon = planIcons[plan.slug] ?? CreditCard;
          const gradient = planGradients[plan.slug] ?? 'from-slate-500 to-slate-700';
          const basePrice = billingCycle === 'monthly' ? Number(plan.price_monthly) : Number(plan.price_yearly);
          const convertedPrice = convertPrice(basePrice, selectedCurrency);
          const isCurrent = currentPlanSlug === plan.slug;
          const isPro = plan.slug === 'pro';
          const isPremium = plan.slug === 'premium';
          const isFree = plan.slug === 'free';

          const aiFeatures = plan.features.filter((f) => f.toLowerCase().includes('estúdio') || f.toLowerCase().includes('loppai'));
          const otherFeatures = plan.features.filter((f) => !f.toLowerCase().includes('estúdio') && !f.toLowerCase().includes('loppai'));

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all duration-300 hover:shadow-xl dark:bg-slate-900 ${
                isPro
                  ? 'ring-2 ring-blue-500 lg:scale-[1.04] lg:shadow-xl shadow-blue-500/10'
                  : isPremium
                    ? 'ring-1 ring-amber-400/50 dark:ring-amber-500/30'
                    : 'ring-1 ring-slate-200 dark:ring-slate-800'
              }`}
            >
              {/* Gradient header */}
              <div className={`relative px-5 pt-5 pb-4 bg-gradient-to-br ${gradient}`}>
                {isPro && (
                  <div className="absolute -right-1 top-3 flex items-center gap-1 rounded-l-lg bg-white px-2.5 py-1 text-xs font-bold text-blue-600 shadow-lg">
                    <Star className="h-3 w-3 fill-current" />
                    Popular
                  </div>
                )}
                {isPremium && (
                  <div className="absolute -right-1 top-3 flex items-center gap-1 rounded-l-lg bg-white px-2.5 py-1 text-xs font-bold text-amber-600 shadow-lg">
                    <Crown className="h-3 w-3" />
                    Topo
                  </div>
                )}

                <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="mt-0.5 text-xs text-white/70">{plan.description}</p>

                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">{formatCurrency(convertedPrice, selectedCurrency)}</span>
                  <span className="text-xs text-white/60">/{billingCycle === 'monthly' ? 'mês' : 'ano'}</span>
                </div>
                {billingCycle === 'yearly' && basePrice > 0 && (
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium text-white/80">
                    <TrendingUp className="h-3 w-3" />
                    Poupas {formatCurrency(convertPrice(basePrice * 12 - Number(plan.price_yearly), selectedCurrency), selectedCurrency)}/ano
                  </p>
                )}
                {isFree && <p className="mt-1 text-xs font-medium text-white/70">1 mês gratuito · depois expira</p>}
              </div>

              {/* Body */}
              <div className="flex flex-1 flex-col p-5">
                {/* IA highlight */}
                {aiFeatures.length > 0 && (
                  <div className="mb-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-3 dark:from-blue-500/10 dark:to-indigo-500/10">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Wand2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-400">IA</p>
                    </div>
                    <ul className="space-y-1">
                      {aiFeatures.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-blue-900 dark:text-blue-300">
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-blue-500" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Other features */}
                <ul className="mb-5 flex-1 space-y-2">
                  {otherFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button disabled className="w-full cursor-default rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    <Check className="mr-1.5 inline h-4 w-4" /> Plano atual
                  </button>
                ) : isFree ? (
                  <button disabled className="w-full cursor-default rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    Período gratuito
                  </button>
                ) : (
                  <button
                    onClick={() => subscribe(plan)}
                    disabled={processing === plan.id}
                    className={`group flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] bg-gradient-to-r ${gradient} shadow-lg hover:shadow-xl`}
                  >
                    {processing === plan.id ? <LoadingSpinner size={18} className="text-white" /> : <>
                      <CreditCard className="h-4 w-4 transition-transform group-hover:scale-110" />
                      Pagar {formatCurrency(convertedPrice, selectedCurrency)}
                    </>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison toggle */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowComparison((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <BarChart3 className="h-4 w-4" />
          {showComparison ? 'Ocultar comparação' : 'Comparar todos os planos'}
        </button>
      </div>

      {/* Comparison table */}
      {showComparison && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white">Funcionalidade</th>
                  {planNames.map((name) => (
                    <th key={name} className="px-4 py-4 text-center text-sm font-semibold text-slate-900 dark:text-white">{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((section) => {
                  const CatIcon = section.icon;
                  return (
                    <tbody key={section.category}>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <td colSpan={planNames.length + 1} className="px-6 py-2.5">
                          <div className="flex items-center gap-2">
                            <CatIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{section.category}</span>
                          </div>
                        </td>
                      </tr>
                      {section.items.map((item) => (
                        <tr key={item.label} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                          <td className="px-6 py-3 text-sm text-slate-600 dark:text-slate-400">{item.label}</td>
                          {item.plans.map((value, i) => (
                            <td key={i} className="px-4 py-3 text-center"><ComparisonCell value={value} /></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment methods */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Métodos de pagamento ({currentCurrency.label})
          </h3>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {availableMethods.map((method) => {
            const Icon = method.icon;
            return (
              <div key={method.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Icon className="text-slate-600 dark:text-slate-400" style={{ width: 18, height: 18 }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{method.label}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{method.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Perguntas frequentes</h3>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
          {FAQS.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/30"
              >
                <span className="text-sm font-medium text-slate-900 dark:text-white">{faq.q}</span>
                {openFaq === i ? <X className="h-4 w-4 shrink-0 text-slate-400" /> : <span className="text-lg leading-none text-slate-400">+</span>}
              </button>
              {openFaq === i && <div className="px-6 pb-4"><p className="text-sm text-slate-600 dark:text-slate-400">{faq.a}</p></div>}
            </div>
          ))}
        </div>
      </div>

      {/* Payment modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowPaymentModal(null)} />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-slide-up dark:bg-slate-900">
            <div className={`px-6 py-5 bg-gradient-to-br ${planGradients[showPaymentModal.slug] ?? 'from-blue-600 to-blue-800'}`}>
              <h3 className="text-lg font-bold text-white">Confirmar subscrição</h3>
              <p className="mt-0.5 text-sm text-white/80">
                Plano <strong>{showPaymentModal.name}</strong> · {billingCycle === 'monthly' ? 'Mensal' : 'Anual'}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-5 flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Valor a pagar</p>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(modalPrice, selectedCurrency)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Moeda</p>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{currentCurrency.flag} {currentCurrency.label}</p>
                </div>
              </div>

              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Escolhe o método de pagamento</label>
              <div className="mb-4 space-y-2">
                {availableMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <button
                      key={method.id}
                      disabled={!method.available}
                      onClick={() => method.available && setPaymentMethod(method.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
                        !method.available
                          ? 'cursor-not-allowed border-slate-200 opacity-60 dark:border-slate-700'
                          : paymentMethod === method.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-500/10'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${paymentMethod === method.id ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <Icon className="text-slate-600 dark:text-slate-400" style={{ width: 20, height: 20 }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{method.label}</p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{method.desc}</p>
                      </div>
                      {!method.available ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">Indisponível</span>
                      ) : (
                        paymentMethod === method.id && <Check className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5 flex items-start gap-2.5 rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Serás encaminhado para o checkout oficial da Kursinha. O plano é ativado depois de a nossa equipa confirmar o pagamento.
                </p>
              </div>

              {checkoutError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{checkoutError}</p>}

              <div className="flex gap-3">
                <button onClick={() => setShowPaymentModal(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancelar
                </button>
                <button
                  onClick={confirmPayment}
                  disabled={processing === showPaymentModal.id}
                  className={`flex flex-[2] items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-[0.98] bg-gradient-to-r ${planGradients[showPaymentModal.slug] ?? 'from-blue-600 to-blue-800'} shadow-lg hover:shadow-xl`}
                >
                  {processing === showPaymentModal.id ? <LoadingSpinner size={18} className="text-white" /> : <>
                    <CreditCard className="h-4 w-4" />
                    Ir para o checkout
                  </>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
