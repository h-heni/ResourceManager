# AI Workflow VS Code Extension

Minimal VS Code extension that provides **Next** and **Reinvestigate** buttons for the AI development workflow.

## What It Does

- Adds an **AI Workflow** panel to the VS Code activity bar (sidebar).
- The panel shows two buttons:
  - **✅ Next** — Mark the current task as verified and complete.
  - **🔍 Reinvestigate** — Request deeper debugging and re-run verification.
- Writes the user's decision to `.ai-workflow-state.json` in the workspace root, which scripts can read.
- Also registers commands in the Command Palette:
  - `AI Workflow: Next (Verify & Complete)`
  - `AI Workflow: Reinvestigate (Re-run Debugging)`
  - `AI Workflow: Show Verify / Reinvestigate Panel`

## Installation

```bash
cd .vscode-ext/ai-workflow
npm install
npm run compile
```

Then in VS Code:
1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run `Developer: Install Extension from Location...`
3. Select the `.vscode-ext/ai-workflow` folder

Or for development:
1. Open `.vscode-ext/ai-workflow` in a new VS Code window
2. Press `F5` to launch the Extension Development Host

## How It Communicates

The extension writes a JSON state file (`.ai-workflow-state.json`) to the workspace root when the user clicks a button:

```json
{
  "action": "next",
  "timestamp": "2026-03-07T10:30:00.000Z",
  "message": "User verified and completed the task."
}
```

The `scripts/review-interface.ts` can read this file to integrate with the CLI workflow.

## Development

```bash
npm run watch    # Watch mode for TypeScript compilation
```
