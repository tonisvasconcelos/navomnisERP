export interface BillingProvider {
  readonly name: string;
  createCheckoutSession(tenantId: string, planCode: string): Promise<{ url: string }>;
  handleWebhook(payload: unknown, signature: string): Promise<void>;
}
