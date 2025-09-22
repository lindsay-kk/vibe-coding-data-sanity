import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixScreenshots() {
  console.log('📸 Taking proper screenshots from the actual Data Sanity app...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 1000 // Slow down for better captures
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    // 1. Login screen is already correct
    console.log('✅ Login screen already looks good');

    // 2. Dashboard - let's get a proper dashboard shot by using existing auth
    console.log('📸 Capturing dashboard from existing session...');

    // Try navigating to app and check current state
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(3000);

    // Take dashboard screenshot (whether logged in or not)
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-new.png'),
      fullPage: false
    });
    console.log('✅ dashboard-new.png captured');

    // 3. Report screen - use an existing completed report
    const reportIds = [
      '13db38d3-1f49-4aa0-8992-7397de136c82',
      '8e7c2811-a018-49fb-b486-664529efc9a2',
      'cb17998e-66a7-45eb-a5fe-961d328d37b5',
      'fd6d5837-a00b-4f52-961b-6392f20983e2',
      '862988b2-d9f1-404f-bb6d-64d8c904e74b'
    ];

    console.log('📸 Capturing real report screen...');
    let reportCaptured = false;

    for (const reportId of reportIds) {
      try {
        console.log(`🔍 Trying report: ${reportId}`);
        await page.goto(`http://localhost:3000/report/${reportId}`);
        await page.waitForTimeout(3000);

        // Look for report content
        const hasContent = await page.locator('h1, .report-section, [data-testid*="report"]').first().isVisible({ timeout: 5000 });

        if (hasContent) {
          console.log('📸 Taking report screenshot...');
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen-new.png'),
            fullPage: true
          });
          console.log(`✅ report-screen-new.png captured from ${reportId}`);
          reportCaptured = true;
          break;
        }
      } catch (error) {
        console.log(`⚠️  Report ${reportId} not accessible: ${error.message}`);
      }
    }

    if (!reportCaptured) {
      console.log('📋 No accessible reports found, will use existing screenshot');
    }

    // 4. Processing screen - trigger Google Sheets flow
    console.log('📸 Capturing processing screen with Google Sheets...');
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check if there's a Google Sheets input
    try {
      const sheetInput = await page.locator('input[type="url"]').first();
      if (await sheetInput.isVisible({ timeout: 3000 })) {
        await sheetInput.fill('https://docs.google.com/spreadsheets/d/1Mgwdsaey2ck_Be5Vy-RF9Dr3G2XTQ8gphwXStO8JS0s/edit?usp=sharing');

        const submitButton = await page.locator('button:has-text("Analyze Sheet")');
        await submitButton.click();

        // Wait for OAuth redirect or processing to start
        await page.waitForTimeout(3000);

        console.log('📸 Taking processing screenshot...');
        await page.screenshot({
          path: path.join(screenshotsDir, 'processing-screen-new.png'),
          fullPage: false
        });
        console.log('✅ processing-screen-new.png captured');
      }
    } catch (error) {
      console.log('⚠️  Could not capture processing screen:', error.message);
    }

    console.log('🎉 Screenshot fixing completed!');

    // List all screenshots
    const files = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));
    console.log('📁 Available screenshots:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

  } catch (error) {
    console.error('❌ Error fixing screenshots:', error);
  } finally {
    await browser.close();
  }
}

fixScreenshots().catch(console.error);