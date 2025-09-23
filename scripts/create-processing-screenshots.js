import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createProcessingScreenshots() {
  console.log('📸 CREATING PROCESSING SCREENSHOTS');
  console.log('==================================');
  console.log('Creating processing screens with navigation menu...\n');

  // Use persistent context to maintain authentication
  const browser = await chromium.launchPersistentContext('/tmp/playwright-user-data-comprehensive', {
    headless: false,
    viewport: { width: 1400, height: 1000 },
    args: ['--start-maximized'],
    slowMo: 500
  });

  const page = await browser.pages()[0] || await browser.newPage();
  const screenshotsDir = path.join(__dirname, '..', 'screenshots', 'screenshots');

  try {
    console.log('🎨 Creating processing page with navigation menu...');

    // Go to any page first
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Create a complete processing page with proper styling
    await page.evaluate(() => {
      document.documentElement.className = '';
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <!-- Header with Navigation -->
          <header style="border-bottom: 1px solid #e5e7eb; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(8px);">
            <div style="max-width: 1200px; margin: 0 auto; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 32px; height: 32px; background: black; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                </div>
                <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0; color: #000;">Data Sanity</h1>
                <span style="color: #6b7280; font-size: 1.25rem; font-weight: 300;">/</span>
                <div style="position: relative;">
                  <button style="background: none; border: none; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; color: #374151;">
                    Menu
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6,9 12,15 18,9"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <!-- Main Content -->
          <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem;">
            <div style="max-width: 600px; text-align: center;">
              <h2 style="font-size: 2rem; font-weight: 600; margin-bottom: 1rem; color: #111827;">Processing Your Data</h2>
              <p style="color: #6b7280; margin-bottom: 2rem; font-size: 1.1rem; line-height: 1.6;">
                We are analyzing your data and will have results shortly. This may take a few minutes depending on the size of your dataset.
              </p>

              <!-- Loading Spinner -->
              <div style="display: flex; justify-content: center; margin: 2rem 0;">
                <div style="width: 40px; height: 40px; border: 4px solid #f3f4f6; border-top: 4px solid #3b82f6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              </div>

              <!-- Progress Info -->
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; text-align: left;">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: #111827;">What we're analyzing:</h3>
                <ul style="margin: 0; padding-left: 1.5rem; color: #6b7280; line-height: 1.8;">
                  <li>Data structure and format validation</li>
                  <li>Missing values detection and analysis</li>
                  <li>Duplicate records identification</li>
                  <li>Data type consistency checks</li>
                  <li>Statistical outlier detection</li>
                </ul>
              </div>

              <!-- Estimated Time -->
              <div style="background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 1rem; color: #1e40af;">
                <strong>Estimated completion:</strong> 2-5 minutes
              </div>
            </div>
          </main>
        </div>

        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: #ffffff; }
        </style>
      `;
    });

    await page.waitForTimeout(1000);

    // Light mode processing
    console.log('📸 Taking light mode processing screenshot...');
    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-screen-light.png'),
      fullPage: false
    });
    console.log('✅ processing-screen-light.png updated');

    // Dark mode processing
    console.log('📸 Taking dark mode processing screenshot...');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
      document.body.innerHTML = `
        <div style="min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #ffffff;">
          <!-- Header with Navigation -->
          <header style="border-bottom: 1px solid #374151; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(8px);">
            <div style="max-width: 1200px; margin: 0 auto; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 1rem;">
                <div style="width: 32px; height: 32px; background: black; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                </div>
                <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0; color: #ffffff;">Data Sanity</h1>
                <span style="color: #9ca3af; font-size: 1.25rem; font-weight: 300;">/</span>
                <div style="position: relative;">
                  <button style="background: none; border: none; font-size: 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem; color: #d1d5db;">
                    Menu
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6,9 12,15 18,9"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </header>

          <!-- Main Content -->
          <main style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem;">
            <div style="max-width: 600px; text-align: center;">
              <h2 style="font-size: 2rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">Processing Your Data</h2>
              <p style="color: #9ca3af; margin-bottom: 2rem; font-size: 1.1rem; line-height: 1.6;">
                We are analyzing your data and will have results shortly. This may take a few minutes depending on the size of your dataset.
              </p>

              <!-- Loading Spinner -->
              <div style="display: flex; justify-content: center; margin: 2rem 0;">
                <div style="width: 40px; height: 40px; border: 4px solid #374151; border-top: 4px solid #60a5fa; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              </div>

              <!-- Progress Info -->
              <div style="background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 1.5rem; margin: 2rem 0; text-align: left;">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 1rem; color: #ffffff;">What we're analyzing:</h3>
                <ul style="margin: 0; padding-left: 1.5rem; color: #9ca3af; line-height: 1.8;">
                  <li>Data structure and format validation</li>
                  <li>Missing values detection and analysis</li>
                  <li>Duplicate records identification</li>
                  <li>Data type consistency checks</li>
                  <li>Statistical outlier detection</li>
                </ul>
              </div>

              <!-- Estimated Time -->
              <div style="background: #1e3a8a; border: 1px solid #3b82f6; border-radius: 8px; padding: 1rem; color: #dbeafe;">
                <strong>Estimated completion:</strong> 2-5 minutes
              </div>
            </div>
          </main>
        </div>

        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          * { box-sizing: border-box; }
          body { margin: 0; background: #0a0a0a; }
        </style>
      `;
    });

    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(screenshotsDir, 'processing-screen-dark.png'),
      fullPage: false
    });
    console.log('✅ processing-screen-dark.png updated');

    console.log('\n🎉 PROCESSING SCREENSHOT UPDATE COMPLETE');
    console.log('=========================================');

    // Verify the files
    const files = ['processing-screen-light.png', 'processing-screen-dark.png'];
    for (const file of files) {
      const filePath = path.join(screenshotsDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ ${file} (${Math.round(stats.size / 1024)}KB)`);
      } else {
        console.log(`❌ ${file} - missing`);
      }
    }

  } catch (error) {
    console.error('❌ Error creating processing screenshots:', error);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
    console.log('🎉 Processing screenshot creation completed!');
  }
}

console.log('Starting processing screenshot creation...');
createProcessingScreenshots().catch(console.error);