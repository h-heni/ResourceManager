# Bugfix Workflow

## Overview

This workflow handles the lifecycle of diagnosing and fixing a bug — from user report to verified fix with regression tests.

## Trigger

User reports a bug, error, or unexpected behavior.

## Workflow Steps

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: TRANSLATE BUG REPORT                            │
│  User description → Structured bug report                │
│  Agent: prompt-translator.md                             │
├─────────────────────────────────────────────────────────┤
│  Step 2: REPRODUCE                                       │
│  Identify reproduction steps                             │
│  Write a failing test that captures the bug              │
│  Agent: agents/tester.md                                 │
├─────────────────────────────────────────────────────────┤
│  Step 3: DIAGNOSE                                        │
│  Find root cause via code analysis                       │
│  Agent: agents/debugger.md                               │
├─────────────────────────────────────────────────────────┤
│  Step 4: FIX                                             │
│  Apply minimal fix                                       │
│  Agent: agents/coder.md                                  │
├─────────────────────────────────────────────────────────┤
│  Step 5: VERIFY                                          │
│  Run failing test → should now pass                      │
│  Run full test suite → no regressions                    │
│  Agent: agents/tester.md                                 │
├──────────────────┬──────────────────────────────────────┤
│  Tests pass?     │  YES → Step 6                         │
│                  │  NO  → Step 3 (re-diagnose)           │
├──────────────────┴──────────────────────────────────────┤
│  Step 6: VERIFY / REINVESTIGATE                          │
│  Present fix to user                                     │
│    [✅ Verify]        → Close                            │
│    [🔍 Reinvestigate] → Deeper analysis                  │
└─────────────────────────────────────────────────────────┘
```

## Detailed Steps

### Step 1: Translate Bug Report

Convert the user's bug description into:

```
## BUG REPORT

### Summary
[One-sentence description of the bug]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Reproduction Steps
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Environment
- Page/URL: [where the bug occurs]
- User role: [Manager/User/Any]
- Browser: [if relevant]

### Suspected Area
- Backend: [controller/service/model if applicable]
- Frontend: [component/page/hook if applicable]
- Data: [query/filter issue if applicable]
```

### Step 2: Reproduce

1. **Search** for the affected files based on the bug report
2. **Read** the relevant code sections
3. **Write a failing test** that demonstrates the bug:
   ```typescript
   test('BUG: [description of expected behavior]', async ({ page }) => {
     // Steps to reproduce
     await page.goto('/affected-page');
     // ... actions that trigger the bug
     // This assertion should FAIL with the bug present
     await expect(page.getByText('expected result')).toBeVisible();
   });
   ```
4. **Run the test** to confirm it fails (proving the bug exists)

### Step 3: Diagnose

Follow the Debugger Agent process:

1. **Trace the data flow** from user action to displayed result
2. **Check backend**: Controller → Service → DbContext query → Response
3. **Check frontend**: API call → Hook → State → Component render
4. **Check for common issues**:
   - DTO field name mismatch (C# PascalCase vs TypeScript camelCase)
   - Missing `await` on async operations
   - CompanyId filter being bypassed
   - Missing query invalidation after mutation
   - Wrong status logic (TotalAmount vs AmountPaid)
   - Missing i18n key
   - CSS/Tailwind class conflict

### Step 4: Fix

Apply the fix following Coder Agent rules:
- **Minimal change** — don't refactor surrounding code
- **Follow patterns** — match existing code style
- **Don't break other things** — check adjacent functionality

### Step 5: Verify Fix

1. Run the previously-failing test → should now **pass**
2. Run the full e2e suite → no regressions:
   ```bash
   cd ClientApp && npx playwright test
   ```
3. Verify compile-time checks:
   ```bash
   cd ClientApp && npx tsc --noEmit
   ```

### Step 6: Present Results

```
═══════════════════════════════════════════
  BUG FIX COMPLETE
═══════════════════════════════════════════

  Bug: [description]
  Root cause: [what was wrong]
  Fix: [what was changed]

  Files modified:
  - [list]

  Regression test added:
  - ClientApp/e2e/[test].spec.ts

  Test results:
  - Bug reproduction test: ✅ PASS
  - Full suite: [N] passed, 0 failed

  ─────────────────────────────────────────

  Actions:
  [✅ Verify]          — Confirm fix works
  [🔍 Reinvestigate]   — Deeper analysis

═══════════════════════════════════════════
```

## Escalation

If after 3 diagnosis-fix cycles the bug persists:

```
ESCALATION REQUIRED ⚠️

Bug: [description]
Attempted fixes:
1. [Fix 1] — [why it didn't work]
2. [Fix 2] — [why it didn't work]
3. [Fix 3] — [why it didn't work]

Recommended manual investigation:
- [Specific area to examine]
- [Specific question to answer]
```
