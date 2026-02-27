#!/usr/bin/env node

/**
 * Simple Script to Capture Authenticated Screenshots
 *
 * Instructions:
 * 1. Make sure the dev server is running (npm run dev)
 * 2. Log in to the app in a browser
 * 3. Run this script: node scripts/capture-authenticated.mjs
 *
 * This script will capture screenshots of authenticated pages.
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  baseUrl: 'http://localhost:5174',
  screenshotsDir: path.join(__dirname, '../public/assets/screenshots'),
  viewport: { width: 1200, height: 800 }
};

const PAGES = [
  { name: 'dashboard', url: '/dashboard', title: 'Dashboard Overview' },
  { name: 'invoices', url: '/dashboard/invoices', title: 'Invoice Management' },
  { name: 'data-management', url: '/dashboard/data-management', title: 'Data Management' },
  { name: 'clients', url: '/dashboard/clients', title: 'Client Management' },
  { name: 'expenses', url: '/dashboard/expenses', title: 'Expense Tracking' },
  { name: 'quotes', url: '/dashboard/quotes', title: 'Quote Management' },
];

function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.screenshotsDir)) {
    fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
  }
}

async function captureScreenshots() {
  console.log('📸 Capturing authenticated screenshots...\n');

  ensureOutputDir();

  const browser = await puppeteer.launch({
    headless: false, // Show browser so you can log in
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(CONFIG.viewport);

  try {
    console.log('🌐 Opening browser... Please log in if prompted.\n');
    console.log('Press Ctrl+C after capturing all screenshots to stop.\n');

    // Navigate to home page first
    await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle2' });

    // Give time for user to log in if needed
    console.log('⏱️  Waiting 5 seconds for you to log in if needed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Capture each page
    for (const pageConfig of PAGES) {
      console.log(`📸 Capturing: ${pageConfig.title}`);
      console.log(`   URL: ${pageConfig.url}`);

      try {
        await page.goto(`${CONFIG.baseUrl}${pageConfig.url}`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        const outputPath = path.join(CONFIG.screenshotsDir, `${pageConfig.name}.png`);
        await page.screenshot({
          path: outputPath,
          type: 'png'
        });

        console.log(`   ✅ Saved: ${pageConfig.name}.png\n`);
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}\n`);
      }
    }

    console.log('✅ All screenshots captured!');
    console.log(`📁 Location: ${CONFIG.screenshotsDir}`);

  } finally {
    await browser.close();
  }
}

captureScreenshots().catch(console.error);
