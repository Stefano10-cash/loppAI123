import { Building2, CreditCard, Smartphone, Wallet, type LucideIcon } from 'lucide-react';
import type { PaymentMethodId } from '@/types';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  icon: LucideIcon;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2 },
  { id: 'visa', label: 'Visa', icon: CreditCard },
  { id: 'mastercard', label: 'MasterCard', icon: CreditCard },
  { id: 'paypal', label: 'PayPal', icon: Wallet },
  { id: 'pix', label: 'Pix', icon: Smartphone },
];

export interface MethodStatus {
  id: string;
  label: string;
  icon: LucideIcon;
  available: boolean;
}

export const WITHDRAWAL_METHODS: MethodStatus[] = [
  { id: 'multicaixa_express', label: 'Multicaixa Express', icon: Building2, available: true },
  { id: 'visa', label: 'Visa', icon: CreditCard, available: false },
  { id: 'mastercard', label: 'MasterCard', icon: CreditCard, available: false },
  { id: 'paypal', label: 'PayPal', icon: Wallet, available: false },
  { id: 'pix', label: 'Pix', icon: Smartphone, available: false },
];
