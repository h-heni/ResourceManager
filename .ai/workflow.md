# AI Development Workflow — Master Reference

> **Single entry point for the entire AI-assisted development lifecycle.**
> This file is referenced by `.github/copilot-instructions.md` and must be followed in every session.

---

## The Workflow

```
USER MESSAGE → TRANSLATE → APPROVE → IMPLEMENT → VERIFY → USER DECISION
```

---

## Step 1: TRANSLATE

**Agent**: `.ai/prompt-translation.md` (quick ref) / `.ai/prompt-translator.md` (full rules)

1. Read the user's message.
2. Search the codebase for relevant existing files.
3. Convert the message into the structured format:
   - TASK / CONTEXT / IMPLEMENTATION PLAN / FILES AFFECTED / VERIFICATION STEPS
4. Show the translation to the user.

---

## Step 2: APPROVE

- Present the translated prompt and ask: *"Does this plan look correct? Reply **approved** to proceed or describe changes."*
- **Approved** → continue to Step 3.
- **Revise** → incorporate feedback → re-show translation.
- **NEVER skip this step.**

---

## Step 3: PLAN & IMPLEMENT

**Agents**: `.ai/agents/planner.md` → `.ai/agents/coder.md`

1. Break the approved prompt into dependency-ordered steps (DB → Backend → Frontend → Tests).
2. For each step:
   - Search codebase for existing patterns.
   - Implement the change.
   - Check for compile/lint errors.
   - Mark step complete.

**Skills**: `.ai/skills/create-feature.md` (features) / `.ai/skills/debug-feature.md` (bugs)

---

## Step 4: TEST & VERIFY

**Agent**: `.ai/agents/tester.md`

1. Write Playwright e2e tests in `ClientApp/e2e/`.
2. Run: `cd ClientApp && npx playwright test [test-file] --reporter=list`
3. If tests fail → go to Step 5.
4. If tests pass → go to Step 6.

---

## Step 5: DEBUG (if needed)

**Agent**: `.ai/agents/debugger.md`

1. Analyze Playwright output and screenshots in `ClientApp/test-results/`.
2. Classify failure (selector / timing / API / auth / data / rendering / i18n / state).
3. Apply fix.
4. Rerun tests.
5. Maximum 3 retry cycles. If still failing, present findings to user.

---

## Step 6: USER DECISION

**Skill**: `.ai/skills/verify-feature.md`

Present results with:
- **[✅ Next]** — User confirms the feature works → mark task complete.
- **[🔍 Reinvestigate]** — Run deeper analysis → return to Step 5.

**NEVER stop the task before presenting Step 6.**

---

## Workflow Variants

| Scenario | Workflow File |
|----------|---------------|
| New feature | `.ai/workflows/feature-workflow.md` |
| Bug fix | `.ai/workflows/bugfix-workflow.md` |

---

## Automation Scripts

```bash
cd ClientApp && npm run ai          # Full workflow orchestrator
cd ClientApp && npm run verify      # Run all verification checks
cd ClientApp && npm run review      # Verify/Reinvestigate CLI interface
```

---

## Key Principles

1. **Persistence** — This workflow is defined in files, not chat. It applies to every session automatically.
2. **No skipping** — Translation and approval happen BEFORE any code is written.
3. **Search first** — Never create what already exists.
4. **Verify always** — Every task ends with user confirmation.
