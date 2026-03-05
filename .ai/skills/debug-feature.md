# Skill: Debug Feature

## Purpose

Systematic approach to debugging failures in the ResourceManager application. Covers backend API issues, frontend rendering problems, test failures, and data inconsistencies.

## Debug Decision Tree

```
Failure Type?
├── Playwright test fails     → Section 1: Test Debugging
├── Browser shows error       → Section 2: Frontend Debugging
├── API returns error         → Section 3: Backend Debugging
├── Data looks wrong          → Section 4: Data Debugging
└── Build/compile error       → Section 5: Build Debugging
```

## Section 1: Playwright Test Debugging

### Collect Information

```bash
# Run with verbose output
cd ClientApp && npx playwright test [file] --reporter=list

# Run with debug mode (step through)
cd ClientApp && npx playwright test [file] --debug

# Run with trace
cd ClientApp && npx playwright test [file] --trace on
```

### Common Test Failures

| Error | Cause | Fix |
|-------|-------|-----|
| `locator.click: Target closed` | Page navigated away | Add `waitForURL()` after navigation |
| `Timeout 30000ms exceeded` | Element never appeared | Check selector, add `waitForSelector()` |
| `expect(received).toBeVisible()` | Element hidden or not rendered | Check conditional rendering logic |
| `net::ERR_CONNECTION_REFUSED` | Backend not running | Start backend: `dotnet run` |
| `401 Unauthorized` | Token missing/expired | Check auth flow in test setup |

### Fix Approach

1. Read the FULL error message and stack trace
2. Open the affected test file and implementation file
3. Add debug logging to the test:
   ```typescript
   page.on('console', msg => console.log('BROWSER:', msg.text()));
   page.on('pageerror', err => console.error('ERROR:', err.message));
   ```
4. Check screenshots in `ClientApp/test-results/`
5. Fix the root cause (implementation, not the test)
6. Rerun the test

## Section 2: Frontend Debugging

### Browser Console Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot read properties of undefined` | Data not loaded yet | Add null check or loading state |
| `<key> is not a function` | Wrong import or stale reference | Check imports and hook usage |
| `404 (Not Found)` | Wrong API endpoint | Check `api.ts` base URL and route |
| `Failed to fetch` | CORS or network issue | Check Vite proxy config |
| `Translation key not found` | Missing i18n key | Add to `en.json` and `fr.json` |

### React Query Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Stale data after mutation | Missing invalidation | Add `invalidateQueries` in `onSuccess` |
| Infinite refetching | Query key changes every render | Stabilize query key |
| Data not updating | Wrong query key | Check `queryKey` matches `invalidateQueries` |

### Debugging Steps

1. Open browser DevTools → Console tab
2. Check Network tab for failed requests
3. Check React Query DevTools (if installed) for query states
4. Add `console.log` at the data flow point:
   ```
   Hook queryFn → API response → Component render
   ```
5. Verify the Vite proxy forwards requests correctly

## Section 3: Backend Debugging

### API Response Errors

| Status | Cause | Fix |
|--------|-------|-----|
| 400 | Invalid request body | Check DTO validation, required fields |
| 401 | Not authenticated | Check JWT token, `[Authorize]` attribute |
| 403 | Not authorized | Check role policy, user role |
| 404 | Wrong route or missing entity | Check route template, entity existence |
| 500 | Server exception | Check logs, run with `dotnet run` and observe output |

### Debugging Steps

1. Check terminal where `dotnet run` is running for exception details
2. Read the relevant controller action
3. Check `AppDbContext` for query filter issues
4. Verify DTO binding:
   ```csharp
   _logger.LogInformation("Received: {@Dto}", dto);
   ```
5. Check entity relationships and navigation properties

### Common Backend Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Empty result set | CompanyId doesn't match | Check JWT claims, verify user's company |
| Wrong data returned | Missing `Include()` | Add `Include()` for navigation properties |
| Soft-deleted items showing | Missing `IsDeleted` filter | Global filter should handle, check entity config |
| Duplicate key violation | Missing uniqueness check | Add validation before insert |

## Section 4: Data Debugging

### Checking Data State

```sql
-- Check if test data exists
SELECT * FROM "Invoices" WHERE "CompanyId" = [id] LIMIT 5;

-- Check user's company
SELECT u."Email", u."CompanyId", c."Name"
FROM "AspNetUsers" u
JOIN "Companies" c ON u."CompanyId" = c."Id"
WHERE u."Email" = 'AHT@gmail.com';
```

### Common Data Issues

| Issue | Fix |
|-------|-----|
| No data appears | Check CompanyId in JWT matches data |
| Dates wrong | Use `DateTime.UtcNow`, check timezone conversion |
| Money calculations off | Verify TotalAmount vs AmountPaid logic |
| Related entity null | Check foreign key, add `Include()` |

## Section 5: Build Debugging

### TypeScript Errors

```bash
cd ClientApp && npx tsc --noEmit 2>&1
```

| Error | Fix |
|-------|-----|
| `Property does not exist` | Add to interface or fix typo |
| `Type 'X' is not assignable to 'Y'` | Fix type mismatch |
| `Cannot find module` | Fix import path |
| `Missing required property` | Add property or make optional |

### C# Build Errors

```bash
dotnet build 2>&1
```

| Error | Fix |
|-------|-----|
| `CS0246 type not found` | Add using directive or NuGet package |
| `CS0103 name not found` | Check variable scope |
| `CS8600 null reference` | Add null check or `!` assertion |

## Debug Cycle

```
1. Reproduce → confirm the bug exists
2. Isolate   → narrow down to specific file/function
3. Diagnose  → identify root cause
4. Fix       → apply minimal change
5. Verify    → run tests, confirm fix
6. Regress   → ensure no new failures
```

Maximum 3 cycles before escalating to user.
