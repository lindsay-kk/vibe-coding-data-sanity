import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function autoAuthenticatedScreenshots() {
  console.log('📸 AUTO AUTHENTICATED SCREENSHOTS');
  console.log('==================================');
  console.log('Connecting to existing session and taking screenshots...\n');

  // Use the same persistent context as before to maintain authentication
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-themes', {
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

    // Check if we're authenticated (looking for dashboard content)
    const isDashboard = await page.locator('text="Sanity Check Your Data"').isVisible({ timeout: 5000 }).catch(() => false);
    const hasUploadCard = await page.locator('text="Upload File"').isVisible({ timeout: 3000 }).catch(() => false);

    if (isDashboard || hasUploadCard) {
      console.log('✅ Found authenticated dashboard - taking screenshots...');

      // Light mode dashboard
      console.log('☀️ Taking light mode dashboard screenshot...');
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-authenticated-light.png'),
        fullPage: false
      });
      console.log('✅ dashboard-authenticated-light.png captured');

      // Dark mode dashboard
      console.log('🌙 Taking dark mode dashboard screenshot...');
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

      // Also update the main dashboard file
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen.png updated');

    } else {
      console.log('⚠️  Not on dashboard - current page will be captured as-is');

      // Take screenshot of current state anyway
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'current-state-light.png'),
        fullPage: false
      });

      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'current-state-dark.png'),
        fullPage: false
      });
      console.log('✅ Current state screenshots captured');
    }

    // Try to find existing reports
    console.log('📊 Looking for existing reports...');

    // Try a few different approaches to find reports
    const reportIds = [
      '13db38d3-1f49-4aa0-8992-7397de136c82',
      'sample-report',
      'test-report'
    ];

    let reportFound = false;

    for (const reportId of reportIds) {
      try {
        console.log(`🔍 Trying report ID: ${reportId}...`);
        await page.goto(`http://localhost:3000/report/${reportId}`);
        await page.waitForTimeout(3000);

        // Check for various report states
        const hasError = await page.locator('text="Report Error"').isVisible({ timeout: 2000 }).catch(() => false);
        const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 2000 }).catch(() => false);
        const hasReportData = await page.locator('text="Dataset Size"').isVisible({ timeout: 2000 }).catch(() => false);
        const hasAIInsights = await page.locator('text="AI Insights"').isVisible({ timeout: 2000 }).catch(() => false);

        if (!hasError && (hasProcessing || hasReportData || hasAIInsights)) {
          console.log(`✅ Found valid report with ID: ${reportId}`);
          reportFound = true;

          // Take report screenshots in both themes
          console.log('📊 Taking real report screenshots...');

          // Light mode report
          console.log('☀️ Taking light mode report screenshot...');
          await setTheme(false);
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen-real-light.png'),
            fullPage: true
          });
          console.log('✅ report-screen-real-light.png captured');

          // Dark mode report
          console.log('🌙 Taking dark mode report screenshot...');
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

          // Replace the old theme variants
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen-light.png'),
            fullPage: true
          });

          await setTheme(true);
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen-dark.png'),
            fullPage: true
          });
          console.log('✅ Updated report theme variants with real data');

          if (hasProcessing) {
            console.log('⚡ Found processing state - capturing...');
            await setTheme(false);
            await page.screenshot({
              path: path.join(screenshotsDir, 'processing-screen-updated.png'),
              fullPage: false
            });
            console.log('✅ processing-screen-updated.png captured');
          }

          break; // Found a good report, stop trying others
        }
      } catch (error) {
        console.log(`❌ Report ${reportId} not accessible: ${error.message}`);
      }
    }

    if (!reportFound) {
      console.log('⚠️  No valid reports found. Updating error page screenshots...');

      // Make sure we have good error page screenshots with the new theme
      await page.goto('http://localhost:3000/report/non-existent-report');
      await page.waitForTimeout(2000);

      // Light mode error page (with new design)
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-light.png'),
        fullPage: true
      });
      console.log('✅ report-screen-light.png updated (redesigned error page)');

      // Dark mode error page (with new design)
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-dark.png'),
        fullPage: true
      });
      console.log('✅ report-screen-dark.png updated (redesigned error page)');

      // Update main report screenshot
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen.png'),
        fullPage: true
      });
      console.log('✅ report-screen.png updated (redesigned error page)');
    }

    // Summary
    console.log('\n🎉 SCREENSHOT CAPTURE SUMMARY');
    console.log('==============================');
    const allFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

    console.log('📁 All screenshots:');
    allFiles.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      const isNew = file.includes('authenticated') || file.includes('real') || file.includes('updated');
      const prefix = isNew ? '🆕' : '📄';
      console.log(`  ${prefix} ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

    console.log('\n🎨 Theme variants available:');
    const themeFiles = allFiles.filter(f => f.includes('-light') || f.includes('-dark'));
    themeFiles.forEach(file => {
      console.log(`  🌓 ${file}`);
    });

  } catch (error) {
    console.error('❌ Error during screenshots:', error);
  } finally {
    console.log('\n✨ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🎉 Auto screenshot capture completed!');
  }
}

console.log('Starting auto authenticated screenshot capture...');
autoAuthenticatedScreenshots().catch(console.error);