import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function dashboardOnlyScreenshots() {
  console.log('📸 DASHBOARD ONLY SCREENSHOTS');
  console.log('==============================');
  console.log('Taking corrected dashboard screenshots in both themes...\n');

  // Use the same persistent context to maintain authentication
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-themes', {
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
      await page.waitForTimeout(500); // Wait for theme transition
    };

    console.log('🚀 Navigating to dashboard...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify we're on the authenticated dashboard
    const isDashboard = await page.locator('text="Sanity Check Your Data"').isVisible({ timeout: 5000 }).catch(() => false);
    const hasUploadCard = await page.locator('text="Upload File"').isVisible({ timeout: 3000 }).catch(() => false);
    const hasGoogleSheetsCard = await page.locator('text="Google Sheets"').isVisible({ timeout: 3000 }).catch(() => false);

    if (isDashboard && hasUploadCard && hasGoogleSheetsCard) {
      console.log('✅ Confirmed authentic dashboard with upload cards');

      // Light mode dashboard
      console.log('☀️ Taking corrected light mode dashboard screenshot...');
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen-light-corrected.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen-light-corrected.png captured');

      // Dark mode dashboard
      console.log('🌙 Taking corrected dark mode dashboard screenshot...');
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen-dark-corrected.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen-dark-corrected.png captured');

      // Main dashboard screenshot (light mode by default)
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen-corrected.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen-corrected.png captured');

      // Also create the authenticated versions
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-authenticated-screen-corrected.png'),
        fullPage: false
      });
      console.log('✅ dashboard-authenticated-screen-corrected.png captured');

      console.log('\n🎉 CORRECTED DASHBOARD SCREENSHOTS');
      console.log('===================================');
      console.log('📁 New corrected files created:');
      console.log('  🆕 dashboard-screen-light-corrected.png');
      console.log('  🆕 dashboard-screen-dark-corrected.png');
      console.log('  🆕 dashboard-screen-corrected.png');
      console.log('  🆕 dashboard-authenticated-screen-corrected.png');
      console.log('\n📝 You can now replace the wrong ones with these corrected versions!');

    } else {
      console.log('⚠️  Not on the expected dashboard. Current page state:');
      console.log(`   - Has "Sanity Check Your Data": ${isDashboard}`);
      console.log(`   - Has "Upload File": ${hasUploadCard}`);
      console.log(`   - Has "Google Sheets": ${hasGoogleSheetsCard}`);

      // Take screenshots anyway to see what we're looking at
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'current-page-state.png'),
        fullPage: false
      });
      console.log('✅ current-page-state.png captured for debugging');
    }

  } catch (error) {
    console.error('❌ Error during dashboard screenshots:', error);
  } finally {
    console.log('\n✨ Keeping browser open for 3 seconds...');
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('🎉 Dashboard screenshot correction completed!');
  }
}

console.log('Starting dashboard screenshot correction...');
dashboardOnlyScreenshots().catch(console.error);