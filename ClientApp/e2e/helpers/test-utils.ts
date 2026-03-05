/**
 * Shared Playwright Test Utilities
 *
 * Common helpers for e2e tests — page navigation, waiting, assertions.
 */
import { type Page, expect } from '@playwright/test';

/**
 * Login through the UI (fills login form and submits).
 * Use this when you need browser-based auth (cookies, localStorage).
 * For API-only tests, use helpers/auth.ts instead.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|login|se connecter/i }).click();
  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10000,
  });
}

/**
 * Assert that the page has no console errors.
 * Call this after page actions to ensure no runtime errors.
 */
export async function assertNoConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

/**
 * Wait for the loading state to resolve.
 * Many pages show a loading spinner — wait for it to disappear.
 */
export async function waitForDataLoad(page: Page): Promise<void> {
  // Wait for any loading indicator to disappear
  const loader = page.locator('[data-testid="loading"], .animate-spin, [role="progressbar"]');
  if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
    await loader.waitFor({ state: 'hidden', timeout: 15000 });
  }
}

/**
 * Take a named screenshot for debugging.
 */
export async function debugScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `ClientApp/test-results/debug-${name}-${Date.now()}.png`,
    fullPage: true,
  });
}

/**
 * Collect all network failures during an action.
 */
export async function collectNetworkErrors(
  page: Page,
  action: () => Promise<void>
): Promise<Array<{ url: string; status: number }>> {
  const failures: Array<{ url: string; status: number }> = [];

  const handler = (response: { url: () => string; status: () => number }) => {
    if (response.status() >= 400) {
      failures.push({ url: response.url(), status: response.status() });
    }
  };

  page.on('response', handler);
  await action();
  page.off('response', handler);

  return failures;
}

/**
 * Assert a toast notification appears with expected text.
 */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  const toast = page.locator('[role="status"], .react-hot-toast, [data-testid="toast"]');
  await expect(toast.filter({ hasText: text })).toBeVisible({ timeout: 5000 });
}

/**
 * Navigate and wait for the page to be fully loaded.
 */
export async function navigateAndWait(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
  await waitForDataLoad(page);
}
