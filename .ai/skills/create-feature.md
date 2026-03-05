# Skill: Create Feature

## Purpose

Step-by-step skill for creating a new feature in the ResourceManager application, covering both backend and frontend, following all project conventions.

## Prerequisites

- Approved prompt from Prompt Translator
- Implementation plan from Planner Agent
- Backend running (`dotnet run`)
- Frontend running (`cd ClientApp && npm run dev`)

## Execution Steps

### 1. Search for Existing Patterns

Before writing any code, find the closest existing implementation to use as a template:

```
Search for:
├── Similar controller     → Controllers/
├── Similar DTO            → Dtos/
├── Similar page           → ClientApp/src/pages/
├── Similar hook           → ClientApp/src/hooks/
├── Similar component      → ClientApp/src/components/
├── Similar type           → ClientApp/src/types/
└── i18n namespace         → ClientApp/src/locales/
```

### 2. Backend Implementation (if applicable)

#### 2a. Create/Update DTO

Location: `Dtos/`

```csharp
public class FeatureDto
{
    public int Id { get; set; }
    // Properties match the domain model
    // Use camelCase in JSON output (handled by JsonNamingPolicy.CamelCase)
}

public class CreateFeatureDto
{
    [Required]
    public string Name { get; set; } = string.Empty;
    // Only the fields needed for creation
}
```

#### 2b. Create/Update Controller

Location: `Controllers/`

Follow `BaseApiController` pattern:
- Inherit from `BaseApiController`
- Use `[Authorize]` attribute
- Inject `AppDbContext` and `ILogger<T>`
- Do NOT add manual CompanyId filters
- Return proper `ActionResult<T>`

#### 2c. Add Model Properties (if needed)

Location: `Models/Models.cs`

- Add new properties to existing entities
- Or create new entity with proper relationships
- Include `CompanyId` for multi-tenant entities

#### 2d. Migration (if model changed)

```bash
dotnet ef migrations add FeatureName
dotnet ef database update
```

### 3. Frontend Implementation (if applicable)

#### 3a. Create/Update TypeScript Types

Location: `ClientApp/src/types/`

```typescript
export interface Feature {
  id: number;
  name: string;
  // Match C# DTO properties exactly (camelCase)
}

export interface CreateFeatureDto {
  name: string;
}
```

#### 3b. Create/Update React Query Hooks

Location: `ClientApp/src/hooks/`

Follow existing patterns (check `useInvoices`, `useClients`):
```typescript
export function useFeatures() {
  return useQuery({ queryKey: ['features'], queryFn: ... });
}

export function useCreateFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ...,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['features'] }),
  });
}
```

#### 3c. Create/Update Page Component

Location: `ClientApp/src/pages/`

- Use `useTranslation()` for all text
- Handle `isLoading` and `isError` states
- Follow Tailwind CSS patterns from existing pages
- Use existing UI components from `ClientApp/src/components/`

#### 3d. Add Route (if new page)

Location: `ClientApp/src/App.tsx` (or routing config)

#### 3e. Add i18n Keys

Add keys to ALL language files:
- `ClientApp/src/locales/en.json`
- `ClientApp/src/locales/fr.json`

Use structured key hierarchy:
```json
{
  "feature": {
    "title": "Feature Title",
    "actions": {
      "create": "Create",
      "edit": "Edit",
      "delete": "Delete"
    },
    "messages": {
      "created": "Feature created successfully",
      "deleted": "Feature deleted successfully"
    }
  }
}
```

### 4. Write E2E Test

Location: `ClientApp/e2e/`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should display feature page', async ({ page }) => {
    await page.goto('/feature-path');
    await expect(page.getByRole('heading')).toContainText('Feature Title');
  });

  test('should create new feature', async ({ page }) => {
    // Fill form, submit, verify
  });
});
```

### 5. Verify

Run the complete verification checklist:

- [ ] Backend compiles: `dotnet build`
- [ ] Frontend compiles: `cd ClientApp && npx tsc --noEmit`
- [ ] E2E tests pass: `cd ClientApp && npx playwright test`
- [ ] i18n complete: `cd ClientApp && npm run i18n:check`
- [ ] No manual CompanyId filters added
- [ ] All mutations invalidate query cache
- [ ] Loading/error states handled in UI
- [ ] DTO field names match between C# and TypeScript

## Output

```
FEATURE CREATED ✓
Backend changes: [N] files
Frontend changes: [N] files
Tests added: [N]
i18n keys added: [N]
```
