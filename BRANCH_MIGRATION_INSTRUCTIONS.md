# Branch Migration: master → main

This document provides instructions for completing the migration from `master` to `main` as the default branch.

## Current Status

- **master branch**: Contains the latest code including invitation-manager system (SHA: 1502955)
- **main branch**: Contains bug fixes and improvements (SHA: 1c323f2)
- **copilot/merge-master-into-main branch**: Prepared for merging master into main

## Branch Divergence

The `master` and `main` branches have diverged from their common ancestor (commit 9f351ccd):

### Commits unique to master (5 commits):
1. `1502955` - Merge pull request #22 (invitation-manager-system)
2. `8541460` - Add explicit transaction rollback in catch block
3. `f73241c` - Add SetupAccountPage, update UsersPage with invitation modal
4. `a2b1238` - Add ManagerInvitation model, DTOs, InvitationController
5. `120ab02` - Initial plan

### Commits unique to main (7 commits):
1. `1c323f2` - fix: create-tenant 400 - remove [EmailAddress][Phone] validation
2. `c002d28` - fix: SuperAdmin can now create employees
3. `0d17327` - fix: null ref warnings in PendingInvoicesController
4. `d4791f0` - fix: proxy /api/health to /health on API
5. `61295ab` - refactor: optimize health checks and deployment scripts
6. `722f6ea` - feat: add help documentation for CLI
7. `191a3a2` - test: trigger CI pipeline

## Steps to Complete Migration

### 1. Create Pull Request ✓ (Manual Step Required)

Create a PR to merge `copilot/merge-master-into-main` into `main`:

```bash
# Using GitHub CLI (if authenticated):
gh pr create --base main --head copilot/merge-master-into-main \
  --title "Merge master branch into main" \
  --body "This PR merges all changes from the master branch into main as part of the branch migration process. Both branches have diverged and contain important changes that need to be preserved."

# OR via GitHub Web UI:
# 1. Go to https://github.com/h-heni/ResourceManager/compare/main...copilot:merge-master-into-main
# 2. Click "Create pull request"
# 3. Add title and description
# 4. Create the PR
```

### 2. Review and Resolve Conflicts

The merge may have conflicts that need manual resolution:
- **Backend conflicts**: Check Controllers/, Models/, Services/ directories
- **Frontend conflicts**: Check ClientApp/src/ directories
- **Configuration conflicts**: Check appsettings.json, docker-compose files
- **Documentation conflicts**: Check README.md and other .md files

Pay special attention to:
- Database migrations (both branches may have added migrations)
- API endpoints (InvitationController is new in master)
- Frontend routes (SetupAccountPage is new in master)
- Docker and deployment configurations (main has deployment improvements)

### 3. Merge the Pull Request

Once conflicts are resolved and tests pass:
```bash
# Via GitHub CLI:
gh pr merge <PR_NUMBER> --merge --delete-branch=false

# OR via GitHub Web UI:
# 1. Review all changes in the PR
# 2. Ensure CI/CD checks pass
# 3. Click "Merge pull request"
# 4. Choose "Create a merge commit" (recommended to preserve history)
# 5. Confirm the merge
```

### 4. Set `main` as Default Branch

Update the repository settings:
```bash
# Via GitHub CLI:
gh repo edit h-heni/ResourceManager --default-branch main

# OR via GitHub Web UI:
# 1. Go to Settings → Branches
# 2. Click the ⇄ icon next to master
# 3. Select 'main' as the new default branch
# 4. Click "Update"
# 5. Confirm the change
```

### 5. Delete `master` Branch

After confirming `main` is working correctly:
```bash
# Via GitHub CLI:
gh api -X DELETE /repos/h-heni/ResourceManager/git/refs/heads/master

# OR via GitHub Web UI:
# 1. Go to Branches page
# 2. Find 'master' branch
# 3. Click the trash icon
# 4. Confirm deletion
```

### 6. Update Local Clones

Team members need to update their local repositories:
```bash
# Fetch latest changes
git fetch --all --prune

# Switch to main if on master
git checkout main

# Update main
git pull origin main

# Delete local master branch
git branch -d master
```

### 7. Update CI/CD and Branch Protection

- Update any CI/CD workflows that reference `master`
- Update branch protection rules for `main`
- Update any documentation that references `master`
- Search codebase for hardcoded `master` references

## Post-Migration Verification

After migration, verify:
- [ ] Default branch is `main` in repository settings
- [ ] CI/CD pipelines run on `main` branch
- [ ] All features from both branches are present
- [ ] Database migrations work correctly
- [ ] Frontend routes and components load properly
- [ ] Docker containers build and run successfully
- [ ] All tests pass

## Rollback Plan

If issues arise:
1. Revert the merge commit on `main`
2. Set `master` back as default (if deleted, restore from SHA `1502955`)
3. Investigate and fix issues
4. Retry the migration

## Notes

- Both branches contain important work that must be preserved
- The merge should use a merge commit (not squash or rebase) to maintain history
- Test thoroughly in a staging environment before deploying
- Consider creating a backup/tag before the migration: `git tag pre-migration-backup master`

## Support

If you encounter issues during the migration:
1. Check GitHub Actions logs for CI/CD failures
2. Review merge conflict resolution
3. Test locally with both sets of changes
4. Consult the team before proceeding with destructive actions
