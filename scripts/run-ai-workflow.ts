/**
 * AI Workflow Orchestrator
 *
 * Entry point for the AI-assisted development workflow.
 * Orchestrates: translate → plan → implement → test → debug → verify
 *
 * Usage:
 *   cd ClientApp && npm run ai
 *   cd ClientApp && npm run ai -- "Add export button to invoices"
 *
 * This script handles the automated parts of the workflow:
 *   - Running Playwright tests
 *   - Collecting results
 *   - Presenting the verify/reinvestigate interface
 *
 * The translation, planning, and implementation steps are handled
 * by GitHub Copilot following the instructions in .ai/
 */

import * as readline from 'readline';
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

// ─── Configuration ────────────────────────────────────────────────

const CLIENT_APP_DIR = path.resolve(__dirname, '..', 'ClientApp');
const E2E_DIR = path.join(CLIENT_APP_DIR, 'e2e');
const AI_DIR = path.resolve(__dirname, '..', '.ai');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// ─── Utilities ────────────────────────────────────────────────────

function print(msg: string, color: string = COLORS.reset): void {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function printHeader(title: string): void {
  const line = '═'.repeat(55);
  print(`\n${line}`, COLORS.cyan);
  print(`  ${title}`, COLORS.bright);
  print(line, COLORS.cyan);
}

function printStep(step: number, total: number, description: string): void {
  print(`\n  [${step}/${total}] ${description}`, COLORS.blue);
  print('  ' + '─'.repeat(50), COLORS.gray);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${COLORS.yellow}  ${question}${COLORS.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Step 1: Translate Prompt ───────────────────────────────────

function translatePrompt(userMessage: string): string {
  printStep(1, 6, 'TRANSLATE PROMPT');

  const template = `
## TASK
${userMessage}

## CONTEXT
(To be filled by analyzing the codebase)

## IMPLEMENTATION PLAN

### Backend (if applicable)
1. Analyze existing controllers and services
2. Implement required changes

### Frontend (if applicable)
1. Analyze existing pages and hooks
2. Implement UI changes
3. Add i18n keys

## FILES AFFECTED
(To be determined after codebase analysis)

## VERIFICATION STEPS
1. Run smoke tests: cd ClientApp && npx playwright test e2e/smoke.spec.ts
2. Run feature-specific tests
3. Verify UI in browser at http://localhost:5173
`;

  print('\n  Translated prompt:', COLORS.green);
  print(template, COLORS.gray);

  return template;
}

// ─── Step 2: Plan Task ──────────────────────────────────────────

function planTask(translatedPrompt: string): void {
  printStep(2, 6, 'PLAN TASK');
  print('  → Copilot will analyze the prompt and create an implementation plan', COLORS.gray);
  print('  → See .ai/agents/planner.md for planning instructions', COLORS.gray);
  print(`  → Prompt length: ${translatedPrompt.length} chars`, COLORS.gray);
}

// ─── Step 3: Implement Code ─────────────────────────────────────

function implementCode(): void {
  printStep(3, 6, 'IMPLEMENT CODE');
  print('  → Copilot will implement the feature following .ai/agents/coder.md', COLORS.gray);
  print('  → Implementation is done interactively in the IDE', COLORS.gray);
}

// ─── Step 4: Run Browser Tests ──────────────────────────────────

interface TestResult {
  passed: number;
  failed: number;
  total: number;
  output: string;
  success: boolean;
}

function runBrowserTests(testFile?: string): TestResult {
  printStep(4, 6, 'RUN BROWSER TESTS');

  const testCmd = testFile
    ? `npx playwright test ${testFile} --reporter=list`
    : 'npx playwright test --reporter=list';

  print(`  → Running: ${testCmd}`, COLORS.gray);
  print(`  → Directory: ${CLIENT_APP_DIR}`, COLORS.gray);

  try {
    const output = execSync(testCmd, {
      cwd: CLIENT_APP_DIR,
      encoding: 'utf-8',
      timeout: 120000, // 2 minute timeout
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 0;

    print(`\n  ✅ Tests passed: ${passed}`, COLORS.green);
    if (failed > 0) {
      print(`  ❌ Tests failed: ${failed}`, COLORS.red);
    }

    return { passed, failed, total: passed + failed, output, success: failed === 0 };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.message;
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    const passed = passMatch ? parseInt(passMatch[1]) : 0;
    const failed = failMatch ? parseInt(failMatch[1]) : 1;

    print(`\n  ❌ Test execution had failures`, COLORS.red);
    print(`  Passed: ${passed}, Failed: ${failed}`, COLORS.yellow);

    return { passed, failed, total: passed + failed, output, success: false };
  }
}

// ─── Step 5: Debug if Needed ────────────────────────────────────

function debugIfNeeded(testResult: TestResult, attempt: number = 1): TestResult {
  if (testResult.success) return testResult;

  printStep(5, 6, `DEBUG (attempt ${attempt}/3)`);

  print('  → Analyzing test failures...', COLORS.yellow);
  print('  → Check .ai/agents/debugger.md for debugging instructions', COLORS.gray);

  // Extract failure details
  const lines = testResult.output.split('\n');
  const failureLines = lines.filter(
    (l) => l.includes('Error') || l.includes('FAIL') || l.includes('✘') || l.includes('×')
  );

  if (failureLines.length > 0) {
    print('\n  Failure details:', COLORS.red);
    failureLines.slice(0, 10).forEach((line) => {
      print(`    ${line.trim()}`, COLORS.red);
    });
  }

  // Check for screenshots
  const testResultsDir = path.join(CLIENT_APP_DIR, 'test-results');
  if (fs.existsSync(testResultsDir)) {
    const screenshots = fs.readdirSync(testResultsDir).filter((f) => f.endsWith('.png'));
    if (screenshots.length > 0) {
      print(`\n  Screenshots available (${screenshots.length}):`, COLORS.yellow);
      screenshots.slice(0, 5).forEach((s) => {
        print(`    → ${path.join(testResultsDir, s)}`, COLORS.gray);
      });
    }
  }

  if (attempt >= 3) {
    print('\n  ⚠️  Maximum debug attempts reached. Manual intervention required.', COLORS.red);
    return testResult;
  }

  print('\n  → Copilot will analyze and fix the issues, then re-run tests', COLORS.yellow);

  return testResult;
}

// ─── Step 6: Request User Verification ──────────────────────────

async function requestUserVerification(testResult: TestResult): Promise<'verify' | 'reinvestigate'> {
  printStep(6, 6, 'VERIFICATION');

  printHeader('TASK COMPLETE');

  const statusIcon = testResult.success ? '✅' : '⚠️';
  const statusText = testResult.success ? 'All tests passing' : 'Some issues remain';

  print(`\n  Status: ${statusIcon} ${statusText}`, testResult.success ? COLORS.green : COLORS.yellow);
  print(`  Tests:  ${testResult.passed} passed, ${testResult.failed} failed`, COLORS.gray);

  print('\n  ─────────────────────────────────────────────', COLORS.gray);
  print('\n  Actions:', COLORS.bright);
  print('    1. ✅ Verify          — Confirm the feature works correctly', COLORS.green);
  print('    2. 🔍 Reinvestigate   — Run deeper analysis and debugging', COLORS.yellow);
  print('', COLORS.reset);

  const answer = await ask('Select action (1=Verify, 2=Reinvestigate):');

  if (answer === '1' || answer.toLowerCase().startsWith('v')) {
    print('\n  ✅ Task marked as COMPLETE', COLORS.green);
    return 'verify';
  } else {
    print('\n  🔍 Starting reinvestigation...', COLORS.yellow);
    return 'reinvestigate';
  }
}

// ─── Main Orchestrator ──────────────────────────────────────────

async function main(): Promise<void> {
  printHeader('AI-ASSISTED DEVELOPMENT WORKFLOW');

  // Check prerequisites
  print('\n  Checking prerequisites...', COLORS.gray);

  if (!fs.existsSync(AI_DIR)) {
    print('  ❌ .ai/ directory not found', COLORS.red);
    process.exit(1);
  }

  if (!fs.existsSync(CLIENT_APP_DIR)) {
    print('  ❌ ClientApp/ directory not found', COLORS.red);
    process.exit(1);
  }

  print('  ✅ Project structure verified', COLORS.green);

  // Get user input
  const args = process.argv.slice(2);
  let userMessage = args.join(' ');

  if (!userMessage) {
    print('\n  Describe the feature or problem you want to solve:', COLORS.bright);
    userMessage = await ask('>');
  }

  if (!userMessage) {
    print('  ❌ No input provided. Exiting.', COLORS.red);
    process.exit(1);
  }

  // Execute workflow
  const translatedPrompt = translatePrompt(userMessage);

  // Ask for approval
  print('\n  Does this plan look correct?', COLORS.bright);
  const approval = await ask('Type "approved" to proceed or describe changes:');

  if (!approval.toLowerCase().startsWith('approv') && approval.toLowerCase() !== 'yes' && approval.toLowerCase() !== 'y') {
    print('  → Incorporate feedback and re-translate in Copilot Chat', COLORS.yellow);
    print('  → Reference: .ai/prompt-translator.md', COLORS.gray);
    process.exit(0);
  }

  planTask(translatedPrompt);
  implementCode();

  print('\n  → After Copilot implements the feature, press Enter to run tests', COLORS.yellow);
  await ask('Press Enter when ready to test...');

  // Run tests
  let testResult = runBrowserTests();

  // Debug loop
  let debugAttempt = 1;
  while (!testResult.success && debugAttempt <= 3) {
    testResult = debugIfNeeded(testResult, debugAttempt);
    if (!testResult.success && debugAttempt < 3) {
      print('\n  → Fix the issues in Copilot, then press Enter to re-run tests', COLORS.yellow);
      await ask('Press Enter to re-run tests...');
      testResult = runBrowserTests();
    }
    debugAttempt++;
  }

  // Verification loop
  let action = await requestUserVerification(testResult);

  while (action === 'reinvestigate') {
    print('\n  Running deeper analysis...', COLORS.cyan);

    // Run full test suite
    print('  → Running full e2e test suite...', COLORS.gray);
    testResult = runBrowserTests();

    // TypeScript check
    print('  → Running TypeScript compilation check...', COLORS.gray);
    try {
      execSync('npx tsc --noEmit', { cwd: CLIENT_APP_DIR, encoding: 'utf-8' });
      print('  ✅ TypeScript compilation clean', COLORS.green);
    } catch (error: any) {
      print('  ❌ TypeScript errors found:', COLORS.red);
      print(error.stdout?.toString().slice(0, 500) || 'Unknown error', COLORS.red);
    }

    // i18n check
    print('  → Running i18n check...', COLORS.gray);
    try {
      execSync('npm run i18n:check', { cwd: CLIENT_APP_DIR, encoding: 'utf-8' });
      print('  ✅ i18n coverage complete', COLORS.green);
    } catch (error: any) {
      print('  ⚠️  i18n issues found', COLORS.yellow);
    }

    action = await requestUserVerification(testResult);
  }

  printHeader('WORKFLOW COMPLETE');
  print('\n  Thank you! The task has been verified and completed. ✅\n', COLORS.green);
}

// ─── Entry Point ────────────────────────────────────────────────

main().catch((error) => {
  print(`\n  ❌ Workflow error: ${error.message}`, COLORS.red);
  process.exit(1);
});
