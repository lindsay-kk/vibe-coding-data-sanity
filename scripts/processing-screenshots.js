import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processingScreenshots() {
  console.log('📸 PROCESSING SCREEN SCREENSHOTS');
  console.log('=================================');
  console.log('Attempting to capture processing screens in both themes...\n');

  // Use the same persistent context to maintain authentication
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-themes', {
    headless: false,
    viewport: { width: 1400, height: 1000 },
    args: ['--start-maximized'],
    slowMo: 100
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
      await page.waitForTimeout(300);
    };

    console.log('🚀 Navigating to dashboard...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check if we're authenticated
    const hasUploadCard = await page.locator('text="Upload File"').isVisible({ timeout: 3000 }).catch(() => false);

    if (!hasUploadCard) {
      console.log('⚠️  Not authenticated. Please make sure you\'re logged in first.');
      return;
    }

    console.log('✅ Authenticated dashboard found');

    // Strategy 1: Try to find an existing processing report
    console.log('🔍 Looking for existing processing reports...');

    const processingReportIds = [
      '13db38d3-1f49-4aa0-8992-7397de136c82', // Try the known report ID
      'test-processing',
      'sample-processing'
    ];

    let processingFound = false;

    for (const reportId of processingReportIds) {
      try {
        console.log(`🔍 Checking report: ${reportId}...`);
        await page.goto(`http://localhost:3000/report/${reportId}`);
        await page.waitForTimeout(2000);

        const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 2000 }).catch(() => false);

        if (hasProcessing) {
          console.log(`✅ Found processing state in report: ${reportId}`);
          processingFound = true;

          // Take processing screenshots
          console.log('⚡ Taking processing screen screenshots...');

          // Light mode processing
          await setTheme(false);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-light.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-light.png captured');

          // Dark mode processing
          await setTheme(true);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-dark.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-dark.png captured');

          // Update main processing screenshot (light mode)
          await setTheme(false);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-updated.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-updated.png captured');

          break;
        }
      } catch (error) {
        console.log(`❌ Report ${reportId} not accessible or not processing`);
      }
    }

    if (!processingFound) {
      console.log('⚡ No processing reports found. Attempting to trigger processing...');

      // Strategy 2: Try to trigger processing by uploading a file
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');

      console.log('📂 Attempting to trigger file upload processing...');
      console.log('💡 Instructions:');
      console.log('   1. In the browser that opened, drag and drop a CSV file to the upload area');
      console.log('   2. OR click the upload area and select a CSV file');
      console.log('   3. The processing screen should appear briefly');
      console.log('   4. Come back here and press ENTER when ready, or wait 30 seconds');

      // Set up screenshot monitoring for processing state
      const monitorProcessing = async () => {
        for (let i = 0; i < 30; i++) { // Monitor for 30 seconds
          try {
            const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 1000 }).catch(() => false);
            const hasUploading = await page.locator('text="Processing your data"').isVisible({ timeout: 1000 }).catch(() => false);
            const hasSpinner = await page.locator('.animate-spin').isVisible({ timeout: 1000 }).catch(() => false);

            if (hasProcessing || hasUploading || hasSpinner) {
              console.log('🎯 Processing state detected! Taking screenshots...');

              // Light mode processing
              await setTheme(false);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-light.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-light.png captured');

              // Dark mode processing
              await setTheme(true);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-dark.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-dark.png captured');

              // Update main processing screenshot
              await setTheme(false);
              await page.screenshot({
                path: path.join(screenshotsDir, 'processing-screen-new.png'),
                fullPage: false
              });
              console.log('✅ processing-screen-new.png captured');

              return true;
            }
          } catch (error) {
            // Continue monitoring
          }
          await page.waitForTimeout(1000);
        }
        return false;
      };

      // Start monitoring in background
      const processingCaptured = await monitorProcessing();

      if (!processingCaptured) {
        console.log('⚠️  No processing state detected during monitoring.');
        console.log('💡 Trying to create a mock processing state...');

        // Strategy 3: Try to create a mock processing screen
        await page.goto('http://localhost:3000');
        await page.waitForLoadState('networkidle');

        // Inject mock processing state via JavaScript
        await page.evaluate(() => {
          // Try to find and trigger a processing state
          const uploadButton = document.querySelector('button:has-text("Analyze Sheet")');
          if (uploadButton) {
            // Simulate clicking without actually triggering upload
            uploadButton.style.opacity = '0.5';
            uploadButton.disabled = true;
          }

          // Add a mock processing indicator
          const mockProcessing = document.createElement('div');
          mockProcessing.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 20px; height: 20px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <span>Processing your data...</span>
              </div>
            </div>
            <style>
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          `;
          document.body.appendChild(mockProcessing);

          setTimeout(() => {
            if (mockProcessing.parentNode) {
              mockProcessing.parentNode.removeChild(mockProcessing);
            }
          }, 10000);
        });

        await page.waitForTimeout(1000);

        // Take screenshots of mock processing state
        console.log('📸 Taking mock processing screenshots...');

        // Light mode
        await setTheme(false);
        await page.screenshot({
          path: path.join(screenshotsDir, 'processing-screen-mock-light.png'),
          fullPage: false
        });
        console.log('✅ processing-screen-mock-light.png captured');

        // Dark mode
        await setTheme(true);
        await page.screenshot({
          path: path.join(screenshotsDir, 'processing-screen-mock-dark.png'),
          fullPage: false
        });
        console.log('✅ processing-screen-mock-dark.png captured');
      }
    }

    // Summary
    console.log('\n🎉 PROCESSING SCREENSHOTS SUMMARY');
    console.log('=================================');
    const processingFiles = fs.readdirSync(screenshotsDir).filter(f => f.includes('processing') && f.endsWith('.png'));

    if (processingFiles.length > 0) {
      console.log('📁 Processing screenshots:');
      processingFiles.forEach(file => {
        const stats = fs.statSync(path.join(screenshotsDir, file));
        console.log(`  ⚡ ${file} (${Math.round(stats.size / 1024)}KB)`);
      });
    } else {
      console.log('📁 No processing screenshots captured.');
    }

  } catch (error) {
    console.error('❌ Error during processing screenshots:', error);
  } finally {
    console.log('\n✨ Keeping browser open for 5 seconds...');
    await page.waitForTimeout(5000);
    await browser.close();
    console.log('🎉 Processing screenshot capture completed!');
  }
}

console.log('Starting processing screenshot capture...');
processingScreenshots().catch(console.error);