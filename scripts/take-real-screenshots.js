import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeRealScreenshots() {
  console.log('📸 Taking real screenshots from the actual Data Sanity app...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots');

  try {
    // 1. First, verify login screen is correct (it already looks good)
    console.log('📸 Taking login screen screenshot...');
    await page.goto('http://localhost:3000');
    await page.waitForSelector('text="Welcome to Data Sanity"', { timeout: 10000 });
    await page.screenshot({
      path: path.join(screenshotsDir, 'login-screen.png'),
      fullPage: false
    });
    console.log('✅ login-screen.png captured (verified correct)');

    // 2. Now let's manually trigger the OAuth flow and get to dashboard
    console.log('📸 Attempting to reach dashboard...');
    console.log('⚠️  Manual step required: Please click "Continue with Google" and complete OAuth');
    console.log('⏳ Waiting 30 seconds for manual OAuth completion...');

    // Wait for user to manually complete OAuth
    await page.waitForTimeout(30000);

    // Check if we're on the dashboard now
    try {
      await page.waitForSelector('text="Sanity Check Your Data"', { timeout: 5000 });
      console.log('📸 Taking dashboard screenshot...');
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard.png'),
        fullPage: false
      });
      console.log('✅ dashboard.png captured');

      // 3. Now let's trigger actual processing by uploading a real file
      console.log('📸 Creating test file and triggering processing...');

      // Create a realistic test CSV
      const testCsvContent = `Name,Age,Email,Department,Salary,Join_Date
John Doe,30,john.doe@company.com,Engineering,75000,2023-01-15
Jane Smith,25,jane.smith@company.com,Marketing,65000,2023-03-20
Bob Johnson,35,,Sales,80000,2023-02-10
Alice Brown,28,alice.brown@company.com,HR,70000,
Charlie Wilson,32,charlie@company.com,Finance,85000,2023-01-30
David Lee,,david.lee@company.com,Engineering,78000,2023-04-05
Sarah Davis,29,sarah.davis@company.com,Marketing,,2023-02-28
Mike Taylor,45,mike.taylor@company.com,Sales,90000,2023-01-20
Lisa Anderson,33,lisa.anderson@company.com,HR,72000,2023-03-15
Tom Brown,31,tom.brown@company.com,Finance,83000,2023-02-01`;

      const testFilePath = path.join(__dirname, 'test-data-realistic.csv');
      fs.writeFileSync(testFilePath, testCsvContent);

      // Upload the file
      const fileInput = await page.locator('input[type="file"][accept*=".csv"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for navigation to report page
      await page.waitForURL('**/report/**', { timeout: 30000 });
      console.log('📸 Navigated to report page, taking processing screenshot...');

      // Take processing screenshot
      await page.screenshot({
        path: path.join(screenshotsDir, 'processing-screen.png'),
        fullPage: false
      });
      console.log('✅ processing-screen.png captured');

      // Wait for processing to complete
      console.log('⏳ Waiting for processing to complete...');
      await page.waitForTimeout(15000); // Wait for AI processing

      // 4. Take final report screenshot
      console.log('📸 Taking final report screenshot...');
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen.png'),
        fullPage: true // Full page to show the complete report
      });
      console.log('✅ report-screen.png captured');

      // Clean up test file
      fs.unlinkSync(testFilePath);

    } catch (error) {
      console.log('⚠️  Could not reach dashboard - OAuth might not be completed');
      console.log('🔄 Trying alternative approach with Google Sheets...');

      // Alternative: Use Google Sheets to get to a report
      await page.goto('http://localhost:3000');

      // Try to find an existing report in the server logs
      console.log('📋 Looking for existing reports from server logs...');

      // Navigate to a known report URL from the server logs
      const reportUrls = [
        'http://localhost:3000/report/13db38d3-1f49-4aa0-8992-7397de136c82',
        'http://localhost:3000/report/8e7c2811-a018-49fb-b486-664529efc9a2',
        'http://localhost:3000/report/5b41b0ba-560c-4685-b7c8-7efd774ea978'
      ];

      for (const url of reportUrls) {
        try {
          await page.goto(url);
          await page.waitForSelector('h1', { timeout: 5000 });

          console.log('📸 Taking report screenshot from existing report...');
          await page.screenshot({
            path: path.join(screenshotsDir, 'report-screen.png'),
            fullPage: true
          });
          console.log('✅ report-screen.png captured from existing report');
          break;
        } catch {
          console.log(`⚠️  Report ${url} not accessible, trying next...`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error taking screenshots:', error);
  } finally {
    console.log('🎉 Screenshot session completed');
    console.log('📁 Check the screenshots directory for results');
    await browser.close();
  }
}

takeRealScreenshots().catch(console.error);