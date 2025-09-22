import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askUser(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function guidedScreenshots() {
  console.log('📸 GUIDED SCREENSHOT CAPTURE');
  console.log('=============================');
  console.log('This will open your browser and guide you through taking screenshots');
  console.log('of your Data Sanity app after authentication.\n');

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
    // Step 1: Navigate to app
    console.log('🚀 Opening Data Sanity app...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    console.log('\n📋 STEP 1: LOGIN SCREEN');
    console.log('Your browser should now show the Data Sanity login screen.');
    await askUser('Press ENTER when you can see the login screen...');

    await page.screenshot({
      path: path.join(screenshotsDir, 'login-screen-final.png'),
      fullPage: false
    });
    console.log('✅ login-screen-final.png captured\n');

    // Step 2: Authentication
    console.log('📋 STEP 2: AUTHENTICATION');
    console.log('Please click "Continue with Google" and complete the authentication.');
    console.log('After logging in, you should see the main dashboard with:');
    console.log('- "Sanity Check Your Data" heading');
    console.log('- File upload card on the left');
    console.log('- Google Sheets card on the right');
    await askUser('Press ENTER when you can see the dashboard after logging in...');

    await page.screenshot({
      path: path.join(screenshotsDir, 'dashboard-final.png'),
      fullPage: false
    });
    console.log('✅ dashboard-final.png captured\n');

    // Step 3: Report screen
    console.log('📋 STEP 3: REPORT SCREEN');
    console.log('Now we need to capture a report screen. You have two options:');
    console.log('a) Upload a file and wait for processing to complete');
    console.log('b) Navigate directly to an existing report');
    console.log('\nI recommend option B - let me navigate to an existing report...');

    await askUser('Press ENTER to navigate to an existing report...');

    // Try to navigate to a working report from the logs
    const reportIds = [
      '13db38d3-1f49-4aa0-8992-7397de136c82',
      '8e7c2811-a018-49fb-b486-664529efc9a2',
      'cb17998e-66a7-45eb-a5fe-961d328d37b5'
    ];

    let reportFound = false;
    for (const reportId of reportIds) {
      try {
        console.log(`🔍 Trying report: ${reportId}...`);
        await page.goto(`http://localhost:3000/report/${reportId}`);
        await page.waitForTimeout(3000);

        // Check if we can find report content
        const hasReportContent = await page.locator('text="Data Sanity Report", text="AI Insights", text="Statistics", h1, .report').first().isVisible({ timeout: 3000 });

        if (hasReportContent) {
          console.log('✅ Found working report!');
          reportFound = true;
          break;
        } else {
          console.log('⚠️  Report not ready, trying next...');
        }
      } catch (error) {
        console.log(`⚠️  Report ${reportId} failed: ${error.message}`);
      }
    }

    if (!reportFound) {
      console.log('\n🤔 No existing reports found. Let\'s create one:');
      console.log('1. Navigate back to the dashboard');
      console.log('2. Upload a CSV file or use Google Sheets');
      console.log('3. Wait for processing to complete');
      await askUser('Press ENTER when you have a working report page open...');
    } else {
      await askUser('Press ENTER when the report page has fully loaded...');
    }

    await page.screenshot({
      path: path.join(screenshotsDir, 'report-screen-final.png'),
      fullPage: true
    });
    console.log('✅ report-screen-final.png captured\n');

    // Step 4: Processing screen (optional)
    console.log('📋 STEP 4: PROCESSING SCREEN (OPTIONAL)');
    console.log('If you want to capture a processing screen:');
    console.log('1. Go back to dashboard');
    console.log('2. Upload a file or paste a Google Sheets URL');
    console.log('3. While it\'s processing, we\'ll take a screenshot');
    console.log('\nOtherwise, we can skip this step.');

    const wantProcessing = await askUser('Do you want to capture a processing screen? (y/n): ');

    if (wantProcessing.toLowerCase() === 'y' || wantProcessing.toLowerCase() === 'yes') {
      console.log('🔄 Please start the processing (upload file or Google Sheet)...');
      await askUser('Press ENTER when you see the processing/loading state...');

      await page.screenshot({
        path: path.join(screenshotsDir, 'processing-screen-final.png'),
        fullPage: false
      });
      console.log('✅ processing-screen-final.png captured\n');
    } else {
      console.log('⏭️  Skipping processing screen\n');
    }

    // Summary
    console.log('🎉 SCREENSHOT CAPTURE COMPLETED!');
    console.log('==================================');

    const finalFiles = fs.readdirSync(screenshotsDir).filter(f => f.includes('final') && f.endsWith('.png'));
    console.log('📁 Final screenshots captured:');
    finalFiles.forEach(file => {
      const stats = fs.statSync(path.join(screenshotsDir, file));
      console.log(`  ✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
    });

    console.log('\n📋 You can now use these screenshots in your README.md!');
    console.log('The files are saved in the /screenshots directory.');

  } catch (error) {
    console.error('❌ Error during guided screenshots:', error);
  } finally {
    rl.close();
    await browser.close();
  }
}

console.log('Starting guided screenshot capture...');
guidedScreenshots().catch(console.error);