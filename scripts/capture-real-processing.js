import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureRealProcessing() {
  console.log('📸 CAPTURING REAL PROCESSING STATE');
  console.log('==================================');
  console.log('Looking for real processing reports...\n');

  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-comprehensive', {
    headless: false,
    viewport: { width: 1400, height: 1000 },
    args: ['--start-maximized'],
    slowMo: 500
  });

  const page = await browser.pages()[0] || await browser.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'screenshots');

  try {
    // Helper function to set theme
    const setTheme = async (isDark) => {
      await page.evaluate((dark) => {
        const html = document.documentElement;
        if (dark) {
          html.classList.add('dark');
          localStorage.setItem('theme', 'dark');
        } else {
          html.classList.remove('dark');
          localStorage.setItem('theme', 'light');
        }
      }, isDark);
      await page.waitForTimeout(500);
    };

    console.log('🔍 Checking reports history for processing reports...');
    await page.goto('http://localhost:3000/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for processing badges
    const processingBadges = await page.locator('text="Processing"').count();
    console.log(`Found ${processingBadges} processing reports`);

    if (processingBadges > 0) {
      console.log('✅ Found processing reports! Trying to access them...');

      // Get all report links
      const reportCards = await page.locator('div:has(a[href^="/report/"])').all();

      for (let i = 0; i < Math.min(reportCards.length, 5); i++) {
        try {
          console.log(`🔍 Checking report ${i + 1}...`);

          // Check if this card has "Processing" badge
          const hasProcessingBadge = await reportCards[i].locator('text="Processing"').isVisible().catch(() => false);

          if (hasProcessingBadge) {
            console.log(`✅ Found processing report ${i + 1}!`);

            // Click on the report link
            const reportLink = reportCards[i].locator('a[href^="/report/"]');
            await reportLink.click();
            await page.waitForTimeout(3000);

            // Check if we're on a processing page
            const hasProcessingContent = await page.locator('text="Processing Your Data"').isVisible({ timeout: 5000 }).catch(() => false);

            if (hasProcessingContent) {
              console.log('🎉 Found real processing page!');

              // Light mode
              console.log('📸 Taking real processing screenshot (light mode)...');
              await setTheme(false);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-light.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-light.png captured (REAL)');

              // Dark mode
              console.log('📸 Taking real processing screenshot (dark mode)...');
              await setTheme(true);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-dark.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-dark.png captured (REAL)');

              console.log('\n🎉 REAL PROCESSING SCREENSHOTS CAPTURED!');
              return;
            } else {
              console.log('❌ This report is not in processing state');
              // Go back to history
              await page.goto('http://localhost:3000/history');
              await page.waitForTimeout(1000);
            }
          }
        } catch (error) {
          console.log(`❌ Error with report ${i + 1}: ${error.message}`);
        }
      }
    }

    console.log('⚠️  No real processing states found. Trying to create one...');

    // Try to create a processing state by uploading a file
    console.log('🔄 Creating new upload to trigger processing...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Create a test CSV file content
    const testCsvContent = `name,age,email,city
John Doe,25,john@example.com,New York
Jane Smith,30,jane@example.com,Los Angeles
Bob Johnson,35,bob@example.com,Chicago
Alice Brown,28,alice@example.com,Miami
Charlie Wilson,32,charlie@example.com,Seattle
Diana Lee,27,diana@example.com,Boston
Edward Davis,29,edward@example.com,Denver
Fiona Garcia,31,fiona@example.com,Austin
George Miller,26,george@example.com,Portland
Helen Taylor,33,helen@example.com,Phoenix`;

    // Try to upload via file input
    try {
      // Write the test CSV to a temp file
      const tempCsvPath = path.join(screenshotsDir, 'temp-test.csv');
      fs.writeFileSync(tempCsvPath, testCsvContent);

      console.log('📤 Uploading test CSV file...');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(tempCsvPath);

      // Wait for upload to start
      await page.waitForTimeout(2000);

      // Check if we're redirected to a processing page
      const currentUrl = page.url();
      if (currentUrl.includes('/report/')) {
        console.log('✅ Upload triggered! Checking for processing state...');
        await page.waitForTimeout(3000);

        const hasProcessingContent = await page.locator('text="Processing Your Data"').isVisible({ timeout: 5000 }).catch(() => false);

        if (hasProcessingContent) {
          console.log('🎉 Successfully triggered real processing state!');

          // Light mode
          console.log('📸 Taking real processing screenshot (light mode)...');
          await setTheme(false);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-light.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-light.png captured (REAL)');

          // Dark mode
          console.log('📸 Taking real processing screenshot (dark mode)...');
          await setTheme(true);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-dark.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-dark.png captured (REAL)');

          console.log('\n🎉 REAL PROCESSING SCREENSHOTS CAPTURED!');
          return;
        }
      }

      // Clean up temp file
      fs.unlinkSync(tempCsvPath);

    } catch (error) {
      console.log(`❌ Upload failed: ${error.message}`);
    }

    console.log('❌ Could not find or create real processing state');
    console.log('💡 The previous processing screenshots were mock-ups');

  } catch (error) {
    console.error('❌ Error capturing real processing:', error);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
    console.log('🎉 Real processing capture attempt completed!');
  }
}

console.log('Starting real processing capture...');
captureRealProcessing().catch(console.error);