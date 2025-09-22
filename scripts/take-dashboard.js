import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeDashboardScreenshot() {
  console.log('📸 Taking dashboard screenshot...');
  console.log('Make sure you are logged in and can see the dashboard at http://localhost:3000');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-final.png'),
      fullPage: false
    });

    console.log('✅ dashboard-final.png saved to screenshots folder');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

takeDashboardScreenshot().catch(console.error);