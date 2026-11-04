import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, CardSkeleton } from '@/components/ui/Loading';
import { WithdrawalStatusBadge } from '@/components/ui/Badges';
import { formatCurrency, formatDateTime, convertCurrency } from '@/lib/utils';
import type { Withdrawal, WithdrawalMethod, Order, AgeVerification } from '@/types';
import {
  Wallet, Plus, ArrowDownToLine, CreditCard, Building2, Smartphone,
  Nfc, Check, Info, TrendingUp, Clock, ShieldCheck, AlertTriangle,
} from 'lucide-react';

const CURRENCIES = [
  { code: 'AOA', label: 'Kwanza Angolano', symbol: 'Kz', flag: '🇦🇴' },
  { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'USD', label: 'Dólar Americano', symbol: '$', flag: '🇺🇸' },
  { code: 'BRL', label: 'Real Brasileiro', symbol: 'R$', flag: '🇧🇷' },
];

const PAYMENT_METHODS: { id: WithdrawalMethod; label: string; icon: typeof Wallet; desc: string; currencies: string[] }[] = [
  { id: 'visa', label: 'Visa', icon: CreditCard, desc: 'Transferência para cartão Visa', currencies: ['AOA', 'EUR', 'USD', 'BRL'] },
  { id: 'mastercard', label: 'Mastercard', icon: CreditCard, desc: 'Transferência para cartão Mastercard', currencies: ['AOA', 'EUR', 'USD', 'BRL'] },
  { id: 'paypal', label: 'PayPal', icon: Wallet, desc: 'Transferência via PayPal', currencies: ['AOA', 'EUR', 'USD', 'BRL'] },
  { id: 'google_pay', label: 'Google Pay', icon: Smartphone, desc: 'Transferência via Google Pay', currencies: ['EUR', 'USD', 'BRL'] },
  { id: 'apple_pay', label: 'Apple Pay', icon: Nfc, desc: 'Transferência via Apple Pay', currencies: ['EUR', 'USD', 'BRL'] },
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2, desc: 'Transferência via bancos angolanos', currencies: ['AOA'] },
  { id: 'pix', label: 'Pix', icon: Smartphone, desc: 'Transferência instantânea via Pix', currencies: ['BRL'] },
];

const METHOD_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  paypal: 'PayPal',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
  multicaixa_express: 'Multicaixa Express',
  pix: 'Pix',
};

export function WithdrawalsPage({ onNavigate }: { onNavigate?: (page: 'age-verification') => void }) {
  const { user, profile } = useAuth();
  const { addNotification } = useNotifications();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [verification, setVerification] = useState<AgeVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('AOA');
  const [method, setMethod] = useState<WithdrawalMethod>('multicaixa_express');
  const [accountRef, setAccountRef] = useState('');
  const [notes, setNotes] = useState('');

  const profileCurrency = profile?.currency ?? 'AOA';

  async function load() {
    if (!user) return;
    setLoading(true);
    const [wRes, oRes, vRes] = await Promise.all([
      supabase.from('withdrawals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('age_verifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    setWithdrawals((wRes.data ?? []) as Withdrawal[]);
    setOrders((oRes.data ?? []) as Order[]);
    setVerification((vRes.data as AgeVerification | null) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    setCurrency(profileCurrency);
    if (profileCurrency === 'AOA') setMethod('multicaixa_express');
    else if (profileCurrency === 'BRL') setMethod('pix');
    else setMethod('paypal');
  }, [profileCurrency]);

  const paidOrders = orders.filter((o) => o.status === 'paid' || o.status === 'completed');
  const totalRevenueEUR = paidOrders.reduce((sum, o) => sum + convertCurrency(Number(o.total), (o.currency || 'EUR'), 'EUR'), 0);

  const balanceByCurrency: Record<string, number> = {};
  for (const code of ['AOA', 'EUR', 'USD', 'BRL']) {
    balanceByCurrency[code] = convertCurrency(totalRevenueEUR, 'EUR', code);
  }

  const totalWithdrawn = withdrawals
    .filter((w) => w.status === 'completed')
    .reduce((sum, w) => sum + convertCurrency(Number(w.amount), w.currency, currency), 0);

  const availableMethods = PAYMENT_METHODS.filter((m) => m.currencies.includes(currency));
  const selectedCurrencyInfo = CURRENCIES.find((c) => c.code === currency)!;
  const currentBalance = balanceByCurrency[currency] ?? 0;
  const availableBalance = currentBalance - totalWithdrawn;

  function selectCurrency(code: string) {
    setCurrency(code);
    const methods = PAYMENT_METHODS.filter((m) => m.currencies.includes(code));
    if (methods.length > 0 && !methods.some((m) => m.id === method)) {
      setMethod(methods[0].id);
    }
  }

  async function submitWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > availableBalance) return;

    setSubmitting(true);
    const { error } = await supabase.from('withdrawals').insert({
      user_id: user.id,
      amount: amt,
      currency,
      payment_method: method,
      payment_details: { account_ref: accountRef || undefined },
      status: 'pending',
      notes: notes || undefined,
    });

    setSubmitting(false);
    if (error) {
      addNotification({
        title: 'Erro no saque',
        message: 'Não foi possível processar o pedido de saque. Tenta novamente.',
        type: 'error',
      });
      return;
    }

    addNotification({
      title: 'Saque solicitado',
      message: `Pedido de saque de ${formatCurrency(amt, currency)} via ${METHOD_LABELS[method]} foi registado.`,
      type: 'success',
      link: 'withdrawals',
    });

    setShowModal(false);
    setAmount('');
    setAccountRef('');
    setNotes('');
    load();
  }

  const isVerified = verification?.status === 'approved';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="card p-6"><LoadingSpinner size={24} /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Saques</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Levanta os teus ganhos em 4 moedas e 7 métodos de pagamento.</p>
        </div>
        <button
          onClick={() => isVerified ? setShowModal(true) : onNavigate?.('age-verification')}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          {isVerified ? 'Novo saque' : 'Verificar primeiro'}
        </button>
      </div>

      {/* KYC warning */}
      {!isVerified && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-500/30 dark:bg-amber-500/5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">Verificação de idade obrigatória</p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              {verification?.status === 'pending'
                ? 'A tua verificação está em análise. Aguarda a aprovação para levantar dinheiro.'
                : verification?.status === 'rejected'
                  ? 'A tua verificação foi rejeitada. Submete novamente os teus documentos para levantar dinheiro.'
                  : 'Precisas de verificar a tua identidade e idade (18+) antes de levantar dinheiro. Isso é obrigatório por segurança.'}
            </p>
            <button
              onClick={() => onNavigate?.('age-verification')}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
            >
              <ShieldCheck className="h-4 w-4" />
              Ir para verificação
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CURRENCIES.map((c) => {
          const balance = balanceByCurrency[c.code] ?? 0;
          const withdrawn = withdrawals
            .filter((w) => w.status === 'completed' && w.currency === c.code)
            .reduce((sum, w) => sum + Number(w.amount), 0);
          const available = balance - withdrawn;
          return (
            <div key={c.code} className="card p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{c.flag}</span>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{c.code}</span>
                </div>
                <Wallet className="h-4 w-4 text-slate-300 dark:text-slate-600" />
              </div>
              <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(available, c.code)}
              </p>
              <p className="mt-1 text-xs text-slate-400">Disponível para saque</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-500/20">
              <TrendingUp className="h-4.5 w-4.5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receita total</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(currentBalance, currency)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-500/20">
              <ArrowDownToLine className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Total levantado</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totalWithdrawn, currency)}</p>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/20">
              <Clock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Pendente</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {formatCurrency(
                  withdrawals.filter((w) => w.status === 'pending' || w.status === 'processing')
                    .reduce((sum, w) => sum + convertCurrency(Number(w.amount), w.currency, currency), 0),
                  currency,
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Histórico de saques</h3>
        </div>
        {withdrawals.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Wallet}
              title="Sem saques"
              description="Os teus pedidos de levantamento aparecem aqui. Clica em Novo saque para levantar os teus ganhos."
              action={
                <button onClick={() => setShowModal(true)} className="btn-primary">
                  <Plus className="h-4 w-4" />
                  Novo saque
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                  <th className="px-6 py-3 font-medium">Data</th>
                  <th className="px-6 py-3 font-medium">Montante</th>
                  <th className="px-6 py-3 font-medium">Método</th>
                  <th className="px-6 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3 font-medium">Notas</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800/50">
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{formatDateTime(w.created_at)}</td>
                    <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(Number(w.amount), w.currency)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{METHOD_LABELS[w.payment_method] ?? w.payment_method}</td>
                    <td className="px-6 py-4"><WithdrawalStatusBadge status={w.status} /></td>
                    <td className="px-6 py-4 text-slate-400">{w.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo saque" size="lg">
        <form onSubmit={submitWithdrawal} className="space-y-5">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-500/10">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-300">Saldo disponível em {selectedCurrencyInfo.label}</p>
                <p className="mt-0.5 text-blue-700 dark:text-blue-400/80">
                  {formatCurrency(availableBalance, currency)} — Podes levantar até este valor.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Moeda</label>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCurrency(c.code)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    currency === c.code
                      ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{c.flag}</span>
                  {c.code}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Montante ({selectedCurrencyInfo.symbol})</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={availableBalance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input"
              required
            />
            {availableBalance > 0 && (
              <button
                type="button"
                onClick={() => setAmount(availableBalance.toFixed(2))}
                className="mt-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Usar saldo total: {formatCurrency(availableBalance, currency)}
              </button>
            )}
          </div>

          <div>
            <label className="label">Método de pagamento</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableMethods.map((m) => {
                const Icon = m.icon;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                      method === m.id
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                        : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      method === m.id ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <Icon className={`h-4.5 w-4.5 ${method === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{m.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</p>
                    </div>
                    {method === m.id && <Check className="ml-auto h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="label">Referência da conta {method === 'pix' ? '(chave Pix)' : method === 'multicaixa_express' ? '(IBAN / número)' : method === 'paypal' ? '(email PayPal)' : '(número do cartão)'}</label>
            <input
              type="text"
              value={accountRef}
              onChange={(e) => setAccountRef(e.target.value)}
              placeholder={method === 'pix' ? 'email, telefone ou CPF' : method === 'paypal' ? 'email@exemplo.com' : '0000 0000 0000 0000'}
              className="input"
            />
          </div>

          <div>
            <label className="label">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informação adicional sobre o saque..."
              rows={2}
              className="input resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={submitting || !amount || parseFloat(amount) <= 0} className="btn-primary">
              {submitting ? <LoadingSpinner size={18} className="text-white" /> : <><ArrowDownToLine className="h-4 w-4" /> Confirmar saque</>}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
