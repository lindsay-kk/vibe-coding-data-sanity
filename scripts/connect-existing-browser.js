import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function connectAndScreenshot() {
  console.log('📸 Connecting to existing browser session...');

  // Try to connect to Chrome DevTools if running
  let browser;
  let page;

  try {
    // First approach: Launch with existing user data
    console.log('🔄 Launching with persistent context...');

    const userDataDir = '/tmp/playwright-data-sanity';

    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1400, height: 1000 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    page = await browser.newPage();
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');

    console.log('🔑 Attempting to authenticate...');

    // Navigate and handle authentication
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);

    // Check if we need to authenticate
    const needsAuth = await page.locator('text="Continue with Google"').isVisible({ timeout: 5000 });

    if (needsAuth) {
      console.log('🔐 Authentication needed. Clicking Google OAuth...');

      // Set up promise to wait for navigation after OAuth
      const navigationPromise = page.waitForURL('http://localhost:3000', { timeout: 60000 });

      // Click the Google OAuth button
      await page.locator('text="Continue with Google"').click();

      console.log('⏳ Waiting for OAuth completion... (60 seconds max)');
      console.log('📋 Please complete Google authentication in the browser window');

      try {
        // Wait for redirect back to dashboard
        await navigationPromise;
        console.log('✅ Authentication successful!');
      } catch (error) {
        console.log('⚠️  OAuth timeout, but continuing...');
      }

      // Additional wait for dashboard to load
      await page.waitForTimeout(3000);
    }

    // Now take screenshots
    console.log('📸 Taking dashboard screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-authenticated.png'),
      fullPage: false
    });
    console.log('✅ dashboard-authenticated.png captured');

    // Try to navigate to a report
    console.log('📊 Navigating to report...');
    const reportIds = [
      '13db38d3-1f49-4aa0-8992-7397de136c82',
      '8e7c2811-a018-49fb-b486-664529efc9a2',
      'cb17998e-66a7-45eb-a5fe-961d328d37b5'
    ];

    for (const reportId of reportIds) {
      try {
        await page.goto(`http://localhost:3000/report/${reportId}`);
        await page.waitForTimeout(3000);

        // Check if report loaded successfully
        const hasReport = await page.locator('h1, .report, text="Statistics", text="AI Insights"').first().isVisible({ timeout: 3000 });

        if (hasReport) {
          console.log(`✅ Found working report: ${reportId}`);
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-authenticated.png'),
            fullPage: true
          });
          console.log('✅ report-authenticated.png captured');
          break;
        }
      } catch (error) {
        console.log(`⚠️  Report ${reportId} not accessible, trying next...`);
      }
    }

    // Optional: Try to capture processing state
    console.log('🔄 Attempting to trigger processing state...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    try {
      // Try to fill Google Sheets URL and submit
      const sheetInput = await page.locator('input[type="url"]').first();
      if (await sheetInput.isVisible({ timeout: 2000 })) {
        await sheetInput.fill('https://docs.google.com/spreadsheets/d/1Mgwdsaey2ck_Be5Vy-RF9Dr3G2XTQ8gphwXStO8JS0s/edit?usp=sharing');
        await page.locator('button:has-text("Analyze Sheet")').click();

        // Wait a moment for processing to start
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: path.join(screenshotsDir, 'processing-authenticated.png'),
          fullPage: false
        });
        console.log('✅ processing-authenticated.png captured');
      }
    } catch (error) {
      console.log('⚠️  Could not capture processing screen');
    }

    console.log('🎉 Screenshot capture completed!');

    // Summary
    const files = fs.readdirSync(screenshotsDir).filter(f => f.includes('authenticated') && f.endsWith('.png'));
    console.log('📁 Authenticated screenshots:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

  } catch (error) {
    console.error('❌ Error during screenshot capture:', error);
  } finally {
    if (browser) {
      console.log('🔄 Keeping browser open for 5 seconds...');
      await page?.waitForTimeout(5000);
      await browser.close();
    }
  }
}

connectAndScreenshot().catch(console.error);