/**
 * Feature Verification Script
 *
 * Runs automated verification checks after a feature implementation:
 *   1. TypeScript compilation
 *   2. ESLint
 *   3. i18n coverage
 *   4. Playwright e2e tests
 *
 * Usage:
 *   cd ClientApp && npm run verify
 *   npx tsx ../scripts/verify-feature.ts [test-file]
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

const CLIENT_APP_DIR = path.resolve(__dirname, '..', 'ClientApp');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function print(msg: string, color: string = COLORS.reset): void {
  console.log(`${color}${msg}${COLORS.reset}`);
}

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

function runCheck(name: string, command: string, warnOnly: boolean = false): CheckResult {
  print(`  → ${name}...`, COLORS.gray);
  try {
    const output = execSync(command, {
      cwd: CLIENT_APP_DIR,
      encoding: 'utf-8',
      timeout: 120000,
      env: { ...process.env, FORCE_COLOR: '0' },
    });
    print(`    ✅ ${name} passed`, COLORS.green);
    return { name, status: 'pass', message: 'Passed' };
  } catch (error: any) {
    const output = error.stdout?.toString() || error.message;
    if (warnOnly) {
      print(`    ⚠️  ${name} warnings`, COLORS.yellow);
      return { name, status: 'warn', message: 'Warnings found', details: output.slice(0, 300) };
    }
    print(`    ❌ ${name} failed`, COLORS.red);
    return { name, status: 'fail', message: 'Failed', details: output.slice(0, 500) };
  }
}

function main(): void {
  const line = '═'.repeat(55);
  print(`\n${line}`, COLORS.cyan);
  print('  FEATURE VERIFICATION', COLORS.bright);
  print(line, COLORS.cyan);

  const testFile = process.argv[2];
  const results: CheckResult[] = [];

  // Check 1: TypeScript compilation
  results.push(runCheck('TypeScript compilation', 'npx tsc --noEmit'));

  // Check 2: ESLint
  results.push(runCheck('ESLint', 'npm run lint', true));

  // Check 3: i18n coverage
  results.push(runCheck('i18n coverage', 'npm run i18n:check', true));

  // Check 4: Playwright tests
  const testCmd = testFile
    ? `npx playwright test ${testFile} --reporter=list`
    : 'npx playwright test e2e/smoke.spec.ts --reporter=list';
  results.push(runCheck('Playwright E2E tests', testCmd));

  // Summary
  print(`\n${line}`, COLORS.cyan);
  print('  VERIFICATION SUMMARY', COLORS.bright);
  print(line, COLORS.cyan);

  const passed = results.filter((r) => r.status === 'pass').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  const failed = results.filter((r) => r.status === 'fail').length;

  results.forEach((r) => {
    const icon = r.status === 'pass' ? '✅' : r.status === 'warn' ? '⚠️' : '❌';
    const color = r.status === 'pass' ? COLORS.green : r.status === 'warn' ? COLORS.yellow : COLORS.red;
    print(`  ${icon} ${r.name}: ${r.message}`, color);
    if (r.details) {
      r.details.split('\n').slice(0, 5).forEach((line) => {
        print(`     ${line}`, COLORS.gray);
      });
    }
  });

  print(`\n  Total: ${passed} passed, ${warned} warnings, ${failed} failed`, COLORS.bright);

  if (failed === 0) {
    print('\n  ✅ ALL CHECKS PASSED — Feature is verified\n', COLORS.green);
    process.exit(0);
  } else {
    print('\n  ❌ SOME CHECKS FAILED — Fix issues and re-verify\n', COLORS.red);
    process.exit(1);
  }
}

main();
