# Prompt Translator

## Purpose

Convert user messages into structured engineering prompts before any implementation begins.
This ensures every task is well-defined, scoped, and verifiable.

## Input

A natural-language message from the user describing a feature, bug fix, or change request.

## Output Format

Every translated prompt **MUST** follow this exact structure:

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

## Translation Rules

1. **Search first** — Before translating, search the codebase for:
   - Existing controllers in `Controllers/`
   - Existing React pages in `ClientApp/src/pages/`
   - Existing hooks in `ClientApp/src/hooks/`
   - Existing DTOs in `Dtos/`
   - Existing types in `ClientApp/src/types/`
   - i18n keys in `ClientApp/src/locales/`

2. **Decompose** the request into atomic, verifiable steps

3. **Separate** backend (C# / ASP.NET Core) and frontend (React / TypeScript) work

4. **Identify all files** that will be created or modified

5. **Define verification steps** that can be tested in a browser

6. **Check i18n** — if the change affects UI text, list all new translation keys

7. **Check multi-tenancy** — if backend data is involved, confirm CompanyId filter behavior

8. **Reference patterns** — cite existing hooks, controllers, DTOs as templates

9. **Never assume** — if the request is ambiguous, list assumptions explicitly

10. **Estimate scope** — classify as Small (1-3 files), Medium (4-8 files), or Large (9+ files)

## Example

**User says**: "Add a button to export invoices to Excel"

**Translated prompt**:

```
## TASK
Add an Excel export button to the Invoices page that downloads all visible invoices as an .xlsx file.

## CONTEXT
- Existing: InvoicesController.cs, InvoicesPage.tsx, useInvoices hook
- Pattern: Follow existing button patterns in InvoicesPage.tsx
- Dependency: `xlsx` package already installed in ClientApp

## IMPLEMENTATION PLAN

### Backend
1. Add `GET /api/invoices/export` endpoint in InvoicesController.cs
2. Return Excel file as FileContentResult with proper MIME type

### Frontend
1. Add "Export" button to InvoicesPage.tsx toolbar
2. Wire button to call export endpoint via axios (blob response)
3. Trigger browser download of the returned file
4. Add i18n keys for button and toast messages

## FILES AFFECTED

### Modified
- `Controllers/InvoicesController.cs` — add ExportToExcel action
- `ClientApp/src/pages/InvoicesPage.tsx` — add Export button

### Created
- None (using inline logic, xlsx is already available)

### Tests
- `ClientApp/e2e/invoice-export.spec.ts` — test export button click + file download

## i18n KEYS
- `invoices.actions.export` → EN: "Export to Excel" | FR: "Exporter en Excel"
- `invoices.export.success` → EN: "Export complete" | FR: "Export terminé"
- `invoices.export.error` → EN: "Export failed" | FR: "Échec de l'export"

## VERIFICATION STEPS
1. Navigate to Invoices page → Export button is visible
2. Click Export → .xlsx file downloads
3. Open file → data matches displayed invoices
4. Switch language to FR → button shows "Exporter en Excel"

## RISKS & ASSUMPTIONS
- Assumes all visible invoices (not paginated server-side) are exported
- Large datasets may cause slow response — consider streaming for 1000+ invoices
```

## Workflow Integration

After translation:
1. **Present** the translated prompt to the user in full
2. **Ask**: "Does this plan look correct? Reply 'approved' to proceed or describe changes."
3. If **approved** → pass to Planner Agent (`.ai/agents/planner.md`)
4. If **changes requested** → re-translate incorporating feedback
5. **Never skip** the approval step — always wait for user confirmation
