# Skill: Verify Feature

## Purpose

Comprehensive verification skill that validates an implemented feature across all layers of the application. This is the final gate before presenting the Verify/Reinvestigate interface to the user.

## Verification Checklist

### Layer 1: Compilation

- [ ] **C# builds**: `dotnet build` completes without errors
- [ ] **TypeScript compiles**: `cd ClientApp && npx tsc --noEmit` completes without errors
- [ ] **Lint passes**: `cd ClientApp && npm run lint` (warnings acceptable, errors not)

### Layer 2: Backend Verification

- [ ] **API responds**: New/modified endpoints return expected status codes
- [ ] **Multi-tenancy**: No manual `CompanyId` filters — global filters handle it
- [ ] **DTOs correct**: Response body matches expected shape
- [ ] **Auth enforced**: `[Authorize]` on all new endpoints
- [ ] **Logging**: `ILogger<T>` injected and used for important operations
- [ ] **Soft delete**: Any delete operations use `IsDeleted = true`

### Layer 3: Frontend Verification

- [ ] **Page renders**: No blank screen, no console errors
- [ ] **Data loads**: Correct data displayed from API
- [ ] **Loading state**: Spinner/skeleton shown while loading
- [ ] **Error state**: Error message shown on API failure
- [ ] **Mutations work**: Create/update/delete operations succeed
- [ ] **Cache invalidated**: Data refreshes after mutations
- [ ] **Responsive**: Layout doesn't break on different screen sizes

### Layer 4: i18n Verification

- [ ] **No hardcoded strings**: All UI text uses `t('key')`
- [ ] **English keys**: All new keys exist in `en.json`
- [ ] **French keys**: All new keys exist in `fr.json`
- [ ] **Language switch**: Changing language updates all new text

### Layer 5: Cross-layer Sync

- [ ] **DTO ↔ Interface**: C# DTO property names match TypeScript interface fields (camelCase)
- [ ] **Route consistency**: Frontend API calls match backend route templates
- [ ] **Status logic**: Any invoice/payment logic uses TotalAmount vs AmountPaid correctly

### Layer 6: E2E Tests

- [ ] **Tests written**: At least one e2e test for the new feature
- [ ] **Tests pass**: `cd ClientApp && npx playwright test [test-file]`
- [ ] **No regressions**: Existing tests still pass

## Automated Verification Script

Run `scripts/verify-feature.ts` to automate checks:

```bash
cd ClientApp && npm run verify
```

This script will:
1. Run TypeScript compilation check
2. Run linting
3. Run Playwright e2e tests
4. Check i18n coverage
5. Report results

## Verification Report Format

After running all checks, produce:

```
═══════════════════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════════════════

  Feature: [name]
  Date: [timestamp]

  Compilation    ✅ Pass
  Backend API    ✅ Pass
  Frontend UI    ✅ Pass
  i18n Coverage  ✅ Pass
  Cross-layer    ✅ Pass
  E2E Tests      ✅ Pass (N/N passed)

  Overall: ✅ ALL CHECKS PASSED

  ─────────────────────────────────────────────────────

  Files modified: [N]
  Files created: [N]
  Tests added: [N]
  i18n keys added: [N]

  ─────────────────────────────────────────────────────

  Actions:
  [✅ Verify]          — I confirm this feature works correctly
  [🔍 Reinvestigate]   — Run deeper analysis and debugging

═══════════════════════════════════════════════════════
```

If any check fails:

```
═══════════════════════════════════════════════════════
  VERIFICATION REPORT
═══════════════════════════════════════════════════════

  Feature: [name]
  Date: [timestamp]

  Compilation    ✅ Pass
  Backend API    ✅ Pass
  Frontend UI    ❌ FAIL — Console error: [details]
  i18n Coverage  ⚠️ Warning — Missing 2 FR keys
  Cross-layer    ✅ Pass
  E2E Tests      ❌ FAIL — 1/3 tests failed

  Overall: ❌ ISSUES FOUND

  ─────────────────────────────────────────────────────

  Issues to resolve:
  1. Console error: Cannot read property 'map' of undefined
     → File: ClientApp/src/pages/FeaturePage.tsx:42
     → Fix: Add null check for data array

  2. Missing i18n keys:
     → feature.actions.export (fr.json)
     → feature.messages.success (fr.json)

  3. Failing test: "should export data"
     → Error: Timeout waiting for download
     → Possible cause: API endpoint returns wrong content-type

  ─────────────────────────────────────────────────────

  Recommendation: Fix issues and re-verify
  Auto-fixing...

═══════════════════════════════════════════════════════
```

## Reinvestigation Mode

When user selects **Reinvestigate**, perform deeper analysis:

1. **Full test suite**: Run ALL e2e tests, not just the new one
2. **Performance check**: Measure page load time
3. **Network analysis**: Log all API calls and response times
4. **Memory check**: Look for potential memory leaks (uncleaned subscriptions)
5. **Edge cases**: Test with empty data, large datasets, special characters
6. **Role testing**: Test with different user roles (Manager vs User)

Produce an extended report with findings.
