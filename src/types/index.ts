export type ProductType = 'digital' | 'physical' | 'ebook';
export type ProductStatus = 'draft' | 'published' | 'archived';
export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded';
export type CampaignPlatform = 'facebook' | 'whatsapp' | 'instagram' | 'google';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type AdPlatform = 'meta' | 'google';
export type AdAccountStatus = 'connected' | 'expired' | 'disconnected';
export type DiscountType = 'percentage' | 'fixed';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'sale' | 'order' | 'campaign';
export type EbookStatus = 'draft' | 'generating' | 'completed';
export type AffiliateStatus = 'active' | 'inactive' | 'suspended';
export type SubscriptionStatus = 'active' | 'pending' | 'expired' | 'suspended' | 'cancelled';
export type BillingCycle = 'monthly' | 'yearly';
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'general' | 'billing' | 'technical' | 'feature_request' | 'bug' | 'account';
export type TicketMessageSender = 'user' | 'support' | 'ai';
export type ChatRole = 'user' | 'assistant';

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  bio: string;
  company: string;
  phone: string;
  country: string;
  currency: string;
  plan: string;
  age_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgeVerification {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string;
  age: number;
  country: string;
  location: string;
  postal_code: string;
  id_card_front_url: string;
  id_card_back_url: string | null;
  id_card_number: string;
  id_type: 'bilhete_identidade' | 'passaporte' | 'carta_conducao' | 'residencia';
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  banner_url: string;
  theme_color: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  store_id: string | null;
  name: string;
  description: string;
  type: ProductType;
  price: number;
  currency: string;
  cover_image_url: string;
  file_url: string;
  stock: number | null;
  category: string;
  tags: string[];
  status: ProductStatus;
  views: number;
  payment_methods: string[];
  accepted_currencies: string[];
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export type GoalPlanet = 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';
export type GoalType = 'sales' | 'revenue' | 'products' | 'stores' | 'campaigns' | 'affiliates';

export interface SellerGoal {
  id: string;
  user_id: string;
  planet: GoalPlanet;
  planet_name: string;
  goal_type: GoalType;
  target_value: number;
  current_value: number;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Ebook {
  id: string;
  product_id: string;
  user_id: string;
  title: string;
  author: string;
  content: EbookChapter[];
  cover_prompt: string;
  cover_url: string;
  page_count: number;
  language: string;
  status: EbookStatus;
  created_at: string;
  updated_at: string;
}

export interface EbookChapter {
  id: string;
  title: string;
  content: string;
}

export interface SalesPage {
  id: string;
  user_id: string;
  product_id: string | null;
  store_id: string | null;
  title: string;
  slug: string;
  headline: string;
  subheadline: string;
  hero_image_url: string;
  body_content: SalesPageBlock[];
  cta_text: string;
  is_published: boolean;
  views: number;
  created_at: string;
  updated_at: string;
}

export interface SalesPageBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'image' | 'features' | 'testimonial' | 'cta';
  content: string;
  data?: Record<string, unknown>;
}

export interface Coupon {
  id: string;
  user_id: string;
  product_id: string | null;
  store_id: string | null;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  store_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: OrderStatus;
  total: number;
  currency: string;
  payment_method: string;
  coupon_code: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  product_id: string | null;
  store_id: string | null;
  name: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  budget: number;
  currency: string;
  daily_budget: number;
  start_date: string | null;
  end_date: string | null;
  target_audience: string;
  ad_creative: Record<string, unknown>;
  metrics: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
  };
  created_at: string;
  updated_at: string;
}

export interface AdAccount {
  id: string;
  user_id: string;
  platform: AdPlatform;
  platform_account_id: string | null;
  platform_account_name: string | null;
  scopes: string[];
  status: AdAccountStatus;
  connected_at: string;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Affiliate {
  id: string;
  user_id: string;
  name: string;
  email: string;
  referral_code: string;
  commission_rate: number;
  status: AffiliateStatus;
  clicks: number;
  conversions: number;
  total_earnings: number;
  total_paid: number;
  product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  features: string[];
  limits: Record<string, number>;
  is_active: boolean;
  sort_order: number;
  duration_days: number;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  current_period_start: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithPlan extends Subscription {
  subscription_plans?: { name: string; slug: string; price_monthly: number } | null;
}

export type PaymentMethodId = 'multicaixa_express' | 'visa' | 'mastercard' | 'paypal' | 'pix';

export interface PlanCheckout {
  id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  payment_method: PaymentMethodId;
  product_name: string;
  checkout_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PlanPaymentStatus = 'pending' | 'confirmed' | 'rejected';

export interface PlanPayment {
  id: string;
  user_id: string;
  plan_id: string;
  checkout_id: string | null;
  billing_cycle: BillingCycle;
  expected_amount: number;
  currency: string;
  reference: string;
  status: PlanPaymentStatus;
  kursinha_transaction_id: string | null;
  subscription_id: string | null;
  rejection_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  subscription_plans?: { name: string } | null;
}

export interface AdminCustomer {
  user_id: string;
  full_name: string;
  email: string;
  created_at: string;
  plan: string;
  subscription_id: string | null;
  subscription_status: SubscriptionStatus | null;
  period_start: string | null;
  period_end: string | null;
}

export interface AdminPaymentRow {
  payment_id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  plan_name: string;
  reference: string;
  kursinha_transaction_id: string | null;
  expected_amount: number;
  currency: string;
  billing_cycle: BillingCycle;
  status: PlanPaymentStatus;
  created_at: string;
  processed_at: string | null;
}

export interface AdminDashboardStats {
  total_customers: number;
  active_customers: number;
  expired_customers: number;
  active_subscriptions: number;
  confirmed_payments: number;
  pending_payments: number;
  revenue: Record<string, number>;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketMessage {
  id: string;
  ticket_id: string;
  user_id: string;
  sender: TicketMessageSender;
  message: string;
  created_at: string;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  status: 'active' | 'archived';
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'rejected';
export type WithdrawalMethod = 'visa' | 'mastercard' | 'google_pay' | 'apple_pay' | 'paypal' | 'pix' | 'multicaixa_express';

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: WithdrawalMethod;
  payment_details: Record<string, unknown>;
  status: WithdrawalStatus;
  requested_at: string;
  processed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type IntegrationProvider = 'webhook' | 'utmify' | 'otimizaai';

export interface Integration {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  name: string;
  config: Record<string, unknown>;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}
