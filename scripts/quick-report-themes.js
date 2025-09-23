import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function quickReportThemes() {
  console.log('📸 QUICK REPORT THEME SCREENSHOTS');
  console.log('==================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
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

    console.log('🚀 Opening report error page...');

    // Navigate directly to a non-existent report to trigger the redesigned error state
    await page.goto('http://localhost:3000/report/non-existent-report-id');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take light mode report error screenshot
    console.log('☀️ Taking light mode report screenshot...');
    await setTheme(false);
    await page.screenshot({
      path: path.join(screenshotsDir, 'report-screen-light.png'),
      fullPage: true
    });
    console.log('✅ report-screen-light.png captured');

    // Take dark mode report error screenshot
    console.log('🌙 Taking dark mode report screenshot...');
    await setTheme(true);
    await page.screenshot({
      path: path.join(screenshotsDir, 'report-screen-dark.png'),
      fullPage: true
    });
    console.log('✅ report-screen-dark.png captured');

    // Update main report screenshot (light mode)
    await setTheme(false);
    await page.screenshot({
      path: path.join(screenshotsDir, 'report-screen.png'),
      fullPage: true
    });
    console.log('✅ report-screen.png updated');

    console.log('\n🎉 Report theme screenshots completed!');
    console.log('Files created:');
    console.log('  🌓 report-screen-light.png');
    console.log('  🌓 report-screen-dark.png');
    console.log('  📄 report-screen.png (updated)');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await browser.close();
  }
}

quickReportThemes().catch(console.error);