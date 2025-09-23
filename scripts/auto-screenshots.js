import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function autoScreenshots() {
  console.log('📸 AUTOMATED SCREENSHOTS');
  console.log('========================');
  console.log('Taking screenshots automatically...\n');

  // Use persistent context to maintain authentication (same as the comprehensive script)
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

    console.log('🚀 Navigating to app...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check authentication status automatically
    const isLoginPage = await page.locator('text="Welcome to Data Sanity"').isVisible({ timeout: 5000 }).catch(() => false);
    const isDashboard = await page.locator('text="Sanity Check Your Data"').isVisible({ timeout: 5000 }).catch(() => false);

    if (isLoginPage) {
      console.log('🔐 Login page detected - attempting automatic authentication...');

      // Try to click the login button automatically
      try {
        const loginButton = page.locator('button:has-text("Continue with Google")');
        if (await loginButton.isVisible({ timeout: 3000 })) {
          await loginButton.click();
          console.log('⏳ Waiting for authentication to complete...');

          // Wait longer for OAuth flow
          await page.waitForTimeout(10000);

          // Check if we're redirected back
          await page.waitForLoadState('networkidle');
        }
      } catch (error) {
        console.log('⚠️  Could not click login automatically:', error.message);
      }

      // Check again after potential authentication
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    // Verify we're authenticated now
    const finalDashboardCheck = await page.locator('text="Sanity Check Your Data"').isVisible({ timeout: 5000 }).catch(() => false);

    if (finalDashboardCheck) {
      console.log('✅ Successfully authenticated - taking screenshots...');

      // 1. DASHBOARD SCREENSHOTS
      console.log('📱 Taking dashboard screenshots...');

      // Light mode dashboard
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-authenticated-light.png'),
        fullPage: false
      });
      console.log('✅ dashboard-authenticated-light.png captured');

      // Dark mode dashboard
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-authenticated-dark.png'),
        fullPage: false
      });
      console.log('✅ dashboard-authenticated-dark.png captured');

      // Update main dashboard screenshot (light mode)
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-authenticated-screen.png'),
        fullPage: false
      });
      console.log('✅ dashboard-authenticated-screen.png updated');

      // 2. REPORTS HISTORY PAGE SCREENSHOTS
      console.log('📋 Taking reports history screenshots...');

      try {
        await page.goto('http://localhost:3000/history');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Light mode history
        await setTheme(false);
        await page.screenshot({
          path: path.join(screenshotsDir, 'reports-history-light.png'),
          fullPage: true
        });
        console.log('✅ reports-history-light.png captured');

        // Dark mode history
        await setTheme(true);
        await page.screenshot({
          path: path.join(screenshotsDir, 'reports-history-dark.png'),
          fullPage: true
        });
        console.log('✅ reports-history-dark.png captured');

        // Main history screenshot (light mode)
        await setTheme(false);
        await page.screenshot({
          path: path.join(screenshotsDir, 'reports-history.png'),
          fullPage: true
        });
        console.log('✅ reports-history.png captured');

      } catch (error) {
        console.log('⚠️  Could not capture history page:', error.message);
      }

      // 3. REPORT PAGE SCREENSHOTS
      console.log('📊 Attempting to navigate to report...');

      // Try a few different report IDs that might exist
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

            // Take report screenshots
            console.log('📊 Taking report screenshots...');

            // Light mode report
            await setTheme(false);
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-screen-real-light.png'),
              fullPage: true
            });
            console.log('✅ report-screen-real-light.png captured');

            // Dark mode report
            await setTheme(true);
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-screen-real-dark.png'),
              fullPage: true
            });
            console.log('✅ report-screen-real-dark.png captured');

            // Update main report screenshot (light mode)
            await setTheme(false);
            await page.screenshot({
              path: path.join(screenshotsDir, 'report-screen.png'),
              fullPage: true
            });
            console.log('✅ report-screen.png updated with real data');

            if (hasProcessing) {
              console.log('⚡ Found processing state - capturing...');
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-new.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-new.png captured');
            }

            break;
          }
        } catch (error) {
          console.log(`❌ Report ${reportId} not accessible: ${error.message}`);
        }
      }

      if (!reportFound) {
        console.log('⚠️  No valid reports found. Using error page screenshots...');

        // Go to error page for screenshots
        await page.goto('http://localhost:3000/report/non-existent-report');
        await page.waitForTimeout(2000);

        // Light mode error page
        await setTheme(false);
        await page.screenshot({
          path: path.join(screenshotsDir, 'report-screen-error-light.png'),
          fullPage: true
        });
        console.log('✅ report-screen-error-light.png captured');

        // Dark mode error page
        await setTheme(true);
        await page.screenshot({
          path: path.join(screenshotsDir, 'report-screen-error-dark.png'),
          fullPage: true
        });
        console.log('✅ report-screen-error-dark.png captured');
      }

    } else {
      console.log('⚠️  Authentication failed or dashboard not accessible.');
      console.log('📸 Taking unauthenticated screenshots instead...');

      // Take login page screenshots
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-page-light.png'),
        fullPage: false
      });
      console.log('✅ login-page-light.png captured');

      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-page-dark.png'),
        fullPage: false
      });
      console.log('✅ login-page-dark.png captured');
    }

    // Summary
    console.log('\n🎉 AUTOMATED SCREENSHOT CAPTURE SUMMARY');
    console.log('=======================================');
    const allFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

    console.log('📁 All screenshots:');
    allFiles.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const isNew = file.includes('history') || file.includes('authenticated') || file.includes('real');
      const prefix = isNew ? '🆕' : '📄';
      console.log(`  ${prefix} ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

    console.log('\n🎨 Theme variants captured:');
    const themeFiles = allFiles.filter(f => f.includes('-light') || f.includes('-dark'));
    themeFiles.forEach(file => {
      console.log(`  🌓 ${file}`);
    });

    console.log('\n📋 Page types captured:');
    console.log('  📱 Dashboard (light & dark)');
    console.log('  📋 Reports History (light & dark)');
    console.log('  📊 Report Page (light & dark)');

  } catch (error) {
    console.error('❌ Error during screenshots:', error);
  } finally {
    console.log('\n✨ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🎉 Automated screenshot capture completed!');
  }
}

console.log('Starting automated screenshot capture...');
autoScreenshots().catch(console.error);