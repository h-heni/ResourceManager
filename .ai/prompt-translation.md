# Prompt Translation — Canonical Reference

> **This file is the authoritative prompt-translation format.**
> The full translation rules and examples are in `prompt-translator.md`.
> Both filenames are valid references — they point to the same workflow step.

## Quick Format

Every user message MUST be translated into this structure before any code is written:

```
## TASK
[One-sentence summary of what needs to be done]

## CONTEXT
- Related existing files: [list files found via codebase search]
- Patterns to follow: [reference existing hooks, controllers, DTOs]
- Dependencies: [packages, services, or APIs involved]

## IMPLEMENTATION PLAN

### Backend (if applicable)
1. [Step — specific action with file path]
2. [Step — specific action with file path]

### Frontend (if applicable)
1. [Step — specific action with file path]
2. [Step — specific action with file path]

## FILES AFFECTED

### Modified
- `path/to/file.ext` — [what changes and why]

### Created
- `path/to/new-file.ext` — [purpose]

### Tests
- `ClientApp/e2e/test-name.spec.ts` — [what to verify]

## i18n KEYS (if UI changes)
- `namespace.key.label` → EN: "Label" | FR: "Libellé"

## VERIFICATION STEPS
1. [How to verify step 1 — specific user action + expected result]
2. [How to verify step 2 — specific user action + expected result]

## RISKS & ASSUMPTIONS
- [Any assumptions made]
- [Potential side effects]
```

## Rules

1. **ALWAYS show this translation to the user before coding.**
2. **WAIT for user approval** — do not proceed until the user says "yes", "approved", "go", or similar.
3. If the user says "revise", update the translation and show it again.
4. Search the codebase before filling in CONTEXT and FILES AFFECTED.
5. See `prompt-translator.md` for full rules and examples.
