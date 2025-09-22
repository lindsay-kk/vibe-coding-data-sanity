import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeScreenshots() {
  console.log('📸 Starting automated screenshot capture...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();

  // Ensure screenshots directory exists
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // 1. Login Screen (logged out state)
    console.log('📸 Taking login screen screenshot...');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('h1', { timeout: 10000 });
    await page.screenshot({
      path: path.join(screenshotsDir, 'login-screen.png'),
      fullPage: false
    });
    console.log('✅ login-screen.png captured');

    // For the remaining screenshots, we need to handle authentication
    // Since this is a demo app with Google OAuth, we'll take screenshots of public areas

    // 2. Dashboard (main upload interface - we can capture the logged-out view which shows the interface)
    console.log('📸 Taking dashboard screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard.png'),
      fullPage: false
    });
    console.log('✅ dashboard.png captured');

    // 3. For processing screen, we'll navigate to a sample report that triggers processing
    console.log('📸 Taking processing screen screenshot...');
    // Upload a test file to trigger processing state
    await page.goto('http://localhost:3000');

    // Try to upload a file to capture processing state
    const fileInput = await page.locator('input[type="file"]').first();
    if (await fileInput.isVisible()) {
      // Create a test CSV file
      const testCsvContent = 'Name,Age,Email\nJohn Doe,30,john@example.com\nJane Smith,25,jane@example.com';
      const testFilePath = path.join(__dirname, 'test-data.csv');
      fs.writeFileSync(testFilePath, testCsvContent);

      await fileInput.setInputFiles(testFilePath);

      // Wait for processing to start
      await page.waitForSelector('.animate-spin, [data-processing="true"], text="Processing"', { timeout: 5000 });
      await page.screenshot({
        path: path.join(screenshotsDir, 'processing-screen.png'),
        fullPage: false
      });
      console.log('✅ processing-screen.png captured');

      // Clean up test file
      fs.unlinkSync(testFilePath);
    } else {
      console.log('⚠️  Could not find file input for processing screenshot');
    }

    // 4. Report Screen - navigate to an existing report
    console.log('📸 Taking report screen screenshot...');
    // Check if there are any existing reports we can navigate to
    const reportLinks = await page.locator('a[href*="/report/"]').all();
    if (reportLinks.length > 0) {
      await reportLinks[0].click();
      await page.waitForSelector('[data-testid="report-content"], .report-section, h1', { timeout: 10000 });
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen.png'),
        fullPage: true
      });
      console.log('✅ report-screen.png captured');
    } else {
      // If no existing reports, navigate to a sample report URL
      await page.goto('http://localhost:3000/report/sample-report-id');
      await page.waitForTimeout(3000); // Wait for content to load
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen.png'),
        fullPage: true
      });
      console.log('✅ report-screen.png captured (sample)');
    }

    console.log('🎉 All screenshots captured successfully!');
    console.log('📁 Screenshots saved to:', screenshotsDir);

  } catch (error) {
    console.error('❌ Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run the screenshot function
takeScreenshots().catch(console.error);