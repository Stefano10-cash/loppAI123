import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationsContext';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner, EmptyState, TableSkeleton } from '@/components/ui/Loading';
import { OrderStatusBadge } from '@/components/ui/Badges';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Order, OrderItem, OrderStatus, Product, Coupon } from '@/types';
import {
  ShoppingCart, Plus, Search, Eye, ShoppingBag, Euro, Clock, CheckCircle,
  Trash2, Tag, CreditCard, User, Mail, Phone, StickyNote, Package, Receipt,
} from 'lucide-react';

const PAYMENT_METHODS = ['PayPal', 'Visa', 'Mastercard', 'Google Pay', 'Apple Pay', 'Multicaixa Express', 'Pix', 'Transferência'];

const ORDER_STATUSES: OrderStatus[] = [
  'pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded',
];

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  shipped: 'Enviado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

function statusLabel(status: OrderStatus): string {
  return statusLabels[status] ?? status;
}

interface NewOrderItem {
  product_id: string;
  quantity: number;
}

export function OrdersPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | OrderStatus>('all');

  // Details modal
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);
  const [detailsItems, setDetailsItems] = useState<(OrderItem & { product: Product | null })[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // New order modal
  const [createOpen, setCreateOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    payment_method: 'Multicaixa Express',
    coupon_code: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<NewOrderItem[]>([{ product_id: '', quantity: 1 }]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponMessage, setCouponMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error) setOrders((data ?? []) as Order[]);
    setLoading(false);
  }

  async function loadProducts() {
    if (!user) return;
    setProductsLoading(true);
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['published', 'draft'])
      .order('name', { ascending: true });
    setProducts((data ?? []) as Product[]);
    setProductsLoading(false);
  }

  useEffect(() => {
    load();
  }, [user]);

  // --- Stats ---
  const totalOrders = orders.length;
  const revenue = orders
    .filter((o) => o.status === 'paid' || o.status === 'completed')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;
  const currency = orders[0]?.currency ?? 'AOA';

  // --- Filtering ---
  const filtered = orders.filter((o) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.customer_name.toLowerCase().includes(q) ||
      o.customer_email.toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // --- Details modal ---
  async function openDetails(order: Order) {
    setDetailsOrder(order);
    setDetailsItems([]);
    setDetailsLoading(true);
    const { data } = await supabase
      .from('order_items')
      .select('*, product:products(*)')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    setDetailsItems((data ?? []) as (OrderItem & { product: Product | null })[]);
    setDetailsLoading(false);
  }

  async function handleStatusChange(status: OrderStatus) {
    if (!detailsOrder) return;
    setUpdatingStatus(true);
    const { error } = await supabase.from('orders').update({ status }).eq('id', detailsOrder.id);
    if (!error) {
      const updated = { ...detailsOrder, status };
      setDetailsOrder(updated);
      setOrders((prev) => prev.map((o) => (o.id === detailsOrder.id ? updated : o)));
      await addNotification({
        title: 'Estado atualizado',
        message: `Pedido #${detailsOrder.id.slice(0, 8)} marcado como "${statusLabel(status)}".`,
        type: 'order',
      });
    } else {
      await addNotification({
        title: 'Erro',
        message: 'Não foi possível atualizar o estado do pedido.',
        type: 'error',
      });
    }
    setUpdatingStatus(false);
  }

  // --- New order helpers ---
  const subtotal = lineItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.product_id);
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.discount_type === 'percentage') {
      discount = (subtotal * Number(appliedCoupon.discount_value)) / 100;
    } else {
      discount = Math.min(Number(appliedCoupon.discount_value), subtotal);
    }
  }
  const newOrderTotal = Math.max(0, subtotal - discount);

  function addLineItem() {
    setLineItems([...lineItems, { product_id: '', quantity: 1 }]);
  }

  function updateLineItem(index: number, field: keyof NewOrderItem, value: string | number) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function checkCoupon() {
    const code = orderForm.coupon_code.trim();
    if (!code || !user) return;
    setCheckingCoupon(true);
    setCouponMessage(null);
    setAppliedCoupon(null);
    const { data } = await supabase
      .from('coupons')
      .select('*')
      .eq('user_id', user.id)
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle();
    const coupon = data as Coupon | null;

    if (!coupon) {
      setCouponMessage({ type: 'error', text: 'Cupão inválido ou inativo.' });
    } else if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      setCouponMessage({ type: 'error', text: 'Este cupão já expirou.' });
    } else if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      setCouponMessage({ type: 'error', text: 'Este cupão atingiu o limite de utilizações.' });
    } else {
      setAppliedCoupon(coupon);
      setCouponMessage({
        type: 'success',
        text:
          coupon.discount_type === 'percentage'
            ? `Cupão aplicado: ${Number(coupon.discount_value)}% de desconto.`
            : `Cupão aplicado: ${formatCurrency(Number(coupon.discount_value))} de desconto.`,
      });
    }
    setCheckingCoupon(false);
  }

  function resetForm() {
    setOrderForm({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      payment_method: 'Multicaixa Express',
      coupon_code: '',
      notes: '',
    });
    setLineItems([{ product_id: '', quantity: 1 }]);
    setAppliedCoupon(null);
    setCouponMessage(null);
  }

  function openCreate() {
    resetForm();
    setCreateOpen(true);
    loadProducts();
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const validItems = lineItems.filter((i) => i.product_id && i.quantity > 0);
    if (!orderForm.customer_name.trim() || !orderForm.customer_email.trim() || validItems.length === 0) {
      await addNotification({
        title: 'Dados em falta',
        message: 'Preenche os dados do cliente e adiciona pelo menos um produto.',
        type: 'warning',
      });
      return;
    }

    setSavingOrder(true);

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        customer_name: orderForm.customer_name.trim(),
        customer_email: orderForm.customer_email.trim(),
        customer_phone: orderForm.customer_phone.trim(),
        status: 'pending',
        total: newOrderTotal,
        currency: 'AOA',
        payment_method: orderForm.payment_method,
        coupon_code: appliedCoupon?.code ?? '',
        notes: orderForm.notes.trim(),
      })
      .select()
      .single();

    if (orderError || !orderData) {
      await addNotification({
        title: 'Erro',
        message: 'Não foi possível criar o pedido. Tenta novamente.',
        type: 'error',
      });
      setSavingOrder(false);
      return;
    }

    const newOrder = orderData as Order;

    const itemsPayload = validItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      return {
        order_id: newOrder.id,
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: Number(product.price),
        total_price: Number(product.price) * item.quantity,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);

    if (itemsError) {
      await addNotification({
        title: 'Aviso',
        message: 'Pedido criado, mas ocorreu um erro ao adicionar alguns itens.',
        type: 'warning',
      });
    } else {
      if (appliedCoupon) {
        await supabase
          .from('coupons')
          .update({ used_count: appliedCoupon.used_count + 1 })
          .eq('id', appliedCoupon.id);
      }
      await addNotification({
        title: 'Pedido criado',
        message: `Pedido para ${orderForm.customer_name} criado com sucesso.`,
        type: 'success',
      });
    }

    setSavingOrder(false);
    setCreateOpen(false);
    resetForm();
    load();
  }

  // --- Stat card component ---
  function StatCard({
    icon: Icon,
    label,
    value,
    accent,
  }: {
    icon: typeof ShoppingCart;
    label: string;
    value: string;
    accent: string;
  }) {
    return (
      <div className="card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pedidos</h2>
          <p className="text-sm text-slate-500">Acompanha e gere os pedidos da tua loja.</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-4 w-4" />
          Novo Pedido
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ShoppingBag}
          label="Total pedidos"
          value={String(totalOrders)}
          accent="bg-blue-100 text-blue-600"
        />
        <StatCard
          icon={Euro}
          label="Receita"
          value={formatCurrency(revenue, currency)}
          accent="bg-green-100 text-green-600"
        />
        <StatCard
          icon={Clock}
          label="Pendentes"
          value={String(pendingCount)}
          accent="bg-amber-100 text-amber-600"
        />
        <StatCard
          icon={CheckCircle}
          label="Concluídos"
          value={String(completedCount)}
          accent="bg-emerald-100 text-emerald-600"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar por cliente ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | OrderStatus)}
          className="input sm:w-52"
        >
          <option value="all">Todos os estados</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="Nenhum pedido encontrado"
            description="Ainda não existem pedidos. Cria um pedido manualmente ou aguarda que os clientes comprem na tua loja."
            action={
              <button onClick={openCreate} className="btn-primary">
                <Plus className="h-4 w-4" />
                Criar pedido
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Estado</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Pagamento</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{order.customer_name}</p>
                        <p className="truncate text-xs text-slate-500">{order.customer_email}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {formatCurrency(Number(order.total), order.currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                        {order.payment_method || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDateTime(order.created_at)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetails(order)}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
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

      {/* Details Modal */}
      <Modal
        open={!!detailsOrder}
        onClose={() => setDetailsOrder(null)}
        title="Detalhes do Pedido"
        size="lg"
      >
        {detailsOrder && (
          <div className="space-y-6">
            {/* Summary header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Pedido #{detailsOrder.id.slice(0, 8)}
                </p>
                <p className="mt-0.5 text-lg font-bold text-slate-900">
                  {formatCurrency(Number(detailsOrder.total), detailsOrder.currency)}
                </p>
              </div>
              <OrderStatusBadge status={detailsOrder.status} />
            </div>

            {/* Status update */}
            <div>
              <label className="label">Alterar estado do pedido</label>
              <div className="flex items-center gap-3">
                <select
                  value={detailsOrder.status}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                  disabled={updatingStatus}
                  className="input flex-1"
                >
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
                {updatingStatus && <LoadingSpinner size={18} />}
              </div>
            </div>

            {/* Customer info */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <User className="h-4 w-4" /> Cliente
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <User className="h-3.5 w-3.5" /> Nome
                  </p>
                  <p className="text-sm font-medium text-slate-900">{detailsOrder.customer_name}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </p>
                  <p className="truncate text-sm font-medium text-slate-900">
                    {detailsOrder.customer_email}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <Phone className="h-3.5 w-3.5" /> Telefone
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    {detailsOrder.customer_phone || '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <Package className="h-4 w-4" /> Artigos
              </h3>
              {detailsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size={28} />
                </div>
              ) : detailsItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                  Sem artigos associados a este pedido.
                </p>
              ) : (
                <div className="space-y-2">
                  {detailsItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                        {item.product?.cover_image_url ? (
                          <img
                            src={item.product.cover_image_url}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <Package className="h-5 w-5 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.quantity} × {formatCurrency(Number(item.unit_price), detailsOrder.currency)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(Number(item.total_price), detailsOrder.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Meta info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <CreditCard className="h-3.5 w-3.5" /> Método de pagamento
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {detailsOrder.payment_method || '—'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Tag className="h-3.5 w-3.5" /> Cupão
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {detailsOrder.coupon_code ? (
                    <span className="badge bg-purple-100 text-purple-700">{detailsOrder.coupon_code}</span>
                  ) : (
                    'Nenhum'
                  )}
                </p>
              </div>
            </div>

            {/* Notes */}
            {detailsOrder.notes && (
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                  <StickyNote className="h-4 w-4" /> Notas
                </h3>
                <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  {detailsOrder.notes}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button onClick={() => setDetailsOrder(null)} className="btn-secondary">
                Fechar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Order Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Novo Pedido"
        size="xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-5">
          {/* Customer */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
              <User className="h-4 w-4" /> Dados do cliente
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Nome *</label>
                <input
                  required
                  value={orderForm.customer_name}
                  onChange={(e) => setOrderForm({ ...orderForm, customer_name: e.target.value })}
                  className="input"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  required
                  type="email"
                  value={orderForm.customer_email}
                  onChange={(e) => setOrderForm({ ...orderForm, customer_email: e.target.value })}
                  className="input"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input
                  value={orderForm.customer_phone}
                  onChange={(e) => setOrderForm({ ...orderForm, customer_phone: e.target.value })}
                  className="input"
                  placeholder="+351 9XX XXX XXX"
                />
              </div>
            </div>
          </div>

          {/* Products */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <Package className="h-4 w-4" /> Artigos
              </h3>
              <button type="button" onClick={addLineItem} className="btn-ghost text-blue-600">
                <Plus className="h-4 w-4" /> Adicionar artigo
              </button>
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-6">
                <LoadingSpinner size={24} />
              </div>
            ) : products.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                Não tens produtos disponíveis. Cria produtos primeiro.
              </p>
            ) : (
              <div className="space-y-2">
                {lineItems.map((item, index) => {
                  const product = products.find((p) => p.id === item.product_id);
                  const lineTotal = product ? Number(product.price) * item.quantity : 0;
                  return (
                    <div key={index} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateLineItem(index, 'product_id', e.target.value)}
                        className="input flex-1"
                      >
                        <option value="">Selecionar produto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {formatCurrency(Number(p.price), p.currency)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, 'quantity', Math.max(1, Number(e.target.value)))}
                        className="input w-20 text-center"
                        placeholder="Qtd"
                      />
                      <div className="w-28 text-right text-sm font-medium text-slate-900">
                        {lineTotal > 0 ? formatCurrency(lineTotal, product?.currency ?? 'EUR') : '—'}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        disabled={lineItems.length === 1}
                        title="Remover artigo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal, 'EUR')}</span>
              </div>
              {appliedCoupon && (
                <div className="flex justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5" /> Desconto ({appliedCoupon.code})
                  </span>
                  <span className="font-medium">−{formatCurrency(discount, 'EUR')}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
                <span>Total</span>
                <span>{formatCurrency(newOrderTotal, 'EUR')}</span>
              </div>
            </div>
          </div>

          {/* Payment + Coupon */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Método de pagamento *</label>
              <select
                value={orderForm.payment_method}
                onChange={(e) => setOrderForm({ ...orderForm, payment_method: e.target.value })}
                className="input"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Cupão de desconto</label>
              <div className="flex gap-2">
                <input
                  value={orderForm.coupon_code}
                  onChange={(e) => {
                    setOrderForm({ ...orderForm, coupon_code: e.target.value });
                    if (appliedCoupon) {
                      setAppliedCoupon(null);
                      setCouponMessage(null);
                    }
                  }}
                  className="input flex-1"
                  placeholder="Código do cupão"
                />
                <button
                  type="button"
                  onClick={checkCoupon}
                  disabled={checkingCoupon || !orderForm.coupon_code.trim()}
                  className="btn-secondary"
                >
                  {checkingCoupon ? <LoadingSpinner size={18} /> : 'Aplicar'}
                </button>
              </div>
              {couponMessage && (
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    couponMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {couponMessage.text}
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notas internas</label>
            <textarea
              value={orderForm.notes}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
              className="input min-h-[70px] resize-y"
              placeholder="Notas sobre o pedido (opcional)..."
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">
              O estado inicial do pedido será <span className="font-medium text-amber-600">Pendente</span>.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCreateOpen(false)} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={savingOrder} className="btn-primary">
                {savingOrder ? (
                  <LoadingSpinner size={18} className="text-white" />
                ) : (
                  <>
                    <Receipt className="h-4 w-4" />
                    Criar pedido
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
