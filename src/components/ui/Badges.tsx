import type { ProductStatus, OrderStatus, CampaignStatus, EbookStatus, ProductType, TicketStatus, TicketPriority, AffiliateStatus, WithdrawalStatus } from '@/types';

const productStatusStyles: Record<ProductStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  published: { label: 'Publicado', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  archived: { label: 'Arquivado', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
};

const orderStatusStyles: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  paid: { label: 'Pago', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  shipped: { label: 'Enviado', className: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
  refunded: { label: 'Reembolsado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

const campaignStatusStyles: Record<CampaignStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  scheduled: { label: 'Agendada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  active: { label: 'Ativa', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  completed: { label: 'Concluída', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

const ebookStatusStyles: Record<EbookStatus, { label: string; className: string }> = {
  draft: { label: 'Rascunho', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  generating: { label: 'A gerar', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
};

const productTypeStyles: Record<ProductType, { label: string; className: string }> = {
  digital: { label: 'Digital', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  physical: { label: 'Físico', className: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  ebook: { label: 'Ebook', className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
};

const ticketStatusStyles: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: 'Aberto', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  pending: { label: 'Em análise', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  resolved: { label: 'Resolvido', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  closed: { label: 'Fechado', className: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
};

const ticketPriorityStyles: Record<TicketPriority, { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  high: { label: 'Alta', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

const affiliateStatusStyles: Record<AffiliateStatus, { label: string; className: string }> = {
  active: { label: 'Ativo', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  inactive: { label: 'Inativo', className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  suspended: { label: 'Suspenso', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

const withdrawalStatusStyles: Record<WithdrawalStatus, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
  processing: { label: 'A processar', className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  completed: { label: 'Concluído', className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400' },
  rejected: { label: 'Rejeitado', className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const s = productStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const s = orderStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const s = campaignStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function EbookStatusBadge({ status }: { status: EbookStatus }) {
  const s = ebookStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function ProductTypeBadge({ type }: { type: ProductType }) {
  const s = productTypeStyles[type];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const s = ticketStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const s = ticketPriorityStyles[priority];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function AffiliateStatusBadge({ status }: { status: AffiliateStatus }) {
  const s = affiliateStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}

export function WithdrawalStatusBadge({ status }: { status: WithdrawalStatus }) {
  const s = withdrawalStatusStyles[status];
  return <span className={`badge ${s.className}`}>{s.label}</span>;
}
