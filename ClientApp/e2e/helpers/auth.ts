/**
 * Shared Playwright Authentication Helpers
 *
 * Provides reusable login functions for e2e tests.
 * Extracts the pattern from payment-authorization.spec.ts for reuse.
 */
import { expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:5001';

/** Default test credentials */
export const TEST_ACCOUNTS = {
  manager: {
    email: process.env.MANAGER_EMAIL || 'AHT@gmail.com',
    password: process.env.MANAGER_PASSWORD || 'AHT@gmail.com',
  },
  user: {
    email: process.env.USER_EMAIL || 'user@test.com',
    password: process.env.USER_PASSWORD || 'TestPass123!',
  },
} as const;

export interface LoginResult {
  accessToken: string;
  role: string;
  userId?: string;
  companyId?: string;
}

/**
 * Login via the API and return the JWT token + metadata.
 */
export async function loginAndGetToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<LoginResult> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });

  expect(
    response.ok(),
    `Login failed for ${email}: ${response.status()} ${await response.text()}`
  ).toBeTruthy();

  const body = await response.json();

  return {
    accessToken: body.accessToken,
    role: body.user?.role ?? 'Unknown',
    userId: body.user?.id,
    companyId: body.user?.companyId,
  };
}

/**
 * Login as the default manager account.
 */
export async function loginAsManager(request: APIRequestContext): Promise<LoginResult> {
  return loginAndGetToken(
    request,
    TEST_ACCOUNTS.manager.email,
    TEST_ACCOUNTS.manager.password
  );
}

/**
 * Login as the default user account.
 */
export async function loginAsUser(request: APIRequestContext): Promise<LoginResult> {
  return loginAndGetToken(
    request,
    TEST_ACCOUNTS.user.email,
    TEST_ACCOUNTS.user.password
  );
}

/**
 * Create an authenticated API request context header object.
 */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Get the API base URL.
 */
export function getApiUrl(): string {
  return API_URL;
}
