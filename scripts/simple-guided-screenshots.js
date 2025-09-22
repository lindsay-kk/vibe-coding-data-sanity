import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function simpleGuidedScreenshots() {
  console.log('📸 SIMPLE GUIDED SCREENSHOT CAPTURE');
  console.log('====================================');
  console.log('Browser will open and stay open for 10 minutes.');
  console.log('Follow the instructions to take screenshots manually.\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    console.log('🚀 Opening Data Sanity app...');
    await page.goto('http://localhost:3000');

    console.log('\n📋 INSTRUCTIONS:');
    console.log('=================');
    console.log('1. 📸 LOGIN SCREEN: The browser should show your login screen');
    console.log('   → Type "login" in terminal and press ENTER when ready');
    console.log('');
    console.log('2. 🔐 AUTHENTICATE: Click "Continue with Google" and login');
    console.log('   → Type "dashboard" in terminal and press ENTER after login');
    console.log('');
    console.log('3. 📊 REPORT: Navigate to an existing report or create one');
    console.log('   → Type "report" in terminal and press ENTER when viewing report');
    console.log('');
    console.log('4. ⚙️  PROCESSING (optional): Start file upload/processing');
    console.log('   → Type "processing" in terminal and press ENTER during processing');
    console.log('');
    console.log('5. ✅ FINISH: Type "done" to close browser and finish');
    console.log('\nBrowser is now open. Follow the instructions above...\n');

    // Keep browser open and listen for commands
    const waitForCommand = () => {
      return new Promise((resolve) => {
        process.stdin.once('data', (data) => {
          const command = data.toString().trim().toLowerCase();
          resolve(command);
        });
      });
    };

    let finished = false;
    while (!finished) {
      console.log('💬 Waiting for command (login/dashboard/report/processing/done):');
      const command = await waitForCommand();

      switch (command) {
        case 'login':
          await page.screenshot({
            path: path.join(screenshotsDir, 'login-screen-final.png'),
            fullPage: false
          });
          console.log('✅ login-screen-final.png captured');
          break;

        case 'dashboard':
          await page.screenshot({
            path: path.join(screenshotsDir, 'dashboard-final.png'),
            fullPage: false
          });
          console.log('✅ dashboard-final.png captured');
          break;

        case 'report':
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen-final.png'),
            fullPage: true
          });
          console.log('✅ report-screen-final.png captured');
          break;

        case 'processing':
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-final.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-final.png captured');
          break;

        case 'done':
          finished = true;
          console.log('🎉 Screenshot capture completed!');
          break;

        default:
          console.log('❓ Unknown command. Use: login, dashboard, report, processing, or done');
          break;
      }
    }

    // Summary
    console.log('\n🎉 SCREENSHOT CAPTURE SUMMARY');
    console.log('==============================');
    const finalFiles = fs.readdirSync(screenshotsDir).filter(f => f.includes('final') && f.endsWith('.png'));

    if (finalFiles.length > 0) {
      console.log('📁 Screenshots captured:');
      finalFiles.forEach(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } else {
      console.log('📁 No screenshots were captured.');
    }

  } catch (error) {
    console.error('❌ Error during screenshots:', error);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

console.log('Starting simple guided screenshot capture...');
simpleGuidedScreenshots().catch(console.error);