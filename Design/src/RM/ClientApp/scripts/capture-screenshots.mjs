#!/usr/bin/env node

/**
 * Puppeteer Script to Capture Real Screenshots of the App
 * Usage: node scripts/capture-screenshots.mjs
 *
 * This script captures screenshots of key app pages for the landing page.
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Base URL - adjust this to match your development server
  baseUrl: 'http://localhost:5174',

  // Test credentials - create a test account or use existing
  login: {
    email: 'test@example.com',
    password: 'Test123456'
  },

  // Screenshots configuration
  screenshotsDir: path.join(__dirname, '../public/assets/screenshots'),

  // Viewport size for consistent screenshots
  viewport: {
    width: 1200,
    height: 800
  },

  // Screenshot quality (1-100)
  quality: 95
};

// Screens to capture
const SCREENSHOTS = [
  {
    name: 'dashboard',
    url: '/dashboard',
    description: 'Dashboard Overview',
    selectorsToHide: [
      // Hide notifications or floating elements
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  },
  {
    name: 'invoices',
    url: '/dashboard/invoices',
    description: 'Invoice Management',
    selectorsToHide: [
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  },
  {
    name: 'data-management',
    url: '/dashboard/data-management',
    description: 'Data Import/Export',
    selectorsToHide: [
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  },
  {
    name: 'clients',
    url: '/dashboard/clients',
    description: 'Client Management',
    selectorsToHide: [
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  },
  {
    name: 'expenses',
    url: '/dashboard/expenses',
    description: 'Expense Tracking',
    selectorsToHide: [
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  },
  {
    name: 'quotes',
    url: '/dashboard/quotes',
    description: 'Quote Management',
    selectorsToHide: [
      '.notification-bell',
      '[data-testid="notification-badge"]'
    ]
  }
];

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.screenshotsDir)) {
    fs.mkdirSync(CONFIG.screenshotsDir, { recursive: true });
    console.log(`Created screenshots directory: ${CONFIG.screenshotsDir}`);
  }
}

/**
 * Capture a single screenshot
 */
async function captureScreenshot(page, screenshotConfig, options = {}) {
  const { name, url, description, selectorsToHide } = screenshotConfig;
  const fullPath = path.join(CONFIG.screenshotsDir, `${name}.png`);

  console.log(`\n📸 Capturing: ${description}`);
  console.log(`   URL: ${url}`);

  try {
    // Navigate to the page
    await page.goto(`${CONFIG.baseUrl}${url}`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for any animations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Hide specified elements (like notification badges)
    if (selectorsToHide && selectorsToHide.length > 0) {
      await page.evaluate((selectors) => {
        selectors.forEach(selector => {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
          });
        });
      }, selectorsToHide);
    }

    // Capture screenshot
    await page.screenshot({
      path: fullPath,
      fullPage: options.fullPage || false,
      type: 'png'
    });

    console.log(`   ✅ Saved: ${fullPath}`);
    return fullPath;

  } catch (error) {
    console.error(`   ❌ Error capturing ${name}:`, error.message);
    return null;
  }
}

/**
 * Log in to the application
 */
async function login(page) {
  console.log('\n🔐 Attempting to log in...');

  try {
    // Navigate to login page
    await page.goto(`${CONFIG.baseUrl}/login`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for login form
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });

    // Fill in credentials
    await page.type('input[type="email"]', CONFIG.login.email, { delay: 100 });
    await page.type('input[type="password"]', CONFIG.login.password, { delay: 100 });

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're redirected to dashboard or stayed on login (error)
    const currentUrl = page.url();
    if (currentUrl.includes('/dashboard')) {
      console.log('   ✅ Login successful!');
      return true;
    } else if (currentUrl.includes('/login')) {
      // Check for error message
      const errorElement = await page.$('.error-message, [role="alert"], .text-red-600');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        console.error(`   ❌ Login failed: ${errorText}`);
      }
      return false;
    }

    // Check for company initialization
    if (currentUrl.includes('/company-init') || currentUrl.includes('/setup-account')) {
      console.log('   ⚠️  Account needs initialization. Skipping authenticated screenshots.');
      console.log('   💡 Tip: Complete the setup or create a test account with initialized profile.');
      return 'needs-init';
    }

    return true;

  } catch (error) {
    console.error('   ❌ Login error:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📸 ResourceManager Screenshot Capture Script');
  console.log('='.repeat(60));
  console.log(`Base URL: ${CONFIG.baseUrl}`);
  console.log(`Output Dir: ${CONFIG.screenshotsDir}`);

  // Ensure output directory exists
  ensureOutputDir();

  let browser;
  let page;
  let loginSuccessful = false;

  try {
    // Launch browser
    console.log('\n🚀 Launching browser...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    page = await browser.newPage();
    await page.setViewport(CONFIG.viewport);

    // Try to log in
    loginSuccessful = await login(page);

    if (loginSuccessful === 'needs-init') {
      console.log('\n⚠️  Test account needs initialization.');
      console.log('💡 Creating unauthenticated screenshots instead...\n');

      // Capture landing page
      await page.goto(`${CONFIG.baseUrl}/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const landingPath = path.join(CONFIG.screenshotsDir, 'landing.png');
      await page.screenshot({
        path: landingPath,
        fullPage: true,
        type: 'png'
      });
      console.log(`✅ Landing page captured: ${landingPath}\n`);

      await browser.close();
      return;
    }

    if (!loginSuccessful) {
      console.log('\n❌ Login failed. Capturing public pages only...\n');

      // Capture landing page
      await page.goto(`${CONFIG.baseUrl}/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const landingPath = path.join(CONFIG.screenshotsDir, 'landing.png');
      await page.screenshot({
        path: landingPath,
        fullPage: true,
        type: 'png'
      });
      console.log(`✅ Landing page captured: ${landingPath}\n`);

      await browser.close();
      return;
    }

    // Capture authenticated pages
    console.log('\n📸 Capturing authenticated pages...');

    let captured = 0;
    for (const screenshot of SCREENSHOTS) {
      const result = await captureScreenshot(page, screenshot);
      if (result) captured++;
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Capture complete! ${captured}/${SCREENSHOTS.length} screenshots taken.`);
    console.log('='.repeat(60));
    console.log(`\n📁 Screenshots saved to: ${CONFIG.screenshotsDir}`);

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the script
await main().catch(console.error);
