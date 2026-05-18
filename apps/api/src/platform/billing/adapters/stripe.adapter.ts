import type { BillingProvider } from '../billing-provider.interface';

/** Stub — integração Stripe em fase posterior. */
export class StripeBillingAdapter implements BillingProvider {
  readonly name = 'stripe';

  async createCheckoutSession(_tenantId: string, _planCode: string): Promise<{ url: string }> {
    return { url: 'https://checkout.stripe.com/pay/stub' };
  }

  async handleWebhook(_payload: unknown, _signature: string): Promise<void> {
    // no-op stub
  }
}
