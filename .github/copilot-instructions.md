# ResourceManager Invoice Management System - AI Agent Guide

> **⚠️ CRITICAL**: This is an **ongoing refactor/migration**, NOT a greenfield project. Before creating anything, search for existing implementations and reuse/refactor them.

## Current State Assessment

### What's Already Done ✅
| Component | Status | Location |
|-----------|--------|----------|
| API Controllers | Complete | [Controllers/](Controllers/) - 10 controllers with full CRUD |
| JWT Authentication | Complete | [AuthController.cs](Controllers/AuthController.cs) with login, signup, Google OAuth, Auth0 |
| Auth0 OIDC | Complete | [Program.cs](Program.cs) - OpenID Connect + [AuthController.cs](Controllers/AuthController.cs) |
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

### Phase 3: Auth0 OpenID Connect ✅ COMPLETE

**What was done**:
- Added `Microsoft.AspNetCore.Authentication.OpenIdConnect` package
- Updated `Program.cs` with `.AddOpenIdConnect("Auth0", ...)` configuration
- Added Auth0 endpoints in `AuthController.cs`: `/auth0/login`, `/auth0/callback`, `/auth0/logout`
- Added Auth0 config section in `appsettings.json`
- Updated `LoginPage.tsx` with Auth0 login button and callback handling

**Key Files**:
- [Program.cs](Program.cs) - Auth0 OIDC configuration (lines 42-130)
- [Controllers/AuthController.cs](Controllers/AuthController.cs) - Auth0 endpoints
- [ClientApp/src/pages/LoginPage.tsx](ClientApp/src/pages/LoginPage.tsx) - Auth0 button

**Configuration Required** (in appsettings.json or secrets):
```json
{
  "Auth0": {
    "Domain": "YOUR_AUTH0_DOMAIN.auth0.com",
    "ClientId": "YOUR_AUTH0_CLIENT_ID", 
    "ClientSecret": "YOUR_AUTH0_CLIENT_SECRET",
    "Audience": "YOUR_AUTH0_API_AUDIENCE",
    "CallbackPath": "/callback"
  }
}
```

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
- Existing login/signup flow
- Multi-tenancy claim injection (`CompanyId`)

**Auth0 Config Required** (store in secrets):
- `Auth0__Domain`, `Auth0__ClientId`, `Auth0__ClientSecret`, `Auth0__Audience`

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

### DO NOT
- Add manual `CompanyId` filters (global filters handle it)
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
