import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function finalScreenshotSolution() {
  console.log('📸 FINAL SCREENSHOT SOLUTION');
  console.log('=============================');
  console.log('This will open a browser and wait for you to manually authenticate,');
  console.log('then automatically take screenshots of each screen.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000,
    args: ['--start-maximized', '--disable-web-security']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    console.log('🚀 Opening Data Sanity app...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);

    // Step 1: Check if we're on login screen
    const isLoginScreen = await page.locator('text="Welcome to Data Sanity"').isVisible({ timeout: 3000 });

    if (isLoginScreen) {
      console.log('📸 Taking login screen screenshot...');
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-final.png'),
        fullPage: false
      });
      console.log('✅ login-final.png captured');

      console.log('\n🔐 AUTHENTICATION REQUIRED');
      console.log('Please click "Continue with Google" and complete authentication.');
      console.log('I will wait for the dashboard to appear...\n');

      // Wait for dashboard to appear after authentication
      try {
        await page.waitForSelector('text="Sanity Check Your Data"', { timeout: 120000 });
        console.log('✅ Dashboard detected! Authentication successful.');
      } catch (error) {
        console.log('⚠️  Timeout waiting for dashboard. Taking screenshot of current state...');
      }
    }

    // Step 2: Take dashboard screenshot
    console.log('📊 Taking dashboard screenshot...');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-final.png'),
      fullPage: false
    });
    console.log('✅ dashboard-final.png captured');

    // Step 3: Try to get a working report
    console.log('📋 Attempting to capture report screenshot...');

    // First try to create a new report by uploading data
    try {
      const fileInput = await page.locator('input[type="file"]');
      const googleSheetsInput = await page.locator('input[type="url"]');

      if (await googleSheetsInput.isVisible({ timeout: 3000 })) {
        console.log('🔗 Using Google Sheets to create a report...');
        await googleSheetsInput.fill('https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit');

        const submitButton = await page.locator('button:has-text("Analyze Sheet")');
        await submitButton.click();

        console.log('⏳ Waiting for report generation...');

        // Wait for navigation to report page
        try {
          await page.waitForURL('**/report/**', { timeout: 30000 });
          console.log('✅ Navigated to report page!');

          // Wait for report content to load
          await page.waitForTimeout(5000);

          await page.screenshot({
            path: path.join(screenshotsDir, 'report-final.png'),
            fullPage: true
          });
          console.log('✅ report-final.png captured');

          // Try to capture processing screen by going back and starting another upload
          console.log('🔄 Attempting to capture processing screen...');
          await page.goto('http://localhost:3000');
          await page.waitForTimeout(2000);

          if (await googleSheetsInput.isVisible({ timeout: 3000 })) {
            await googleSheetsInput.fill('https://docs.google.com/spreadsheets/d/1sWsH9-ShnClEk8KhKCHylM4rJ5Sy6Au4tEFouqD402c/edit');
            await submitButton.click();

            // Take screenshot right after clicking (processing state)
            await page.waitForTimeout(1000);
            await page.screenshot({
              path: path.join(screenshotsDir, 'processing-final.png'),
              fullPage: false
            });
            console.log('✅ processing-final.png captured');
          }

        } catch (error) {
          console.log('⚠️  Could not capture report via Google Sheets method');
        }
      }
    } catch (error) {
      console.log('⚠️  Could not create new report, trying existing ones...');
    }

    // Fallback: try existing reports
    if (!fs.existsSync(path.join(screenshotsDir, 'report-final.png'))) {
      console.log('🔍 Trying existing report URLs...');
      const reportIds = [
        '13db38d3-1f49-4aa0-8992-7397de136c82',
        '8e7c2811-a018-49fb-b486-664529efc9a2',
        'cb17998e-66a7-45eb-a5fe-961d328d37b5',
        'fd6d5837-a00b-4f52-961b-6392f20983e2'
      ];

      for (const reportId of reportIds) {
        try {
          await page.goto(`http://localhost:3000/report/${reportId}`);
          await page.waitForTimeout(3000);

          // Check if report has content
          const hasContent = await page.locator('h1, text="Statistics", text="AI Insights", text="Issues"').first().isVisible({ timeout: 3000 });

          if (hasContent) {
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-final.png'),
              fullPage: true
            });
            console.log(`✅ report-final.png captured from ${reportId}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️  Report ${reportId} not accessible`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during screenshot process:', error);
  } finally {
    // Summary
    console.log('\n🎉 SCREENSHOT CAPTURE COMPLETED!');
    console.log('==================================');

    const finalFiles = fs.readdirSync(screenshotsDir).filter(f => f.includes('final') && f.endsWith('.png'));

    if (finalFiles.length > 0) {
      console.log('📁 Final screenshots captured:');
      finalFiles.forEach(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } else {
      console.log('📁 No final screenshots were captured.');
    }

    console.log('\n🔄 Browser will close in 10 seconds...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

finalScreenshotSolution().catch(console.error);