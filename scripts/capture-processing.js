import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureProcessingScreen() {
  console.log('📸 Capturing processing screen...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 }
  });

  const page = await context.newPage();

  try {
    // Navigate to the app
    await page.goto('http://localhost:3000');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Check if we need to authenticate (if login form is present)
    const loginPresent = await page.locator('text="Welcome to Data Sanity"').isVisible();
    if (loginPresent) {
      console.log('📋 App requires authentication, but we can use Google Sheets to trigger processing...');

      // Try Google Sheets approach - navigate to a public sheet
      const sheetInput = await page.locator('input[type="url"]');
      if (await sheetInput.isVisible()) {
        await sheetInput.fill('https://docs.google.com/spreadsheets/d/1Mgwdsaey2ck_Be5Vy-RF9Dr3G2XTQ8gphwXStO8JS0s/edit?usp=sharing');
        await page.locator('button:has-text("Analyze Sheet")').click();

        // Wait for OAuth redirect or processing
        await page.waitForTimeout(2000);
        console.log('📸 Taking processing screen during Google Sheets flow...');
      }
    } else {
      // User is logged in, proceed with file upload
      console.log('📤 User authenticated, proceeding with file upload...');

      // Create a test CSV file
      const testCsvContent = 'Name,Age,Email,Department\nJohn Doe,30,john@example.com,Engineering\nJane Smith,25,jane@example.com,Marketing\nBob Johnson,35,bob@example.com,Sales\nAlice Brown,28,alice@example.com,HR\nCharlie Wilson,32,charlie@example.com,Finance';
      const testFilePath = path.join(__dirname, 'test-processing-data.csv');
      fs.writeFileSync(testFilePath, testCsvContent);

      // Find and upload the file
      const fileInput = await page.locator('input[type="file"][accept*=".csv"]');
      if (await fileInput.isVisible()) {
        console.log('📤 Uploading test file...');
        await fileInput.setInputFiles(testFilePath);

        // Wait a moment for the upload to process
        await page.waitForTimeout(1000);

        // Look for processing indicators
        try {
          await page.waitForSelector('text="Processing" | text="processing" | .animate-spin | [data-processing="true"]', { timeout: 3000 });
          console.log('📸 Processing state detected, taking screenshot...');
        } catch {
          console.log('📸 Taking screenshot during upload processing...');
        }

        // Clean up test file
        fs.unlinkSync(testFilePath);
      }
    }

    // Take the processing screenshot
    const screenshotsDir = path.join(__dirname, '..', 'screenshots');
    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-screen.png'),
      fullPage: false
    });
    console.log('✅ processing-screen.png captured');

  } catch (error) {
    console.error('❌ Error capturing processing screen:', error);
  } finally {
    await browser.close();
  }
}

captureProcessingScreen().catch(console.error);