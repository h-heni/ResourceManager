# Feature Workflow

## Overview

This workflow orchestrates the complete lifecycle of implementing a new feature — from user request to verified, tested code.

## Trigger

User describes a feature request in natural language.

## Workflow Steps

```
┌─────────────────────────────────────────────────────────┐
│  Step 1: TRANSLATE                                       │
│  User message → Structured engineering prompt            │
│  Agent: prompt-translator.md                             │
│  Output: Formatted TASK / PLAN / FILES / VERIFICATION    │
├─────────────────────────────────────────────────────────┤
│  Step 2: APPROVE                                         │
│  Show translated prompt → Wait for user approval         │
│  Actions: [Approve] → continue  |  [Revise] → Step 1    │
├─────────────────────────────────────────────────────────┤
│  Step 3: PLAN                                            │
│  Analyze prompt → Create sequenced implementation plan   │
│  Agent: agents/planner.md                                │
│  Output: Ordered steps with dependencies                 │
├─────────────────────────────────────────────────────────┤
│  Step 4: IMPLEMENT                                       │
│  Execute plan step by step                               │
│  Agent: agents/coder.md                                  │
│  Rules: Search first, follow patterns, check errors      │
├─────────────────────────────────────────────────────────┤
│  Step 5: TEST                                            │
│  Write and run Playwright e2e tests                      │
│  Agent: agents/tester.md                                 │
│  Command: cd ClientApp && npx playwright test            │
├──────────────────┬──────────────────────────────────────┤
│  Tests pass?     │  YES → Step 7                         │
│                  │  NO  → Step 6                         │
├──────────────────┴──────────────────────────────────────┤
│  Step 6: DEBUG (if needed)                               │
│  Analyze failures → Fix → Rerun (max 3 cycles)          │
│  Agent: agents/debugger.md                               │
│  Loop: Fix → Test → Pass? → Step 7 | Retry              │
├─────────────────────────────────────────────────────────┤
│  Step 7: VERIFY / REINVESTIGATE                          │
│  Present results to user                                 │
│  Actions:                                                │
│    [Verify]        → Mark task complete ✅                │
│    [Reinvestigate] → Re-run deeper debugging → Step 6    │
└─────────────────────────────────────────────────────────┘
```

## Detailed Step Execution

### Step 1: Translate Prompt

Follow `.ai/prompt-translator.md`:

1. Read the user's message
2. Search the codebase for relevant existing files
3. Produce structured prompt with: TASK, CONTEXT, IMPLEMENTATION PLAN, FILES AFFECTED, i18n KEYS, VERIFICATION STEPS, RISKS
4. Present to user

**Script support**: `scripts/run-ai-workflow.ts` → `translatePrompt()`

### Step 2: Get User Approval

Present the translated prompt and ask:
> "Does this plan look correct? Reply **approved** to proceed or describe any changes needed."

- **Approved**: Continue to Step 3
- **Changes requested**: Incorporate feedback, re-translate, show again

### Step 3: Plan Implementation

Follow `.ai/agents/planner.md`:

1. Validate all referenced files exist
2. Order steps by dependency (DB → Backend → Frontend → Tests)
3. Identify risk areas
4. Output checklist of implementation steps

### Step 4: Implement Code

Follow `.ai/agents/coder.md`:

For each step in the plan:
1. Search codebase for existing patterns
2. Implement the change
3. Verify no compile/lint errors
4. Mark step complete
5. Continue to next step

**Quality gates** before proceeding:
- TypeScript compiles clean
- C# builds without errors
- No hardcoded strings in UI
- DTOs match between C# and TypeScript

### Step 5: Run Tests

Follow `.ai/agents/tester.md`:

1. Write e2e test(s) for the new feature
2. Save to `ClientApp/e2e/[feature-name].spec.ts`
3. Execute: `cd ClientApp && npx playwright test [test-file]`
4. Collect results

**Script support**: `scripts/verify-feature.ts`

### Step 6: Debug (if tests fail)

Follow `.ai/agents/debugger.md`:

1. Analyze Playwright output
2. Check screenshots in `ClientApp/test-results/`
3. Inspect browser console and network errors
4. Identify root cause
5. Apply minimal fix
6. Rerun tests
7. Repeat up to 3 times

### Step 7: Verification Interface

Present to user:

```
═══════════════════════════════════════════
  TASK COMPLETE
═══════════════════════════════════════════

  Feature: [feature name]
  Status:  [All tests passing / Partial]

  Files changed:
  - [list of files]

  Test results:
  - [N] tests passed
  - [N] tests failed (if any)

  ─────────────────────────────────────────

  Actions:
  [✅ Verify]          — Confirm and close task
  [🔍 Reinvestigate]   — Run deeper analysis

═══════════════════════════════════════════
```

**Script support**: `scripts/review-interface.ts`

## Error Handling

| Scenario | Action |
|----------|--------|
| Translation unclear | Ask user for clarification |
| Plan has conflicts | Flag conflicts, ask user to resolve |
| Implementation error | Roll back last change, try alternative approach |
| Tests timeout | Check if servers are running, increase timeout |
| 3 debug cycles exhausted | Present diagnostic report, request manual help |

## Environment Requirements

| Service | URL | Required For |
|---------|-----|-------------|
| Backend API | `http://localhost:5001` | API tests, data |
| Frontend | `http://localhost:5173` | Browser tests |
| Database | PostgreSQL (via connection string) | Backend |

## Commands Reference

```bash
# Start backend
dotnet run

# Start frontend
cd ClientApp && npm run dev

# Run specific e2e test
cd ClientApp && npx playwright test e2e/[test].spec.ts

# Run all e2e tests
cd ClientApp && npx playwright test

# View test report
cd ClientApp && npx playwright show-report

# Run AI workflow
cd ClientApp && npm run ai
```
