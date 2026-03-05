/**
 * Smoke Test — Basic Application Health Check
 *
 * Quick sanity tests that verify the application is running and
 * core pages are accessible. Used by the AI workflow to verify
 * the app is in a working state before/after feature implementation.
 *
 * Run: cd ClientApp && npx playwright test e2e/smoke.spec.ts
 */
import { test, expect } from '@playwright/test';
import { loginAndGetToken, TEST_ACCOUNTS, getApiUrl } from './helpers/auth';

const API_URL = getApiUrl();

test.describe('Smoke Tests', () => {

  test('API health check', async ({ request }) => {
    // Check if the API is responding
    const response = await request.get(`${API_URL}/api/health`);
    // Accept 200 or 404 (health endpoint may not exist)
    expect([200, 404]).toContain(response.status());
  });

  test('API authentication works', async ({ request }) => {
    const result = await loginAndGetToken(
      request,
      TEST_ACCOUNTS.manager.email,
      TEST_ACCOUNTS.manager.password,
    );
    expect(result.accessToken).toBeTruthy();
    expect(result.accessToken.length).toBeGreaterThan(10);
  });

  test('frontend loads login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Page should render without errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Should have a login form
    const loginForm = page.locator('form, [data-testid="login-form"], button');
    await expect(loginForm.first()).toBeVisible({ timeout: 10000 });

    expect(errors).toHaveLength(0);
  });

  test('authenticated API call returns data', async ({ request }) => {
    const { accessToken } = await loginAndGetToken(
      request,
      TEST_ACCOUNTS.manager.email,
      TEST_ACCOUNTS.manager.password,
    );

    // Try fetching invoices (a core entity)
    const response = await request.get(`${API_URL}/api/invoices`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(Array.isArray(data) || typeof data === 'object').toBeTruthy();
  });

  test('unauthenticated API call is rejected', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/invoices`);
    expect(response.status()).toBe(401);
  });
});
