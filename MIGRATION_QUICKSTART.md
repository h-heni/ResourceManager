# Quick Migration Steps

## TL;DR - Complete the Migration

### Option 1: Using GitHub Web UI (Recommended)

1. **Create PR**: Go to https://github.com/h-heni/ResourceManager/compare/main...copilot:merge-master-into-main
   - Click "Create pull request"
   - Title: "Merge master branch into main"
   - Create the PR

2. **Merge PR**: 
   - Wait for CI checks to pass
   - Review changes
   - Click "Merge pull request" → "Create a merge commit"

3. **Set Default Branch**:
   - Go to Settings → Branches
   - Click ⇄ next to "master"
   - Select "main"
   - Update and confirm

4. **Delete Master**:
   - Go to Branches page
   - Find "master"
   - Click trash icon
   - Confirm deletion

### Option 2: Using the Helper Script

```bash
# Make sure gh CLI is authenticated
gh auth login

# Run the interactive script
./scripts/branch-migration.sh

# Select option 6 for full guided migration
```

### Option 3: Using GitHub CLI Commands

```bash
# 1. Create PR
gh pr create --repo h-heni/ResourceManager \
  --base main \
  --head copilot/merge-master-into-main \
  --title "Merge master into main" \
  --body "See BRANCH_MIGRATION_INSTRUCTIONS.md"

# 2. Merge PR (after checks pass)
gh pr merge <PR_NUMBER> --repo h-heni/ResourceManager --merge

# 3. Set default branch
gh repo edit h-heni/ResourceManager --default-branch main

# 4. Delete master
gh api -X DELETE /repos/h-heni/ResourceManager/git/refs/heads/master
```

## What This Achieves

- ✅ Merges invitation system from master
- ✅ Preserves bug fixes from main  
- ✅ Sets main as the primary branch
- ✅ Removes deprecated master branch
- ✅ Aligns with GitHub's main branch standard

## Important Notes

- **Both branches have unique commits** - the merge preserves all work
- **Database migrations** - both branches may have added migrations, check for conflicts
- **Test thoroughly** - verify all features work after merge
- **Backup first** - consider creating a tag: `git tag backup-pre-migration master`

## Need Help?

See `BRANCH_MIGRATION_INSTRUCTIONS.md` for detailed instructions and troubleshooting.
