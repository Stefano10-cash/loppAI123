import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { LoadingSpinner } from '@/components/ui/Loading';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';
import {
  CreditCard, Wallet, Smartphone, Building2, Nfc, Check,
  ArrowLeft, Shield, Package, Lock, CheckCircle2, XCircle,
} from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2, desc: 'Bancos angolanos' },
  { id: 'visa', label: 'Visa', icon: CreditCard, desc: 'Cartão Visa' },
  { id: 'mastercard', label: 'Mastercard', icon: CreditCard, desc: 'Cartão Mastercard' },
  { id: 'paypal', label: 'PayPal', icon: Wallet, desc: 'Pagamentos internacionais' },
  { id: 'google_pay', label: 'Google Pay', icon: Smartphone, desc: 'Pagamento rápido' },
  { id: 'apple_pay', label: 'Apple Pay', icon: Nfc, desc: 'Pagamento rápido' },
  { id: 'pix', label: 'Pix', icon: Smartphone, desc: 'Pagamento instantâneo' },
];

const CURRENCY_RATES: Record<string, number> = { AOA: 1, EUR: 1 / 1050, USD: 1 / 1134, BRL: 1 / 193 };

interface CheckoutPageProps {
  product: Product;
  onBack: () => void;
}

export function CheckoutPage({ product, onBack }: CheckoutPageProps) {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [selectedMethod, setSelectedMethod] = useState<string>(product.payment_methods?.[0] ?? 'multicaixa_express');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(product.currency);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '', phone: '' });

  function convertPrice(price: number, fromCurrency: string, toCurrency: string): number {
    const fromRate = CURRENCY_RATES[fromCurrency] ?? 1;
    const toRate = CURRENCY_RATES[toCurrency] ?? 1;
    return Math.round((price / fromRate) * toRate * 100) / 100;
  }

  const availableMethods = PAYMENT_METHODS.filter((m) => product.payment_methods?.includes(m.id));
  const convertedPrice = convertPrice(Number(product.price), product.currency, selectedCurrency);
  const sellerName = 'Vendedor LoppAI';

  async function handlePurchase() {
    if (!user) return;
    setProcessing(true);

    try {
      // Create order
      const { data: orderData, error: orderError } = await supabase.from('orders').insert({
        user_id: product.user_id,
        customer_name: customerInfo.name || (user.email ?? ''),
        customer_email: customerInfo.email || (user.email ?? ''),
        customer_phone: customerInfo.phone,
        status: 'paid',
        total: convertedPrice,
        currency: selectedCurrency,
        payment_method: selectedMethod,
        coupon_code: '',
        notes: `Compra de ${product.name}`,
      }).select().single();

      if (orderError) throw orderError;

      // Create order item
      await supabase.from('order_items').insert({
        order_id: orderData.id,
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: convertedPrice,
        total_price: convertedPrice,
      });

      // Create purchase record (for student/buyer mode)
      const { error: purchaseError } = await supabase.from('purchases').insert({
        buyer_id: user.id,
        seller_id: product.user_id,
        product_id: product.id,
        order_id: orderData.id,
        amount: convertedPrice,
        currency: selectedCurrency,
        payment_method: selectedMethod,
        payment_status: 'paid',
      });

      if (purchaseError) {
        // Check if it's a duplicate (UNIQUE constraint)
        if (purchaseError.code === '23505') {
          setResult('failed');
          setProcessing(false);
          return;
        }
        throw purchaseError;
      }

      // Increment product views
      await supabase.rpc('increment_product_views', { product_id: product.id }).then(() => {});

      setResult('success');
      await addNotification({
        title: 'Compra realizada',
        message: `Compraste "${product.name}" por ${formatCurrency(convertedPrice, selectedCurrency)}.`,
        type: 'sale',
      });
    } catch (err) {
      setResult('failed');
    }
    setProcessing(false);
  }

  if (result === 'success') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-500/20">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento confirmado!</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            A tua compra de <strong>{product.name}</strong> foi concluída com sucesso.
            Podes aceder ao produto na secção "Modo Aluno".
          </p>
          <div className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Valor pago</span>
              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(convertedPrice, selectedCurrency)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">Método</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{PAYMENT_METHODS.find((m) => m.id === selectedMethod)?.label}</span>
            </div>
          </div>
          <button onClick={onBack} className="btn-primary mt-6 w-full">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao marketplace
          </button>
        </div>
      </div>
    );
  }

  if (result === 'failed') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20">
            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamento falhou</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Não foi possível processar o pagamento. Tenta novamente ou usa outro método.
          </p>
          <button onClick={() => setResult(null)} className="btn-primary mt-6 w-full">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      {/* Product summary */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          {product.cover_image_url ? (
            <img src={product.cover_image_url} alt="" className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <Package className="h-8 w-8 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{product.name}</h2>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{product.description || product.category}</p>
          <p className="mt-1 text-xs text-slate-400">Vendido por {sellerName}</p>
        </div>
      </div>

      {/* Currency selection */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Moeda de pagamento</label>
        <div className="flex flex-wrap gap-2">
          {(product.accepted_currencies?.length ? product.accepted_currencies : [product.currency]).map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCurrency(c)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                selectedCurrency === c
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div>
        <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">Método de pagamento</label>
        <div className="space-y-2">
          {availableMethods.map((method) => {
            const Icon = method.icon;
            return (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all ${
                  selectedMethod === method.id
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-500/10'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${selectedMethod === method.id ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  <Icon className="text-slate-600 dark:text-slate-400" style={{ width: 20, height: 20 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{method.label}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{method.desc}</p>
                </div>
                {selectedMethod === method.id && <Check className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Customer info */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Dados do comprador</label>
        <input
          type="text"
          placeholder="Nome completo"
          value={customerInfo.name}
          onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
          className="input"
        />
        <input
          type="email"
          placeholder="Email"
          value={customerInfo.email}
          onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
          className="input"
        />
        <input
          type="tel"
          placeholder="Telefone (opcional)"
          value={customerInfo.phone}
          onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
          className="input"
        />
      </div>

      {/* Total */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Total a pagar</span>
          <span className="text-3xl font-extrabold">{formatCurrency(convertedPrice, selectedCurrency)}</span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          Pagamento seguro e encriptado
        </div>
      </div>

      <button
        onClick={handlePurchase}
        disabled={processing || !selectedMethod}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-50"
      >
        {processing ? <LoadingSpinner size={20} className="text-white" /> : (
          <>
            <Shield className="h-5 w-5" />
            Pagar {formatCurrency(convertedPrice, selectedCurrency)}
          </>
        )}
      </button>
    </div>
  );
}
