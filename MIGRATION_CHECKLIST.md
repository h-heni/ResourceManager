# ✅ Branch Migration Checklist

Print or save this checklist to track your progress through the migration.

---

## Pre-Migration

- [ ] Read `MIGRATION_INDEX.md` for overview
- [ ] Backup current state (optional but recommended):
  ```bash
  git tag backup-main main
  git tag backup-master master
  ```
- [ ] Ensure you have necessary permissions (repo admin or maintainer)
- [ ] Notify team about upcoming migration
- [ ] Choose your migration method (Web UI / Script / CLI)

---

## Step 1: Create Pull Request

- [ ] Choose one method:
  - [ ] **Method A**: Run `./create-pr.sh`
  - [ ] **Method B**: Run `./scripts/branch-migration.sh` → Option 6
  - [ ] **Method C**: GitHub Web UI ([link](https://github.com/h-heni/ResourceManager/compare/main...copilot:merge-master-into-main))
  
- [ ] PR created successfully
- [ ] PR URL saved: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Step 2: Review Pull Request

- [ ] Open PR in browser
- [ ] Review files changed
- [ ] Check for merge conflicts
  - [ ] If conflicts exist, open `MERGE_CONFLICTS_GUIDE.md`
  - [ ] Resolve each conflict following the guide
  - [ ] Test resolved changes locally
- [ ] All conflicts resolved (or none existed)

---

## Step 3: Wait for Checks

- [ ] CI/CD pipeline started
- [ ] All checks passed
  - [ ] Build successful
  - [ ] Tests passed
  - [ ] Linting passed (if applicable)
- [ ] No failing checks

---

## Step 4: Merge Pull Request

- [ ] All checks green ✅
- [ ] All conflicts resolved ✅
- [ ] Click "Merge pull request" button
- [ ] Select "Create a merge commit" (recommended)
- [ ] Confirm merge
- [ ] PR merged successfully
- [ ] Merge commit SHA: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Step 5: Set Main as Default Branch

- [ ] Go to Repository Settings
- [ ] Click "Branches" in left sidebar
- [ ] Find "master" branch
- [ ] Click switch icon (⇄) next to master
- [ ] Select "main" from dropdown
- [ ] Click "Update" button
- [ ] Confirm the change
- [ ] Default branch is now "main" ✅

---

## Step 6: Verify Everything Works

### Application Health
- [ ] Pull latest main branch locally
- [ ] Application builds without errors
- [ ] Application starts successfully
- [ ] No console errors

### Database
- [ ] Database migrations apply successfully
- [ ] `ManagerInvitations` table exists
- [ ] All existing tables intact
- [ ] No migration errors

### Features from MASTER
- [ ] Can access `/setup-account` page
- [ ] Invitation modal appears in Users page
- [ ] Can create invitation
- [ ] InvitationController endpoints respond
- [ ] Invitation email functionality works

### Features from MAIN
- [ ] Tenant creation validation works
- [ ] SuperAdmin can create employees
- [ ] Health checks respond correctly
- [ ] No null reference warnings in logs
- [ ] Deployment scripts work

### Tests
- [ ] All unit tests pass
- [ ] All integration tests pass (if any)
- [ ] CI/CD pipeline runs successfully on main

---

## Step 7: Delete Master Branch

⚠️ **IMPORTANT**: Only proceed after verifying everything works!

- [ ] Verify main branch works perfectly
- [ ] Verify all features tested above ✅
- [ ] Go to Branches page
- [ ] Find "master" branch
- [ ] Click trash icon 🗑️
- [ ] Confirm deletion
- [ ] Master branch deleted ✅

---

## Step 8: Update Team's Local Clones

- [ ] Send notification to team with instructions:

```bash
# 1. Fetch latest changes
git fetch --all --prune

# 2. Switch to main (if on master)
git checkout main

# 3. Update main
git pull origin main

# 4. Delete local master branch
git branch -d master
```

- [ ] Team members updated: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Step 9: Update References

- [ ] Update CI/CD workflows to reference `main` instead of `master`
- [ ] Update branch protection rules for `main`
- [ ] Update documentation mentioning `master`
- [ ] Search codebase for hardcoded `master` references
- [ ] Update README.md (if it references default branch)
- [ ] Update deployment scripts (if they reference branch)

---

## Step 10: Final Verification

- [ ] Default branch is `main` in GitHub settings
- [ ] `master` branch no longer exists
- [ ] CI/CD runs on `main` branch
- [ ] All team members updated
- [ ] All features working
- [ ] No errors in production
- [ ] Documentation updated

---

## 🎉 Migration Complete!

**Completion Date**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Completed By**: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Notes/Issues Encountered**:
```
[Space for notes]




```

---

## Rollback (If Needed)

If something goes wrong:

- [ ] Identify the issue: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Revert merge commit:
  ```bash
  git revert -m 1 <merge-commit-sha>
  ```
- [ ] Or restore from backup:
  ```bash
  git reset --hard backup-main
  ```
- [ ] Set master back as default (if deleted, restore it)
- [ ] Investigate issue
- [ ] Fix and retry migration

---

## Support

If you need help at any point:
- 📖 **Overview**: `MIGRATION_INDEX.md`
- 🚀 **Quick Start**: `MIGRATION_QUICKSTART.md`
- 📊 **Visual Guide**: `MIGRATION_FLOWCHART.md`
- 📝 **Details**: `BRANCH_MIGRATION_INSTRUCTIONS.md`
- ⚔️ **Conflicts**: `MERGE_CONFLICTS_GUIDE.md`
- 🤖 **Automation**: `./scripts/branch-migration.sh`

---

**Estimated Time**: 5-30 minutes (depending on conflicts)

**Good luck! 🚀**
