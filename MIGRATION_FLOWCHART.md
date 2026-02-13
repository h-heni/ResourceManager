# Branch Migration Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                   BRANCH MIGRATION PROCESS                  │
│                  master → main (DELETE master)              │
└─────────────────────────────────────────────────────────────┘

START HERE
    │
    ├─── Are you authenticated with gh CLI?
    │    │
    │    ├─── YES → Run: ./create-pr.sh
    │    │           └─→ PR Created! ──┐
    │    │                              │
    │    └─── NO → Use GitHub Web UI ──┤
    │              (see below)          │
    │                                   │
    ▼                                   ▼
┌─────────────────────────────────────────┐
│         PR CREATED SUCCESSFULLY         │
└─────────────────────────────────────────┘
    │
    ├─── Does PR show conflicts?
    │    │
    │    ├─── YES → Open MERGE_CONFLICTS_GUIDE.md
    │    │           ├─ Find your conflicted file
    │    │           ├─ Follow resolution strategy
    │    │           └─ Mark as resolved
    │    │
    │    └─── NO → Great! No conflicts ──┐
    │                                     │
    ▼                                     ▼
┌──────────────────────────────────────────┐
│     WAIT FOR CI/CD CHECKS TO PASS        │
│   (GitHub Actions will run tests)        │
└──────────────────────────────────────────┘
    │
    ├─── All checks passed?
    │    │
    │    ├─── YES → Continue ───────────┐
    │    │                              │
    │    └─── NO → Fix issues ──────────┤
    │                                   │
    ▼                                   ▼
┌──────────────────────────────────────────┐
│            MERGE PULL REQUEST            │
│   Click "Merge pull request" button      │
│   Choose: "Create a merge commit"        │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│        SET MAIN AS DEFAULT BRANCH        │
│   Settings → Branches → Switch icon      │
│   Select "main" → Update → Confirm       │
└──────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────┐
│         VERIFY EVERYTHING WORKS          │
│   ✓ Application builds                   │
│   ✓ Tests pass                           │
│   ✓ Invitation system works              │
│   ✓ Bug fixes still work                 │
└──────────────────────────────────────────┘
    │
    ├─── Everything working?
    │    │
    │    ├─── YES → Continue ────────────┐
    │    │                               │
    │    └─── NO → See rollback plan ────┤
    │            (BRANCH_MIGRATION_      │
    │             INSTRUCTIONS.md)       │
    │                                    │
    ▼                                    ▼
┌───────────────────────────────────────────┐
│          DELETE MASTER BRANCH             │
│   Branches page → Find "master"           │
│   → Trash icon → Confirm                  │
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│              MIGRATION COMPLETE! 🎉       │
│   • main is now default                   │
│   • master is deleted                     │
│   • All changes preserved                 │
└───────────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────────┐
│        UPDATE TEAM'S LOCAL CLONES         │
│   Team members run:                       │
│   $ git fetch --all --prune               │
│   $ git checkout main                     │
│   $ git pull origin main                  │
│   $ git branch -d master                  │
└───────────────────────────────────────────┘

═══════════════════════════════════════════════

QUICK LINKS:
------------
📖 Full Instructions: BRANCH_MIGRATION_INSTRUCTIONS.md
🚀 Quick Start: MIGRATION_QUICKSTART.md
⚔️  Conflict Help: MERGE_CONFLICTS_GUIDE.md
🤖 Automation: ./scripts/branch-migration.sh

═══════════════════════════════════════════════

GITHUB WEB UI STEPS:
--------------------
1. Open: https://github.com/h-heni/ResourceManager
2. Click "Pull requests" tab
3. Click "New pull request"
4. Base: main
5. Compare: copilot/merge-master-into-main
6. Click "Create pull request"
7. Add title: "Merge master branch into main"
8. Click "Create pull request"
9. Follow flowchart from "PR CREATED SUCCESSFULLY"

═══════════════════════════════════════════════

TIME ESTIMATES:
---------------
Without conflicts: 5-10 minutes
With conflicts: 20-30 minutes
Team updates: 2-5 minutes per person

═══════════════════════════════════════════════

SUPPORT:
--------
If you get stuck at any point:
1. Check the relevant guide (links above)
2. Use the interactive script: ./scripts/branch-migration.sh
3. Review conflict resolution examples in MERGE_CONFLICTS_GUIDE.md
4. Check rollback plan if something breaks

═══════════════════════════════════════════════
```
