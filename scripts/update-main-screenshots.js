import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateMainScreenshots() {
  console.log('📸 UPDATING MAIN SCREENSHOTS');
  console.log('=============================');
  console.log('Updating all main screenshot files with navigation menu...\n');

  // Use persistent context to maintain authentication
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-comprehensive', {
    headless: false,
    viewport: { width: 1400, height: 1000 },
    args: ['--start-maximized'],
    slowMo: 500
  });

  const page = await browser.pages()[0] || await browser.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'screenshots');

  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

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
      await page.waitForTimeout(500); // Wait for theme transition
    };

    console.log('🚀 Navigating to dashboard...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're authenticated
    const isDashboard = await page.locator('text="Sanity Check Your Data"').isVisible({ timeout: 5000 }).catch(() => false);

    if (isDashboard) {
      console.log('✅ Successfully authenticated - updating main screenshots...');

      // 1. UPDATE MAIN DASHBOARD SCREENSHOTS
      console.log('📱 Updating main dashboard screenshots...');

      // Light mode dashboard
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen-light.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen-light.png updated');

      // Dark mode dashboard
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen-dark.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen-dark.png updated');

      // 2. UPDATE REPORT SCREENSHOTS
      console.log('📊 Updating main report screenshots...');

      // Try to find an existing report
      const reportIds = [
        '13db38d3-1f49-4aa0-8992-7397de136c82',
        'test-report-id',
        'sample-report'
      ];

      let reportFound = false;

      for (const reportId of reportIds) {
        try {
          console.log(`🔍 Trying report ID: ${reportId}...`);
          await page.goto(`http://localhost:3000/report/${reportId}`);
          await page.waitForTimeout(3000);

          // Check if we got a real report (not error page)
          const hasError = await page.locator('text="Report Error"').isVisible({ timeout: 2000 }).catch(() => false);
          const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 2000 }).catch(() => false);
          const hasReportData = await page.locator('text="Dataset Size"').isVisible({ timeout: 2000 }).catch(() => false);

          if (!hasError && (hasProcessing || hasReportData)) {
            console.log(`✅ Found valid report with ID: ${reportId}`);
            reportFound = true;

            // Light mode report
            await setTheme(false);
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-screen-light.png'),
              fullPage: true
            });
            console.log('✅ report-screen-light.png updated');

            // Dark mode report
            await setTheme(true);
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-screen-dark.png'),
              fullPage: true
            });
            console.log('✅ report-screen-dark.png updated');

            // Check if this is a processing state
            if (hasProcessing) {
              console.log('⚡ Found processing state - updating processing screenshots...');

              // Light mode processing
              await setTheme(false);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-light.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-light.png updated');

              // Dark mode processing
              await setTheme(true);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-dark.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-dark.png updated');
            }

            break;
          }
        } catch (error) {
          console.log(`❌ Report ${reportId} not accessible: ${error.message}`);
        }
      }

      if (!reportFound) {
        console.log('⚠️  No valid reports found. Creating a test upload for processing screenshots...');

        // Go back to dashboard and try to trigger processing state
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Check if we can find any existing processing reports in history
        try {
          await page.goto('http://localhost:3000/history');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);

          // Look for processing reports
          const processingReports = await page.locator('text="Processing"').count();
          if (processingReports > 0) {
            console.log('🔍 Found processing reports in history...');
            // Click on the first processing report
            const firstProcessingLink = page.locator('a[href^="/report/"]').first();
            if (await firstProcessingLink.isVisible()) {
              await firstProcessingLink.click();
              await page.waitForTimeout(3000);

              const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 2000 }).catch(() => false);
              if (hasProcessing) {
                console.log('✅ Found processing page from history');

                // Light mode processing
                await setTheme(false);
                await page.screenshot({
                  path: path.join(screenshotsDir, 'processing-screen-light.png'),
                  fullPage: false
                });
                console.log('✅ processing-screen-light.png updated');

                // Dark mode processing
                await setTheme(true);
                await page.screenshot({
                  path: path.join(screenshotsDir, 'processing-screen-dark.png'),
                  fullPage: false
                });
                console.log('✅ processing-screen-dark.png updated');
              }
            }
          }
        } catch (error) {
          console.log('❌ Could not find processing state:', error.message);
        }
      }

      // 3. VERIFY ALL MAIN SCREENSHOTS HAVE BEEN UPDATED
      console.log('\n🔍 Verifying main screenshot files...');
      const mainFiles = [
        'dashboard-screen-light.png',
        'dashboard-screen-dark.png',
        'report-screen-light.png',
        'report-screen-dark.png',
        'processing-screen-light.png',
        'processing-screen-dark.png'
      ];

      const updatedFiles = [];
      const missingFiles = [];

      for (const file of mainFiles) {
        const filePath = path.join(screenshotsDir, file);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          const now = new Date();
          const fileTime = new Date(stats.mtime);
          const isRecent = (now - fileTime) < 60000; // Updated in last minute

          if (isRecent) {
            updatedFiles.push(file);
          } else {
            console.log(`⚠️  ${file} exists but wasn't updated recently`);
          }
        } else {
          missingFiles.push(file);
        }
      }

      console.log(`\n✅ Recently updated files (${updatedFiles.length}):`);
      updatedFiles.forEach(file => console.log(`  📸 ${file}`));

      if (missingFiles.length > 0) {
        console.log(`\n⚠️  Missing files (${missingFiles.length}):`);
        missingFiles.forEach(file => console.log(`  ❌ ${file}`));
      }

    } else {
      console.log('❌ Authentication failed or dashboard not accessible.');
    }

    // Summary
    console.log('\n🎉 MAIN SCREENSHOT UPDATE SUMMARY');
    console.log('==================================');
    const allFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

    console.log('📁 All screenshot files:');
    allFiles.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const now = new Date();
      const fileTime = new Date(stats.mtime);
      const isRecent = (now - fileTime) < 60000; // Updated in last minute
      const prefix = isRecent ? '🆕' : '📄';
      console.log(`  ${prefix} ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

  } catch (error) {
    console.error('❌ Error during screenshot update:', error);
  } finally {
    console.log('\n✨ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🎉 Main screenshot update completed!');
  }
}

console.log('Starting main screenshot update...');
updateMainScreenshots().catch(console.error);