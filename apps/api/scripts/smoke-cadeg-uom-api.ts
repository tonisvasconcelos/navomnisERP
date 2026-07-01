/**
 * Read-only smoke check for CADEG UOM rollout (run after API deploy + migrate).
 *
 *   $env:CADEG_SMOKE_API_URL="https://api-production-b645.up.railway.app/api/v1"
 *   $env:CADEG_SMOKE_EMAIL="tester@tester.com"
 *   $env:CADEG_SMOKE_PASSWORD="..."
 *   pnpm cadeg:uom-smoke
 */
const API = (process.env.CADEG_SMOKE_API_URL ?? 'https://api-production-b645.up.railway.app/api/v1').replace(
  /\/$/,
  '',
);
const EMAIL = process.env.CADEG_SMOKE_EMAIL ?? 'tester@tester.com';
const PASSWORD = process.env.CADEG_SMOKE_PASSWORD ?? '';
const TENANT = process.env.CADEG_SMOKE_TENANT ?? 'cadeg';

async function request<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  const body = (await res.json()) as { success?: boolean; data?: T; errors?: { message: string }[] };
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${body.errors?.[0]?.message ?? res.statusText}`);
  }
  return (body.data ?? body) as T;
}

async function main() {
  if (!PASSWORD) {
    console.error('Set CADEG_SMOKE_PASSWORD (and optionally CADEG_SMOKE_EMAIL, CADEG_SMOKE_API_URL).');
    process.exit(1);
  }

  const login = await request<{ accessToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: TENANT }),
  });

  const token = login.accessToken;
  const items = await request<Array<{ id: string; sku: string }>>('/inventory/items', { token });
  const balances = await request<unknown[]>('/inventory/balances', { token });
  const sample = items[0];
  if (!sample) throw new Error('No items in tenant');

  const checks: Record<string, string> = {
    login: 'ok',
    itemCount: String(items.length),
    balanceCount: String(balances.length),
  };

  try {
    await request(`/inventory/items/${sample.id}`, { token });
    checks.itemDetail = 'ok';
  } catch (e) {
    checks.itemDetail = `missing — deploy UOM slice and run migrate deploy (${(e as Error).message})`;
  }

  try {
    await request(`/uom/items/${sample.id}/available?context=sales`, { token });
    checks.uomAvailable = 'ok';
  } catch (e) {
    checks.uomAvailable = `missing — deploy UOM slice (${(e as Error).message})`;
  }

  console.log(JSON.stringify({ phase: 'smoke', tenant: TENANT, sampleSku: sample.sku, checks }, null, 2));

  const ready = checks.itemDetail === 'ok' && checks.uomAvailable === 'ok';
  if (!ready) {
    console.error('UOM endpoints not live yet — complete Phase 1 deploy + migrate, then re-run.');
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
