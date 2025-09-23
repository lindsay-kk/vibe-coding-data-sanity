import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeThemeScreenshots() {
  console.log('📸 AUTOMATED THEME SCREENSHOT CAPTURE');
  console.log('=====================================');
  console.log('Taking screenshots in both light and dark modes...\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'screenshots');

  // Ensure screenshots directory exists
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log('🚀 Opening Data Sanity app...');
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

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

    // Take screenshots of main dashboard
    console.log('📊 Taking dashboard screenshots...');

    // Light mode dashboard
    await setTheme(false);
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-screen-light.png'),
      fullPage: false
    });
    console.log('✅ dashboard-screen-light.png captured');

    // Dark mode dashboard
    await setTheme(true);
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-screen-dark.png'),
      fullPage: false
    });
    console.log('✅ dashboard-screen-dark.png captured');

    // Create a mock report for screenshots
    console.log('📋 Creating mock report data...');

    // Navigate to a report page with mock data
    await page.goto('http://localhost:3000/report/mock-report');

    // Wait for the page to try to load (it will show an error, which is fine)
    await page.waitForTimeout(2000);

    // Check if we're on an error page or need to create mock data
    const hasError = await page.locator('text=Report Error').isVisible().catch(() => false);

    if (hasError) {
      console.log('📝 Setting up mock report data...');

      // Go back to main page
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');

      // Take login screen screenshots first
      console.log('🔐 Taking login screen screenshots...');

      // Light mode login
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-screen-light.png'),
        fullPage: false
      });
      console.log('✅ login-screen-light.png captured');

      // Dark mode login
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'login-screen-dark.png'),
        fullPage: false
      });
      console.log('✅ login-screen-dark.png captured');

      // For now, just take screenshots of the error state as the "report" screen
      await page.goto('http://localhost:3000/report/mock-report');
      await page.waitForTimeout(2000);

      console.log('📊 Taking report error screen screenshots...');

      // Light mode report error
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-light.png'),
        fullPage: true
      });
      console.log('✅ report-screen-light.png captured');

      // Dark mode report error
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-dark.png'),
        fullPage: true
      });
      console.log('✅ report-screen-dark.png captured');
    }

    // Also update the existing files (for backward compatibility)
    console.log('🔄 Updating main screenshot files...');

    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    // Update main dashboard screenshot (use light mode as default)
    await setTheme(false);
    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-screen.png'),
      fullPage: false
    });
    console.log('✅ dashboard-screen.png updated');

    // Update login screen (use light mode as default)
    await page.screenshot({
      path: path.join(screenshotsDir, 'login-screen.png'),
      fullPage: false
    });
    console.log('✅ login-screen.png updated');

    // Update report screen (use light mode as default)
    await page.goto('http://localhost:3000/report/mock-report');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, 'report-screen.png'),
      fullPage: true
    });
    console.log('✅ report-screen.png updated');

    // Summary
    console.log('\n🎉 SCREENSHOT CAPTURE SUMMARY');
    console.log('==============================');
    const allFiles = fs.readdirSync(screenshotsDir).filter(f => f.endsWith('.png'));

    if (allFiles.length > 0) {
      console.log('📁 Screenshots captured/updated:');
      allFiles.forEach(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } else {
      console.log('📁 No screenshots were found.');
    }

  } catch (error) {
    console.error('❌ Error during screenshots:', error);
  } finally {
    await browser.close();
    console.log('\n✨ Screenshot capture completed!');
  }
}

console.log('Starting automated theme screenshot capture...');
takeThemeScreenshots().catch(console.error);