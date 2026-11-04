import { supabase } from '@/lib/supabase';
import type { PaymentMethodId } from '@/types';

export interface AvailableCheckout {
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  payment_method: PaymentMethodId;
}

export async function fetchAvailableCheckouts(): Promise<AvailableCheckout[] | null> {
  const { data, error } = await supabase.rpc('list_available_checkout_methods');
  if (error || !Array.isArray(data)) return null;
  return data as AvailableCheckout[];
}

export function methodsForPlan(
  rows: AvailableCheckout[],
  planId: string,
  billingCycle: 'monthly' | 'yearly',
): PaymentMethodId[] {
  return rows
    .filter((r) => r.plan_id === planId && r.billing_cycle === billingCycle)
    .map((r) => r.payment_method);
}
