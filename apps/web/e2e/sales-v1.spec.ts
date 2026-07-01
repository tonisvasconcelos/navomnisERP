import { test, expect } from '@playwright/test';

/**
 * Cenário congelado V1 (ver docs/v1-scenario.md).
 * Requer API em VITE_API_URL (build) acessível a partir do browser.
 */
test.describe('V1 sales (web)', () => {
  test('login → novo pedido → linha → libertar → ledger mostra SALES_RELEASE', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@demo.navomnis.local');
    await page.locator('#password').fill('Admin123!');
    await page.locator('#tenant').fill('demo');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL(/\//);
    await expect(page.getByRole('heading', { name: 'Painel' })).toBeVisible();
    await expect(page.getByTestId('nav-sales')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('sales-new-order').click();
    await expect(page.getByTestId('sales-order-title')).toBeVisible();
    await expect(page.getByTestId('sales-order-status')).toHaveText('Rascunho');

    await expect(page.getByTestId('sales-line-uom')).toHaveValue(/.+/, { timeout: 15_000 });
    await page.getByTestId('sales-line-qty').fill('2');
    await page.getByTestId('sales-line-price').fill('10');
    await page.getByTestId('sales-add-line').click();
    await expect(page.getByRole('cell', { name: 'ITEM-001' })).toBeVisible();

    await page.locator('tr:has-text("ITEM-001")').getByRole('button', { name: 'Editar' }).click();
    await page.getByTestId('sales-line-edit-qty').fill('3');
    await page.getByTestId('sales-line-edit-save').click();

    await page.getByTestId('sales-release').click();
    await expect(page.getByTestId('release-confirm-modal')).toBeVisible();
    await page.getByTestId('release-confirm').click();
    await expect(page.getByTestId('sales-order-status')).toHaveText('Aberto');

    await page.goto('/audit');
    await expect(page.getByTestId('audit-page-title')).toBeVisible();

    await page.goto('/inventory');
    await expect(page.getByText('SALES_RELEASE').first()).toBeVisible();
  });
});
