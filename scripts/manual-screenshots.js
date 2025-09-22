import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeManualScreenshots() {
  console.log('📸 Taking manual screenshots - browser will stay open for manual navigation');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 2000
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');

    console.log('⏳ Browser is open - please manually navigate to different screens');
    console.log('📋 Instructions:');
    console.log('1. Current page should be login screen - press ENTER to capture it');
    console.log('2. Then authenticate/login and navigate to dashboard - press ENTER to capture');
    console.log('3. Then navigate to a working report page - press ENTER to capture');
    console.log('4. Press ENTER one final time to close');

    // Wait for user input to take login screenshot
    await new Promise(resolve => {
      process.stdout.write('📸 Ready to capture LOGIN screen? Press ENTER...');
      process.stdin.once('data', () => {
        resolve();
      });
    });

    await page.screenshot({
      path: path.join(screenshotsDir, 'login-final.png'),
      fullPage: false
    });
    console.log('✅ login-final.png captured');

    // Wait for user to navigate to dashboard
    await new Promise(resolve => {
      process.stdout.write('📸 Navigate to DASHBOARD, then press ENTER...');
      process.stdin.once('data', () => {
        resolve();
      });
    });

    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-final.png'),
      fullPage: false
    });
    console.log('✅ dashboard-final.png captured');

    // Wait for user to navigate to report
    await new Promise(resolve => {
      process.stdout.write('📸 Navigate to a working REPORT page, then press ENTER...');
      process.stdin.once('data', () => {
        resolve();
      });
    });

    await page.screenshot({
      path: path.join(screenshotsDir, 'report-final.png'),
      fullPage: true
    });
    console.log('✅ report-final.png captured');

    // Processing screen instruction
    await new Promise(resolve => {
      process.stdout.write('📸 If you have a processing screen to capture, navigate to it now, then press ENTER to finish...');
      process.stdin.once('data', () => {
        resolve();
      });
    });

    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-final.png'),
      fullPage: false
    });
    console.log('✅ processing-final.png captured');

    console.log('🎉 Manual screenshot session completed!');

    // List all final screenshots
    const files = fs.readdirSync(screenshotsDir).filter(f => f.includes('final') && f.endsWith('.png'));
    console.log('📁 Final screenshots captured:');
    files.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      console.log(`  - ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

  } catch (error) {
    console.error('❌ Error in manual screenshots:', error);
  } finally {
    await browser.close();
  }
}

takeManualScreenshots().catch(console.error);