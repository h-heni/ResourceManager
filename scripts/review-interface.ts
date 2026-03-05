/**
 * Review Interface — Verify / Reinvestigate
 *
 * Interactive CLI that presents the verification results and
 * allows the user to either confirm the feature or request
 * deeper investigation.
 *
 * Usage:
 *   npx tsx ../scripts/review-interface.ts
 *   cd ClientApp && npm run review
 */

import * as readline from 'readline';
import { execSync } from 'child_process';
import * as path from 'path';

const CLIENT_APP_DIR = path.resolve(__dirname, '..', 'ClientApp');

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

function print(msg: string, color: string = COLORS.reset): void {
  console.log(`${color}${msg}${COLORS.reset}`);
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

interface VerificationState {
  testsRun: boolean;
  testsPassed: number;
  testsFailed: number;
  typeCheckPassed: boolean;
  i18nPassed: boolean;
  attempts: number;
}

function runSmoke(): { passed: number; failed: number } {
  try {
    const output = execSync('npx playwright test e2e/smoke.spec.ts --reporter=list', {
      cwd: CLIENT_APP_DIR,
      encoding: 'utf-8',
      timeout: 60000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 0,
    };
  } catch (error: any) {
    const output = error.stdout?.toString() || '';
    const passMatch = output.match(/(\d+) passed/);
    const failMatch = output.match(/(\d+) failed/);
    return {
      passed: passMatch ? parseInt(passMatch[1]) : 0,
      failed: failMatch ? parseInt(failMatch[1]) : 1,
    };
  }
}

function runTypeCheck(): boolean {
  try {
    execSync('npx tsc --noEmit', {
      cwd: CLIENT_APP_DIR,
      encoding: 'utf-8',
      timeout: 60000,
    });
    return true;
  } catch {
    return false;
  }
}

function runI18nCheck(): boolean {
  try {
    execSync('npm run i18n:check', {
      cwd: CLIENT_APP_DIR,
      encoding: 'utf-8',
      timeout: 30000,
    });
    return true;
  } catch {
    return false;
  }
}

function displayReport(state: VerificationState): void {
  const line = '═'.repeat(55);
  const divider = '─'.repeat(55);

  print(`\n${line}`, COLORS.cyan);
  print('  VERIFICATION REPORT', COLORS.bright);
  print(line, COLORS.cyan);

  const overallPass = state.testsFailed === 0 && state.typeCheckPassed;

  print(`\n  Status: ${overallPass ? '✅ ALL CHECKS PASSED' : '⚠️  ISSUES FOUND'}`,
    overallPass ? COLORS.green : COLORS.yellow);

  print(`\n  ${divider}`, COLORS.gray);
  print('  Check Results:', COLORS.bright);

  // Tests
  if (state.testsRun) {
    const testIcon = state.testsFailed === 0 ? '✅' : '❌';
    print(`    ${testIcon} E2E Tests: ${state.testsPassed} passed, ${state.testsFailed} failed`,
      state.testsFailed === 0 ? COLORS.green : COLORS.red);
  } else {
    print('    ⏭️  E2E Tests: Not run', COLORS.gray);
  }

  // TypeScript
  print(`    ${state.typeCheckPassed ? '✅' : '❌'} TypeScript: ${state.typeCheckPassed ? 'Clean' : 'Errors found'}`,
    state.typeCheckPassed ? COLORS.green : COLORS.red);

  // i18n
  print(`    ${state.i18nPassed ? '✅' : '⚠️'} i18n: ${state.i18nPassed ? 'Complete' : 'Issues found'}`,
    state.i18nPassed ? COLORS.green : COLORS.yellow);

  print(`\n  Investigation depth: ${state.attempts}`, COLORS.gray);
  print(`  ${divider}`, COLORS.gray);

  print('\n  Actions:', COLORS.bright);
  print('    1. ✅ Verify          — I confirm this works correctly', COLORS.green);
  print('    2. 🔍 Reinvestigate   — Run deeper analysis', COLORS.yellow);
  print('    3. 🚪 Exit            — Exit without decision', COLORS.gray);
  print('', COLORS.reset);
}

async function reinvestigate(state: VerificationState): Promise<VerificationState> {
  state.attempts++;

  print('\n  🔍 Reinvestigation in progress...', COLORS.cyan);
  print('  ────────────────────────────────────────', COLORS.gray);

  // Run all checks
  print('  Running E2E tests...', COLORS.gray);
  const testResults = runSmoke();
  state.testsRun = true;
  state.testsPassed = testResults.passed;
  state.testsFailed = testResults.failed;

  print('  Running TypeScript check...', COLORS.gray);
  state.typeCheckPassed = runTypeCheck();

  print('  Running i18n check...', COLORS.gray);
  state.i18nPassed = runI18nCheck();

  // Deep analysis on reinvestigation
  if (state.attempts >= 2) {
    print('\n  Deep analysis:', COLORS.cyan);

    // Run full test suite (not just smoke)
    print('  → Running full Playwright test suite...', COLORS.gray);
    try {
      const fullOutput = execSync('npx playwright test --reporter=list', {
        cwd: CLIENT_APP_DIR,
        encoding: 'utf-8',
        timeout: 120000,
        env: { ...process.env, FORCE_COLOR: '0' },
      });
      print('  ✅ Full test suite completed', COLORS.green);
    } catch (error: any) {
      print('  ⚠️  Some tests in full suite failed', COLORS.yellow);
      const output = error.stdout?.toString() || '';
      const failLines = output.split('\n').filter((l: string) =>
        l.includes('FAIL') || l.includes('✘') || l.includes('×')
      );
      failLines.slice(0, 5).forEach((line: string) => {
        print(`      ${line.trim()}`, COLORS.red);
      });
    }
  }

  return state;
}

async function main(): Promise<void> {
  const line = '═'.repeat(55);
  print(`\n${line}`, COLORS.cyan);
  print('  REVIEW INTERFACE — Verify / Reinvestigate', COLORS.bright);
  print(line, COLORS.cyan);

  let state: VerificationState = {
    testsRun: false,
    testsPassed: 0,
    testsFailed: 0,
    typeCheckPassed: false,
    i18nPassed: false,
    attempts: 0,
  };

  // Initial check
  print('\n  Running initial checks...', COLORS.gray);
  state = await reinvestigate(state);

  let running = true;
  while (running) {
    displayReport(state);
    const answer = await ask('Select action (1/2/3):');

    switch (answer) {
      case '1':
      case 'verify':
        print('\n  ✅ Feature VERIFIED and marked as complete!', COLORS.green);
        print(`  Total investigation depth: ${state.attempts}`, COLORS.gray);
        print(`  Final test results: ${state.testsPassed} passed, ${state.testsFailed} failed\n`, COLORS.gray);
        running = false;
        break;

      case '2':
      case 'reinvestigate':
        state = await reinvestigate(state);
        break;

      case '3':
      case 'exit':
        print('\n  Exiting without decision.\n', COLORS.gray);
        running = false;
        break;

      default:
        print('  Invalid option. Please enter 1, 2, or 3.', COLORS.yellow);
    }
  }
}

main().catch((error) => {
  print(`\n  ❌ Error: ${error.message}`, COLORS.red);
  process.exit(1);
});
