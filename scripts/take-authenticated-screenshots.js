import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeAuthenticatedScreenshots() {
  console.log('📸 Taking screenshots with existing authentication...');

  // Connect to existing browser or launch new one with user data
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data', {
    headless: false,
    viewport: { width: 1400, height: 1000 },
    args: ['--start-maximized']
  });

  const page = await browser.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    console.log('🔄 Navigating to dashboard...');
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForTimeout(5000);

    // Check if we're on dashboard or login
    const isLogin = await page.locator('text="Welcome to Data Sanity"').isVisible({ timeout: 2000 });

    if (isLogin) {
      console.log('📸 Taking login screenshot...');
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-screen-final.png'),
        fullPage: false
      });
      console.log('✅ login-screen-final.png captured');

      console.log('⚠️  Still showing login page. Please authenticate in the browser that just opened.');
      console.log('After authentication, the browser will stay open for 30 seconds for you to navigate.');

      // Wait for user to authenticate
      await page.waitForTimeout(30000);

    }

    // Try to take dashboard screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-current.png'),
      fullPage: false
    });
    console.log('✅ dashboard-current.png captured (current state)');

    // Try to navigate to a report
    console.log('🔄 Attempting to navigate to report...');
    await page.goto('http://localhost:3000/report/13db38d3-1f49-4aa0-8992-7397de136c82');
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(screenshotsDir, 'report-current.png'),
      fullPage: true
    });
    console.log('✅ report-current.png captured (current state)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    console.log('🔄 Browser will stay open for 10 more seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

takeAuthenticatedScreenshots().catch(console.error);