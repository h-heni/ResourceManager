# Browser Verification Skill

> This skill covers how to verify features using Playwright browser testing.
> It extends the verification checklist in `verify-feature.md`.

## Stack

| Tool | Status | Config |
|------|--------|--------|
| Playwright | ✅ Installed | `ClientApp/playwright.config.ts` |
| Test dir | ✅ Exists | `ClientApp/e2e/` |
| Auth helpers | ✅ Exists | `ClientApp/e2e/helpers/auth.ts` |
| Test utils | ✅ Exists | `ClientApp/e2e/helpers/test-utils.ts` |

## When to Use

After implementation is complete, run browser verification to ensure the feature works end-to-end.

## Steps

### 1. Write a Playwright Test

Create a `.spec.ts` file in `ClientApp/e2e/`:

```typescript
import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:5001';

async function login(request: any, email: string, password: string) {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).accessToken;
}

test.describe('Feature Name', () => {
  test('should [expected behavior]', async ({ page }) => {
    // Navigate
    await page.goto('/page-under-test');

    // Interact
    await page.getByRole('button', { name: 'Action' }).click();

    // Assert
    await expect(page.getByText('Expected result')).toBeVisible();
  });
});
```

### 2. Run Tests

```bash
cd ClientApp && npx playwright test e2e/[test-file].spec.ts --reporter=list
```

### 3. Inspect Failures

- Screenshots: `ClientApp/test-results/`
- Traces: `cd ClientApp && npx playwright show-trace test-results/[trace-file]`
- Add debug logging:
  ```typescript
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  ```

### 4. Fix & Retry

If tests fail, follow `.ai/agents/debugger.md` for root cause analysis. Max 3 retries.

### 5. Full Verification

```bash
cd ClientApp && npm run verify
```

This runs TypeScript check + Lint + i18n check + Playwright tests.

## Test Categories

| Category | What to Test |
|----------|-------------|
| Navigation | Pages load, routes resolve |
| Forms | Submission, validation errors |
| CRUD | Create, read, update, delete operations |
| Auth | Protected routes, role-based access |
| i18n | Labels render in both languages |
| Responsive | Layout at different viewport sizes |

## See Also

- [verify-feature.md](verify-feature.md) — Full verification checklist
- [../agents/tester.md](../agents/tester.md) — Tester agent with detailed patterns
- [../agents/debugger.md](../agents/debugger.md) — Failure analysis agent
