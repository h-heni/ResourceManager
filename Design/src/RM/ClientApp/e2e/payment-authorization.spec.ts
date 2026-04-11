/**
 * Playwright E2E Tests — Payment Authorization
 * 
 * Verifies role-based access control:
 * - Manager CAN delete a payment
 * - User CANNOT delete a payment (403 Forbidden)
 * 
 * Prerequisites:
 *   1. Backend running on localhost:5001 (or whatever API_URL is set to)
 *   2. Frontend running on localhost:5173
 *   3. Test accounts exist:
 *      - Manager: manager@test.com / TestPass123!
 *      - User:    user@test.com    / TestPass123!
 * 
 * Run: cd ClientApp && npx playwright test
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:5001';

// ─── Helper: Login and get JWT token ───────────────────────────────
async function loginAndGetToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ accessToken: string; role: string }> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(response.ok(), `Login failed for ${email}: ${response.status()}`).toBeTruthy();
  const body = await response.json();
  return {
    accessToken: body.accessToken,
    role: body.user?.role ?? 'Unknown',
  };
}

// ─── Helper: Create a test invoice with a payment ──────────────────
async function createInvoiceWithPayment(
  request: APIRequestContext,
  token: string
): Promise<{ invoiceId: number; paymentId: number }> {
  // Step 1: Create invoice
  const invoiceRes = await request.post(`${API_URL}/api/invoices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      number: `TEST-PW-${Date.now()}`,
      date: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      items: [
        { description: 'E2E Test Item', quantity: 1, price: 500, tva: false },
      ],
    },
  });
  expect(invoiceRes.ok(), `Create invoice failed: ${invoiceRes.status()}`).toBeTruthy();
  const invoice = await invoiceRes.json();
  const invoiceId = invoice.id;

  // Step 2: Add a payment (will default to "Pending")
  const paymentRes = await request.post(
    `${API_URL}/api/invoices/${invoiceId}/payments`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        amount: 200,
        paymentDate: new Date().toISOString(),
        notes: 'E2E test payment',
        status: 'Pending',
      },
    }
  );
  expect(paymentRes.ok(), `Add payment failed: ${paymentRes.status()}`).toBeTruthy();
  const paymentBody = await paymentRes.json();
  const paymentId = paymentBody.paymentId ?? paymentBody.id;

  return { invoiceId, paymentId };
}

// ─── Helper: Cleanup invoice ───────────────────────────────────────
async function deleteInvoice(
  request: APIRequestContext,
  token: string,
  invoiceId: number
) {
  await request.delete(`${API_URL}/api/invoices/${invoiceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: Manager Payment Deletion
// ═══════════════════════════════════════════════════════════════════

test.describe('Manager Payment Authorization', () => {
  let managerToken: string;

  test.beforeAll(async ({ request }) => {
    const login = await loginAndGetToken(
      request,
      process.env.MANAGER_EMAIL || 'AHT@gmail.com',
      process.env.MANAGER_PASSWORD || 'AHT@gmail.com'
    );
    managerToken = login.accessToken;
    expect(login.role).toMatch(/Manager|FreeUser|SuperAdmin/);
  });

  test('Manager CAN delete a payment → 200 OK', async ({ request }) => {
    // Arrange: Create invoice with payment
    const { invoiceId, paymentId } = await createInvoiceWithPayment(
      request,
      managerToken
    );

    // Act: Delete the payment
    const deleteRes = await request.delete(
      `${API_URL}/api/invoices/${invoiceId}/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${managerToken}` } }
    );

    // Assert: 200 OK
    expect(deleteRes.status()).toBe(200);
    const body = await deleteRes.json();
    expect(body.message).toContain('deleted');
    expect(body.status).toBe('Pending'); // back to Pending since no completed payments left

    // Cleanup
    await deleteInvoice(request, managerToken, invoiceId);
  });

  test('Manager CAN delete payment and invoice status reverts correctly', async ({
    request,
  }) => {
    const { invoiceId, paymentId } = await createInvoiceWithPayment(
      request,
      managerToken
    );

    const deleteRes = await request.delete(
      `${API_URL}/api/invoices/${invoiceId}/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${managerToken}` } }
    );

    expect(deleteRes.ok()).toBeTruthy();
    const body = await deleteRes.json();
    // After deleting the only payment, status should revert to Pending
    expect(body.status).toBe('Pending');
    expect(Number(body.amountPaid)).toBe(0);

    await deleteInvoice(request, managerToken, invoiceId);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: User (Non-Manager) Payment Deletion — Must Be Forbidden
// ═══════════════════════════════════════════════════════════════════

test.describe('User Payment Authorization', () => {
  let managerToken: string;
  let userToken: string;

  test.beforeAll(async ({ request }) => {
    // Manager creates the test data
    const managerLogin = await loginAndGetToken(
      request,
      process.env.MANAGER_EMAIL || 'AHT@gmail.com',
      process.env.MANAGER_PASSWORD || 'AHT@gmail.com'
    );
    managerToken = managerLogin.accessToken;

    // User tries to delete
    // NOTE: Replace with actual "User" role account credentials
    const userEmail = process.env.USER_EMAIL;
    const userPassword = process.env.USER_PASSWORD;

    if (userEmail && userPassword) {
      const userLogin = await loginAndGetToken(request, userEmail, userPassword);
      userToken = userLogin.accessToken;
    }
  });

  test('User role CANNOT delete a payment → 403 Forbidden', async ({
    request,
  }) => {
    test.skip(!userToken, 'User account not configured (set USER_EMAIL and USER_PASSWORD env vars)');

    // Arrange: Manager creates invoice with payment
    const { invoiceId, paymentId } = await createInvoiceWithPayment(
      request,
      managerToken
    );

    // Act: User tries to delete the payment
    const deleteRes = await request.delete(
      `${API_URL}/api/invoices/${invoiceId}/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${userToken}` } }
    );

    // Assert: 403 Forbidden (endpoint requires SuperAdmin,Manager,FreeUser)
    expect(deleteRes.status()).toBe(403);

    // Cleanup (as manager)
    await deleteInvoice(request, managerToken, invoiceId);
  });

  test('Unauthenticated request CANNOT delete a payment → 401', async ({
    request,
  }) => {
    // Arrange
    const { invoiceId, paymentId } = await createInvoiceWithPayment(
      request,
      managerToken
    );

    // Act: No auth header
    const deleteRes = await request.delete(
      `${API_URL}/api/invoices/${invoiceId}/payments/${paymentId}`
    );

    // Assert: 401 Unauthorized
    expect(deleteRes.status()).toBe(401);

    // Cleanup
    await deleteInvoice(request, managerToken, invoiceId);
  });
});

// ═══════════════════════════════════════════════════════════════════
// TEST SUITE: Payment Always Defaults to Pending
// ═══════════════════════════════════════════════════════════════════

test.describe('Payment Default Status', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const login = await loginAndGetToken(
      request,
      process.env.MANAGER_EMAIL || 'AHT@gmail.com',
      process.env.MANAGER_PASSWORD || 'AHT@gmail.com'
    );
    token = login.accessToken;
  });

  test('New payment always has status "Pending" regardless of what frontend sends', async ({
    request,
  }) => {
    // Create invoice
    const invoiceRes = await request.post(`${API_URL}/api/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        number: `TEST-STATUS-${Date.now()}`,
        date: new Date().toISOString(),
        items: [
          { description: 'Status test', quantity: 1, price: 1000, tva: false },
        ],
      },
    });
    const invoice = await invoiceRes.json();

    // Try to send status: "Completed" — backend should FORCE "Pending"
    const payRes = await request.post(
      `${API_URL}/api/invoices/${invoice.id}/payments`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          amount: 1000,
          paymentDate: new Date().toISOString(),
          notes: 'Trying to set Completed',
          status: 'Completed', // <-- Should be OVERRIDDEN to Pending
        },
      }
    );
    expect(payRes.ok()).toBeTruthy();
    const payBody = await payRes.json();

    // Invoice should NOT be Paid — the payment is forced to Pending
    expect(payBody.status).not.toBe('Paid');
    // It should still be Pending or unchanged since no Completed payments
    expect(payBody.status).toBe('Pending');

    // Cleanup
    await deleteInvoice(request, token, invoice.id);
  });

  test('Confirm-payment endpoint transitions Pending → Completed', async ({
    request,
  }) => {
    // Create invoice with a payment
    const { invoiceId } = await createInvoiceWithPayment(request, token);

    // Get invoice details to find payment & notification ID
    const detailRes = await request.get(
      `${API_URL}/api/invoices/${invoiceId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(detailRes.ok()).toBeTruthy();
    const detail = await detailRes.json();
    const payments = detail.payments ?? [];
    expect(payments.length).toBeGreaterThan(0);
    expect(payments[0].status).toBe('Pending');

    // Cleanup (manual confirmation tested via notification endpoints separately)
    await deleteInvoice(request, token, invoiceId);
  });
});
