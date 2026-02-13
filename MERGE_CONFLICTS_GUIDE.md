# Potential Merge Conflicts Analysis

This document identifies files that may have merge conflicts when merging master into main.

## High Risk Conflicts

### 1. ClientApp/src/pages/UsersPage.tsx
**Risk Level**: 🔴 HIGH

- **master changes**: Added invitation modal UI (54 additions, 181 deletions)
- **main changes**: Added validation error display (4 additions, 1 deletion)

**Resolution Strategy**:
- Preserve validation error display from main
- Preserve invitation modal functionality from master
- Manually merge both features

### 2. Dtos/CreateManagerDto.cs
**Risk Level**: 🟡 MEDIUM

- **main changes**: Removed [EmailAddress] and [Phone] validation attributes
- **master changes**: May reference this DTO in invitation system

**Resolution Strategy**:
- Keep the validation attribute removal from main
- Ensure invitation system works with the updated DTO

## Medium Risk Conflicts

### 3. Data/AppDbContext.cs
**Risk Level**: 🟡 MEDIUM

- **master changes**: Added ManagerInvitations DbSet
- **main changes**: Possibly other DbContext modifications

**Resolution Strategy**:
- Preserve both DbSet additions
- Check for any OnModelCreating changes

### 4. Database Migrations
**Risk Level**: 🟡 MEDIUM

- **master**: Added migration `20260213153352_AddManagerInvitations`
- **main**: May have other migrations

**Resolution Strategy**:
- Keep both migrations
- Ensure migration order is correct
- May need to rename migrations to maintain chronological order

## Low Risk Files

These files are new in master and shouldn't conflict:
- ✅ ClientApp/src/pages/SetupAccountPage.tsx (new)
- ✅ Controllers/InvitationController.cs (new)
- ✅ Dtos/InvitationDtos.cs (new)
- ✅ Models/ManagerInvitation.cs (new)

These files changed only in main:
- ✅ Various deployment scripts
- ✅ Health check configurations
- ✅ Docker compose files

## Conflict Resolution Steps

1. **Before Merging**:
   ```bash
   # Create backup
   git tag backup-main main
   git tag backup-master master
   ```

2. **During Merge** (if using command line):
   ```bash
   # Checkout main
   git checkout main
   git pull origin main
   
   # Merge master
   git merge master --no-ff
   
   # If conflicts occur:
   git status  # See conflicted files
   ```

3. **For UsersPage.tsx**:
   - Open the file in your editor
   - Look for conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
   - Keep validation error display logic from main
   - Keep invitation modal UI from master
   - Remove conflict markers
   - Test the page

4. **For CreateManagerDto.cs**:
   - Keep main's version (without validation attributes)
   - Verify invitation system still works
   - May need to update invitation validation elsewhere

5. **For Database Migrations**:
   - Keep both migration files
   - Check `AppDbContextModelSnapshot.cs` for conflicts
   - Run `dotnet ef database update` to test

6. **After Resolution**:
   ```bash
   # Mark as resolved
   git add <conflicted-file>
   
   # Complete merge
   git commit
   
   # Push
   git push origin main
   ```

## Testing Checklist

After merging, test these areas:

### Invitation System (from master):
- [ ] Can access `/setup-account` page
- [ ] Can create invitation in Users page
- [ ] Invitation email sends correctly
- [ ] Setup account with invitation token works
- [ ] InvitationController endpoints respond

### Bug Fixes (from main):
- [ ] Create tenant validation works
- [ ] SuperAdmin can create employees
- [ ] Health checks respond correctly
- [ ] No null reference warnings in logs
- [ ] Deployment scripts work

### Database:
- [ ] All migrations apply successfully
- [ ] ManagerInvitations table exists
- [ ] All existing tables intact

### General:
- [ ] Application builds without errors
- [ ] All tests pass
- [ ] Frontend loads without console errors
- [ ] API endpoints respond correctly

## Automated Conflict Detection

You can preview conflicts before merging:

```bash
# Using git (requires both branches locally):
git merge-tree $(git merge-base main master) main master

# Or let GitHub show conflicts:
# The PR will automatically highlight conflicts
```

## Need Help?

If conflicts are too complex:
1. Consider merging in smaller steps
2. Merge common ancestor first, then each feature branch
3. Ask team members familiar with both branches
4. Test in a staging environment first

## Quick Reference

```bash
# Show files changed in master since divergence
git diff main...master --name-only

# Show files changed in main since divergence  
git diff master...main --name-only

# Show common files
comm -12 <(git diff main...master --name-only | sort) \
         <(git diff master...main --name-only | sort)
```
