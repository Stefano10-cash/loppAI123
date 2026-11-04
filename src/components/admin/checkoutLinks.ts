import { supabase } from '@/lib/supabase';
import type { PaymentMethodId, PlanCheckout } from '@/types';

export type BillingCycle = PlanCheckout['billing_cycle'];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
};

export function isValidCheckoutUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

interface SaveCheckoutLinkInput {
  planId: string;
  billingCycle: BillingCycle;
  paymentMethod: PaymentMethodId;
  productName: string;
  checkoutUrl: string;
  isActive: boolean;
}

export async function saveCheckoutLink(input: SaveCheckoutLinkInput): Promise<{ error: { message: string } | null }> {
  const { error } = await supabase.rpc('admin_save_plan_checkout', {
    p_plan_id: input.planId,
    p_billing_cycle: input.billingCycle,
    p_payment_method: input.paymentMethod,
    p_product_name: input.productName.trim(),
    p_checkout_url: input.checkoutUrl.trim(),
    p_is_active: input.isActive,
  });
  return { error: error ? { message: error.message } : null };
}
