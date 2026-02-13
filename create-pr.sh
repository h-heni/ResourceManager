#!/bin/bash
# Quick PR Creation Command
# Run this command to create the pull request

gh pr create \
  --repo h-heni/ResourceManager \
  --base main \
  --head copilot/merge-master-into-main \
  --title "Merge master branch into main" \
  --body "## Overview

This PR merges the \`master\` branch into \`main\` as part of the repository's branch migration to align with GitHub's default branch standards.

## Changes Included

### From master branch (5 commits):
- ✨ **Invitation System**: Complete implementation of manager invitation functionality
  - Added \`ManagerInvitation\` model and database migration
  - Added \`InvitationController\` with 3 endpoints (create, get, setup-account)
  - Added \`SetupAccountPage\` component in React frontend
  - Enhanced \`UsersPage\` with invitation modal
  
### From main branch (7 commits - will be preserved):
- 🐛 **Bug Fixes**:
  - Fixed tenant creation validation (removed EmailAddress/Phone attributes)
  - Fixed SuperAdmin employee creation with role auth
  - Fixed null reference warnings in PendingInvoicesController
  - Fixed health check endpoint proxy configuration
  
- ⚡ **Improvements**:
  - Optimized health checks and deployment scripts
  - Added CLI help documentation
  - Improved deployment reliability

## Potential Conflicts

⚠️ **High Risk**: \`UsersPage.tsx\` - Modified in both branches
- **master**: Added invitation modal (54 additions, 181 deletions)
- **main**: Added validation error display (4 additions, 1 deletion)
- **Resolution**: Merge both features (see MERGE_CONFLICTS_GUIDE.md)

🟡 **Medium Risk**: \`CreateManagerDto.cs\`, database migrations
- **Resolution**: Keep validation changes from main, preserve invitation functionality from master

## Documentation

Complete guides have been added to assist with this migration:
- 📖 \`README_MIGRATION.md\` - Overview and navigation
- 🚀 \`MIGRATION_QUICKSTART.md\` - Quick start guide
- 📝 \`BRANCH_MIGRATION_INSTRUCTIONS.md\` - Detailed instructions
- ⚔️ \`MERGE_CONFLICTS_GUIDE.md\` - Conflict resolution strategies
- 🤖 \`scripts/branch-migration.sh\` - Interactive CLI tool

## Testing Checklist

Before merging, verify:
- [ ] All CI/CD checks pass
- [ ] No merge conflicts (or all conflicts resolved)
- [ ] Code builds successfully
- [ ] Tests pass

After merging, verify:
- [ ] Invitation system works (\`/setup-account\` page accessible)
- [ ] All bug fixes from main still work
- [ ] Database migrations apply successfully
- [ ] Application starts without errors

## Post-Merge Steps

1. ✅ Merge this PR
2. Set \`main\` as default branch (Settings → Branches)
3. Delete \`master\` branch (after verification)
4. Update local clones: \`git fetch --all --prune\`
5. Update any hardcoded \`master\` references in documentation

## Rollback Plan

If issues arise:
\`\`\`bash
# Revert merge commit
git revert -m 1 <merge-commit-sha>

# Or restore from backup
git reset --hard backup-main
\`\`\`

## Related Issues

Addresses the branch migration from \`master\` to \`main\`.

---

For detailed instructions, see [README_MIGRATION.md](./README_MIGRATION.md)."
