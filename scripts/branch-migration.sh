#!/bin/bash
set -e

# Branch Migration Helper Script
# This script provides commands to help with the master → main migration

echo "================================"
echo "Branch Migration Helper"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if gh CLI is available and authenticated
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    print_error "GitHub CLI is not authenticated"
    echo "Run: gh auth login"
    exit 1
fi

# Repository info
REPO="h-heni/ResourceManager"
MASTER_BRANCH="master"
MAIN_BRANCH="main"
MERGE_BRANCH="copilot/merge-master-into-main"

print_step "Repository: $REPO"
print_step "Source branch: $MASTER_BRANCH"
print_step "Target branch: $MAIN_BRANCH"
echo ""

# Menu
echo "Select an action:"
echo "1) Create Pull Request (merge master into main)"
echo "2) Check PR status"
echo "3) List open PRs"
echo "4) Set main as default branch"
echo "5) Delete master branch"
echo "6) Full migration (interactive)"
echo "7) Verify migration status"
echo "0) Exit"
echo ""
read -p "Enter choice [0-7]: " choice

case $choice in
    1)
        print_step "Creating pull request..."
        gh pr create \
            --repo "$REPO" \
            --base "$MAIN_BRANCH" \
            --head "$MERGE_BRANCH" \
            --title "Merge master branch into main" \
            --body "This PR merges all changes from the master branch into main as part of the branch migration process.

## Changes from master:
- Invitation-based manager creation system
- ManagerInvitation model and API endpoints
- SetupAccountPage frontend component
- InvitationController with 3 endpoints

## Changes from main (to be preserved):
- Bug fixes for tenant creation
- SuperAdmin employee creation improvements
- Null reference warning fixes
- Health check optimizations
- Deployment script improvements

Both sets of changes are important and will be merged together.

## Post-merge tasks:
- [ ] Verify all tests pass
- [ ] Check database migrations
- [ ] Test invitation system
- [ ] Test all bug fixes from main
- [ ] Update default branch to main
- [ ] Delete master branch

See BRANCH_MIGRATION_INSTRUCTIONS.md for details."
        ;;
    2)
        print_step "Checking PR status..."
        gh pr list --repo "$REPO" --head "$MERGE_BRANCH" --json number,title,state,url
        ;;
    3)
        print_step "Listing open PRs..."
        gh pr list --repo "$REPO" --state open
        ;;
    4)
        print_step "Setting main as default branch..."
        read -p "Are you sure? This will change the default branch. (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            gh repo edit "$REPO" --default-branch "$MAIN_BRANCH"
            print_step "Default branch updated to main"
        else
            print_warning "Cancelled"
        fi
        ;;
    5)
        print_step "Deleting master branch..."
        print_warning "This action cannot be easily undone!"
        read -p "Are you sure you want to delete the master branch? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            read -p "Type 'DELETE' to confirm: " confirm2
            if [[ $confirm2 == "DELETE" ]]; then
                gh api -X DELETE "/repos/$REPO/git/refs/heads/$MASTER_BRANCH"
                print_step "Master branch deleted"
            else
                print_warning "Cancelled"
            fi
        else
            print_warning "Cancelled"
        fi
        ;;
    6)
        print_step "Starting full migration..."
        echo ""
        echo "This will guide you through the complete migration process."
        echo ""
        
        # Step 1: Create PR
        print_step "Step 1: Create Pull Request"
        read -p "Create PR to merge master into main? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            gh pr create \
                --repo "$REPO" \
                --base "$MAIN_BRANCH" \
                --head "$MERGE_BRANCH" \
                --title "Merge master branch into main" \
                --body "See BRANCH_MIGRATION_INSTRUCTIONS.md for details"
            
            PR_NUM=$(gh pr list --repo "$REPO" --head "$MERGE_BRANCH" --json number --jq '.[0].number')
            print_step "PR #$PR_NUM created"
        fi
        
        # Step 2: Wait for checks
        print_step "Step 2: Wait for CI/CD checks"
        echo "Opening PR in browser..."
        gh pr view "$PR_NUM" --repo "$REPO" --web
        read -p "Press Enter when checks pass and you're ready to merge..."
        
        # Step 3: Merge PR
        print_step "Step 3: Merge Pull Request"
        read -p "Merge the PR now? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            gh pr merge "$PR_NUM" --repo "$REPO" --merge
            print_step "PR merged"
        fi
        
        # Step 4: Set default branch
        print_step "Step 4: Set main as default branch"
        read -p "Set main as default branch? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            gh repo edit "$REPO" --default-branch "$MAIN_BRANCH"
            print_step "Default branch updated"
        fi
        
        # Step 5: Delete master
        print_step "Step 5: Delete master branch"
        print_warning "Final step: Delete master branch"
        read -p "Delete master branch? (y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            read -p "Type 'DELETE' to confirm: " confirm2
            if [[ $confirm2 == "DELETE" ]]; then
                gh api -X DELETE "/repos/$REPO/git/refs/heads/$MASTER_BRANCH"
                print_step "Master branch deleted"
            fi
        fi
        
        print_step "Migration complete!"
        ;;
    7)
        print_step "Verifying migration status..."
        echo ""
        
        # Check default branch
        DEFAULT=$(gh repo view "$REPO" --json defaultBranchRef --jq '.defaultBranchRef.name')
        echo "Default branch: $DEFAULT"
        
        # Check if master exists
        if gh api "/repos/$REPO/git/refs/heads/$MASTER_BRANCH" &> /dev/null; then
            echo "Master branch: EXISTS"
        else
            echo "Master branch: DELETED"
        fi
        
        # Check for open PRs
        PR_COUNT=$(gh pr list --repo "$REPO" --head "$MERGE_BRANCH" --json number --jq 'length')
        echo "Open PRs for merge: $PR_COUNT"
        
        echo ""
        if [[ $DEFAULT == "$MAIN_BRANCH" ]] && [[ $PR_COUNT == "0" ]]; then
            print_step "Migration appears complete!"
        else
            print_warning "Migration is not complete"
        fi
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        print_error "Invalid choice"
        exit 1
        ;;
esac
