# ResourceManager Invoice Management System - AI Agent Guide

---

## ⚡ MANDATORY WORKFLOW — APPLIES TO EVERY MESSAGE

> **This is the #1 rule. It overrides everything else. Every Copilot session MUST follow this workflow. No exceptions.**

### The Workflow

```
USER MESSAGE → TRANSLATE → APPROVE → IMPLEMENT → VERIFY → USER DECISION
```

### Step-by-step

1. **TRANSLATE FIRST** — Before writing ANY code, convert the user's message into a structured engineering prompt using the format in `.ai/prompt-translation.md`. Show It to the user. The format:
   - **TASK** — one-sentence summary
   - **IMPLEMENTATION PLAN** — ordered backend + frontend steps
   - **FILES AFFECTED** — modified / created / tests
   - **VERIFICATION STEPS** — how to confirm it works

2. **WAIT FOR APPROVAL** — Do NOT proceed until the user says "yes", "approved", "go", or similar. If they say "revise", update the plan and show it again.

3. **IMPLEMENT** — Follow `.ai/agents/coder.md`. Search before writing. Follow existing patterns. Check for errors after each change.

4. **VERIFY** — Run browser tests per `.ai/agents/tester.md`. If tests fail, debug per `.ai/agents/debugger.md` (max 3 retries).

5. **REQUEST USER DECISION** — Present:
   - **[✅ Next]** — User confirms → mark task complete
   - **[🔍 Reinvestigate]** — Run deeper analysis → return to step 4

**NEVER skip the translation step. NEVER start coding before approval.**

### Quick Reference — Agent Files

| File | Purpose |
|------|---------|
| `.ai/prompt-translation.md` | How to translate user messages |
| `.ai/workflow.md` | Full workflow reference |
| `.ai/agents/planner.md` | Break prompts into plans |
| `.ai/agents/coder.md` | Implementation rules |
| `.ai/agents/tester.md` | Playwright e2e testing |
| `.ai/agents/debugger.md` | Failure analysis |
| `.ai/skills/create-feature.md` | Feature creation checklist |
| `.ai/skills/debug-feature.md` | Debugging guide |
| `.ai/skills/verify-feature.md` | Verification checklist |

### Automation Scripts

```bash
cd ClientApp && npm run ai          # Full workflow orchestrator
cd ClientApp && npm run verify      # Run all verification checks
cd ClientApp && npm run review      # Verify/Reinvestigate interface
```

---

> **⚠️ CRITICAL**: This is an **ongoing refactor/migration**, NOT a greenfield project. Before creating anything, search for existing implementations and reuse/refactor them.

## Current State Assessment

### What's Already Done ✅
| Component | Status | Location |
|-----------|--------|----------|
| API Controllers | Complete | [Controllers/](Controllers/) - 10 controllers with full CRUD |
| JWT Authentication | Complete | [AuthController.cs](Controllers/AuthController.cs) with login, signup (email/password only) |
| Auth0 OIDC | **TEMPORARILY DISABLED** | Removed for HTTP deployment — will re-enable when HTTPS is available |
| Multi-Tenancy | Complete | [AppDbContext.cs](Data/AppDbContext.cs) - global query filters + auto-stamping |
| Domain Models | Complete | [Models/Models.cs](Models/Models.cs) - all entities defined |
| Clean Architecture | Complete | Domain/Application/Infrastructure layers with interfaces |
| React Frontend | Complete | [ClientApp/src/pages/](ClientApp/src/pages/) - 14 pages migrated |
| React Query | Complete | [ClientApp/src/hooks/](ClientApp/src/hooks/) - useInvoices, useClients, etc. |
| Auth Context | Complete | [ClientApp/src/context/AuthContext.tsx](ClientApp/src/context/AuthContext.tsx) |
| PDF Generation | Complete | [Services/Document.cs](Services/Document.cs) - QuestPDF templates |
| External Services | Complete | GoogleService, SupabaseStorageService |
| CI/CD Pipeline | Complete | [.github/workflows/ci.yml](.github/workflows/ci.yml) |
| Docker | Complete | [Dockerfile](Dockerfile), [docker-compose.yml](docker-compose.yml) |

### What's Left (Future Work) 🔄
| Component | Status | Action Needed |
|-----------|--------|---------------|
| Controller Refactoring | Not started | Replace DbContext with Application services |
| Application Service Impl | Not started | Implement IInvoiceService, IClientService, etc. |
| Entity Migration | Not started | Move Models.cs entities to Domain layer |
| Razor Pages | Legacy | [Pages/](Pages/) - kept for reference (Index.cshtml = Quotes page) |

---

## Completed Phases ✅

### Phase 1: Backend Clean Architecture ✅ COMPLETE

**What was done**:
- Created `ResourceManager.Domain/` with `BaseEntity`, `IClient`, `IItem`, `IPdfDocumentData`, `IRepository<T>`, `IUnitOfWork`
- Created `ResourceManager.Application/` with `Result<T>`, `PagedResult<T>`, service interfaces (IInvoiceService, IClientService, IDevisService, IDeliveryNoteService, IFournisseurService, IPdfService, IStorageService, ICurrentUserService)
- Created `ResourceManager.Infrastructure/` with `Repository<T>`, `UnitOfWork`, `CurrentUserService`, `DependencyInjection`
- Updated `ResourceManager.API.csproj` with project exclusions for sub-projects
- Updated `Program.cs` to register infrastructure services

**Key Files**:
- [ResourceManager.Domain/Interfaces/](ResourceManager.Domain/Interfaces/) - Repository and entity interfaces
- [ResourceManager.Application/Interfaces/](ResourceManager.Application/Interfaces/) - Service interfaces
- [ResourceManager.Infrastructure/DependencyInjection.cs](ResourceManager.Infrastructure/DependencyInjection.cs) - DI registration

---

### Phase 2: Frontend React Query ✅ COMPLETE

**What was done**:
- Installed `@tanstack/react-query`
- Created `ClientApp/src/lib/queryClient.ts` with default options
- Created hooks: `useInvoices`, `useClients`, `useDevis`, `useDeliveryNotes`, `useFournisseurs`, `useDashboard`
- Updated `main.tsx` with `QueryClientProvider`
- Fixed TypeScript errors in existing pages

**Key Files**:
- [ClientApp/src/lib/queryClient.ts](ClientApp/src/lib/queryClient.ts) - Query client configuration
- [ClientApp/src/hooks/index.ts](ClientApp/src/hooks/index.ts) - All hooks exported
- [ClientApp/src/main.tsx](ClientApp/src/main.tsx) - QueryClientProvider setup

**Usage Pattern**:
```tsx
import { useInvoices, useDeleteInvoice } from '../hooks';

function InvoicesPage() {
  const { data: invoices, isLoading } = useInvoices();
  const deleteMutation = useDeleteInvoice();
  // ...
}
```

---

### Phase 3: Auth0 OpenID Connect — ⏸️ TEMPORARILY DISABLED

**Status**: Removed for HTTP-only production deployment. Will re-enable when HTTPS is configured.

**What was removed**:
- `Microsoft.AspNetCore.Authentication.OpenIdConnect` NuGet package
- Auth0 OIDC configuration from `Program.cs`
- Auth0 endpoints from `AuthController.cs` (auth0/login, auth0/callback, auth0/token-exchange, auth0/logout)
- Google OAuth endpoint from `AuthController.cs` (google-login)
- `@auth0/auth0-react` npm package and `Auth0Provider` wrapper from `main.tsx`
- Google Sign-In SDK and social login buttons from `LoginPage.tsx`
- Auth0 sections from `appsettings.json`, `appsettings.Staging.json`, `appsettings.Production.json`
- `VITE_GOOGLE_CLIENT_ID` build arg from Docker files

**HTTP compatibility changes**:
- Cookie `Secure = false`, `SameSite = Lax` in AuthController
- `UseHttpsRedirection()` and `UseHsts()` commented out in Program.cs

**Current auth**: JWT Bearer only (email/password login → JWT token + HttpOnly refresh cookie)

**To re-enable** (when HTTPS is available):
1. Re-add `Microsoft.AspNetCore.Authentication.OpenIdConnect` package
2. Restore Auth0 OIDC config in Program.cs
3. Restore Auth0 + Google endpoints in AuthController.cs
4. Re-add `@auth0/auth0-react` and Auth0Provider in main.tsx
5. Re-add social login buttons to LoginPage.tsx
6. Set cookie `Secure = true`, uncomment HTTPS redirect

---

### Phase 4: CI/CD + Docker ✅ COMPLETE

**What was done**:
- Created `.github/workflows/ci.yml` with build, test, Docker jobs
- Created `Dockerfile` for multi-stage backend build
- Created `ClientApp/Dockerfile` + `nginx.conf` for frontend
- Created `docker-compose.yml` for local development
- Created `docker-compose.ci.yml` for CI testing
- Created `appsettings.Staging.json` and `appsettings.Production.json`
- Created `.env.example` for secret template

**Key Files**:
- [.github/workflows/ci.yml](.github/workflows/ci.yml) - GitHub Actions pipeline
- [Dockerfile](Dockerfile) - Backend container
- [ClientApp/Dockerfile](ClientApp/Dockerfile) - Frontend container
- [docker-compose.yml](docker-compose.yml) - Local dev orchestration
- Existing JWT generation in `GenerateJwtToken()`
- Existing login/signup flow (email/password only — Auth0/Google temporarily disabled)
- Multi-tenancy claim injection (`CompanyId`)

---

## Architecture Reference

### Multi-Tenant Data Flow
```
Request → JWT extracts CompanyId → AppDbContext constructor reads claim
       → Global query filters auto-apply → SaveChangesAsync auto-stamps
```

### Current Project Structure
```
ResourceManager.API.csproj (main API)
├── Controllers/          # API endpoints (10 controllers)
├── Data/                 # EF Core context + migrations
├── Dtos/                 # Request/response DTOs
├── Models/               # Domain entities (to be moved)
├── Services/             # Business services (to be moved)
├── Pages/                # LEGACY Razor Pages (kept for reference)

ResourceManager.Domain.csproj        # ✅ Interfaces: IRepository, IUnitOfWork, IClient, IItem
ResourceManager.Application.csproj   # ✅ Service interfaces, Result<T>, PagedResult<T>
ResourceManager.Infrastructure.csproj # ✅ Repository<T>, UnitOfWork, CurrentUserService

ClientApp/                # React 19 + Vite + Tailwind
├── src/pages/           # 14 pages (fully migrated)
├── src/components/      # Modal, ProtectedRoute
├── src/context/         # AuthContext
├── src/hooks/           # ✅ React Query hooks (useInvoices, useClients, etc.)
├── src/lib/             # ✅ queryClient.ts
├── src/services/        # api.ts (axios)
```

### Key Entities & Relationships
```
Company (1) ──→ (N) ApplicationUser ──→ (1) UserProfile
Company (1) ──→ (N) Client/Fournisseur/Invoice/DeliveryNote/Devis
Invoice (N) ──→ (1) Client
Invoice (1) ──→ (N) InvoiceItem
```

---

## Critical Rules

### DO
- Search entire solution before creating anything new
- Reuse existing DTOs, models, services, components
- Inject `ILogger<T>` for diagnostics
- Use `DateTime.UtcNow` (or `TimeProvider`)
- Run migrations with `dotnet ef database update`
- Test with account: `AHT@gmail.com` / `AHT@gmail.com`

 🛡️ Strict Development ProtocolsImmutable Pages: If a page is marked as "Complete ✅" in the status tables, DO NOT modify or refactor it unless I explicitly state: "I am overriding the status for [Page Name]".Search Before Code: Before proposing a new function, DTO, or React component, search the codebase. If a similar pattern exists (e.g., in useInvoices or BaseApiController), follow that pattern exactly.Clean Architecture Enforcement: All business logic must reside in the Application layer. Controllers should only handle routing and returning ActionResult.
 🌍 Localization & i18n RulesHardcoding Forbidden: Never add hardcoded strings (English, French, etc.) to the UI.Mandatory Updates: Every new label, button, or message must be added to the i18n JSON files for all supported languages (check ClientApp/src/locales/).Key Hierarchy: Use structured keys (e.g., invoice.status.partiallyPaid) rather than flat keys.
 🧪 Definition of "Done" (Verification Checklist)Before providing a final solution, you must verify:Multi-Tenancy: Does the backend logic automatically respect the CompanyId global filter?i18n: Are all new strings localized in the JSON files?State Management: If data is mutated, did you call queryClient.invalidateQueries for the relevant TanStack Query key?UI Testing: Does the frontend render correctly without breaking Tailwind layout?Status Logic: Does Invoice logic correctly compare TotalAmount vs AmountPaid? (Note: "Due" status is strictly forbidden).🛠️ Updated Phase TableComponentStatusAction Neededi18n MigrationIn Progress 🔄Move all hardcoded strings in src/pages to translation filesLogic VerificationMonitoring 🔄Every PR must verify TotalAmount vs AmountPaid logicTestingRequired 🔴You must ask to test the frontend functionality before saying "Done"
 
 🧪 Integration & Verification Protocol (The "Full-Stack" Check)
Before marking any task as Done ✅, you must perform the following internal checks:
 1. Backend-to-Frontend SyncType Safety: Ensure the C# DTO matches the TypeScript Interface in ClientApp/src/types/.Global Filter Check: Verify the new logic does not bypass the CompanyId global query filter in AppDbContext.Naming Consistency: Use camelCase for JSON responses (C# JsonNamingPolicy.CamelCase) to match the React frontend expectations.
 2. Frontend "Live" CheckTanStack Query Keys: If you add or edit data, you must include the code to invalidate the specific cache key (e.g., queryClient.invalidateQueries(['invoices'])).Loading & Error States: Every new component must handle isLoading and isError states from the hooks.i18n Coverage: Verify that t('key') is used and the corresponding keys exist in both en.json and fr.json.
 3. Business Logic AccuracyInvoice Status: Verify that the UI reflects status based on TotalAmount vs AmountPaid.Dual Currency: If the page involves money, verify the "Mixed Mode" toggle logic works with the provided exchangeRate.🛠️ Updated Phase Table (Add this to your "Current State")Add these two lines to your status table to track the verification work:ComponentStatusAction NeededCross-Layer Sync🔄 MonitoringAI must verify DTOs match TS InterfacesEnd-to-End Test🔴 RequiredAI must provide a "Test Plan" (steps to verify) before finishing
### DO NOT
- Add manual `CompanyId`, `UserId` filters (global filters handle it)
- Duplicate existing React pages or components
- Put business logic in controllers
- Commit secrets to source control
- Hard-delete records (use `IsDeleted = true`)

---

## Development Commands

```bash
# Backend
dotnet run                          # Start API on https://localhost:7175
dotnet ef database update           # Apply migrations
dotnet test                         # Run tests (ResourceManager.Tests)

# Frontend
cd ClientApp && npm install         # Install dependencies
cd ClientApp && npm run dev         # Start Vite on http://localhost:5173
cd ClientApp && npm run build       # Production build

# Mobile
# Open ResourceManager.Mobile.csproj in Visual Studio, select target, F5
```

---

## References

| Pattern | File |
|---------|------|
| Multi-tenancy filters | [Data/AppDbContext.cs](Data/AppDbContext.cs) |
| JWT generation | [Controllers/AuthController.cs](Controllers/AuthController.cs) |
| Controller base | [Controllers/BaseApiController.cs](Controllers/BaseApiController.cs) |
| PDF generation | [Services/Document.cs](Services/Document.cs) |
| React auth | [ClientApp/src/context/AuthContext.tsx](ClientApp/src/context/AuthContext.tsx) |
| API client | [ClientApp/src/services/api.ts](ClientApp/src/services/api.ts) |


## AI Agent Meta-Workflow

> **See the ⚡ MANDATORY WORKFLOW section at the top of this file. That is the authoritative workflow definition.**
> **Below is the reference table only — do NOT treat it as separate instructions.**

### Agent Files Reference

| Agent | File | Purpose |
|-------|------|---------|
| Prompt Translator | `.ai/prompt-translation.md` | Convert user message → structured prompt |
| Planner | `.ai/agents/planner.md` | Break prompt → implementation plan |
| Coder | `.ai/agents/coder.md` | Implement code following patterns |
| Tester | `.ai/agents/tester.md` | Write and run Playwright e2e tests |
| Debugger | `.ai/agents/debugger.md` | Analyze failures and auto-fix |

### Workflow Files

| Workflow | File | Purpose |
|----------|------|---------|
| Master | `.ai/workflow.md` | Single workflow entry point |
| Feature | `.ai/workflows/feature-workflow.md` | Full feature implementation lifecycle |
| Bugfix | `.ai/workflows/bugfix-workflow.md` | Bug diagnosis and fix lifecycle |

### Skill Files

| Skill | File | Purpose |
|-------|------|---------|
| Create Feature | `.ai/skills/create-feature.md` | Step-by-step feature creation |
| Debug Feature | `.ai/skills/debug-feature.md` | Systematic debugging guide |
| Verify Feature | `.ai/skills/verify-feature.md` | Comprehensive verification checklist |

### E2E Test Infrastructure

| File | Purpose |
|------|---------|
| `ClientApp/e2e/helpers/auth.ts` | Shared authentication helpers |
| `ClientApp/e2e/helpers/test-utils.ts` | Common test utilities |
| `ClientApp/e2e/smoke.spec.ts` | Application health check tests |
| `ClientApp/playwright.config.ts` | Playwright configuration |

**NEVER stop the task before providing the user the final Verification step.**
