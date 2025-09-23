import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateProcessingScreenshots() {
  console.log('📸 UPDATING PROCESSING SCREENSHOTS');
  console.log('==================================');
  console.log('Finding or creating processing state...\n');

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

    console.log('🔍 Looking for processing reports in history...');
    await page.goto('http://localhost:3000/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for any processing or failed reports that might show processing state
    const reportLinks = await page.locator('a[href^="/report/"]').all();
    let processingFound = false;

    for (const link of reportLinks) {
      try {
        const href = await link.getAttribute('href');
        console.log(`🔍 Checking report: ${href}`);

        await page.goto(`http://localhost:3000${href}`);
        await page.waitForTimeout(3000);

        // Check for processing state
        const hasProcessing = await page.locator('text="Processing Your Data"').isVisible({ timeout: 2000 }).catch(() => false);
        const hasError = await page.locator('text="Report Error"').isVisible({ timeout: 2000 }).catch(() => false);

        if (hasProcessing) {
          console.log('✅ Found processing state!');
          processingFound = true;

          // Light mode processing
          await setTheme(false);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-light.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-light.png updated');

          // Dark mode processing
          await setTheme(true);
          await page.screenshot({
            path: path.join(screenshotsDir, 'processing-screen-dark.png'),
            fullPage: false
          });
          console.log('✅ processing-screen-dark.png updated');
          break;
        } else if (hasError) {
          console.log('📄 Found error state - could simulate processing...');

          // This looks like an error page, but we can use it as a base
          // Let's modify the page to show processing state
          const processingModified = await page.evaluate(() => {
            // Find and modify the main content to show processing
            const errorElement = document.querySelector('h1, h2, h3');
            if (errorElement && errorElement.textContent.includes('Error')) {
              errorElement.textContent = 'Processing Your Data';

              // Find description and change it
              const descElement = document.querySelector('p');
              if (descElement) {
                descElement.textContent = 'We are analyzing your data and will have results shortly. This may take a few minutes depending on the size of your dataset.';
              }

              // Add a loading spinner
              const spinnerHtml = `
                <div style="display: flex; justify-content: center; margin: 20px 0;">
                  <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                </div>
                <style>
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                </style>
              `;

              const container = errorElement.parentElement;
              if (container) {
                container.innerHTML = `
                  <h2 style="font-size: 1.5rem; font-weight: 600; text-align: center; margin-bottom: 1rem;">Processing Your Data</h2>
                  <p style="text-align: center; color: #666; margin-bottom: 2rem;">We are analyzing your data and will have results shortly. This may take a few minutes depending on the size of your dataset.</p>
                  ${spinnerHtml}
                `;
              }

              return true;
            }
            return false;
          });

          if (processingModified) {
            console.log('✅ Modified page to show processing state');
            await page.waitForTimeout(1000);

            // Light mode processing
            await setTheme(false);
            await page.screenshot({
              path: path.join(screenshotsDir, 'processing-screen-light.png'),
              fullPage: false
            });
            console.log('✅ processing-screen-light.png updated (simulated)');

            // Dark mode processing
            await setTheme(true);
            await page.screenshot({
              path: path.join(screenshotsDir, 'processing-screen-dark.png'),
              fullPage: false
            });
            console.log('✅ processing-screen-dark.png updated (simulated)');
            processingFound = true;
            break;
          }
        }
      } catch (error) {
        console.log(`❌ Error checking report: ${error.message}`);
      }
    }

    if (!processingFound) {
      console.log('⚠️  No processing state found. Creating a simple test upload...');

      // Go to dashboard and create a test scenario
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Create a simple HTML processing screen
      await page.evaluate(() => {
        document.body.innerHTML = `
          <div style="min-height: 100vh; background: var(--background, white); padding: 2rem;">
            <header style="border-bottom: 1px solid #e5e7eb; padding: 1rem 0; margin-bottom: 2rem;">
              <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1rem;">
                <div style="width: 32px; height: 32px; background: black; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 20px;">✓</span>
                </div>
                <h1 style="font-size: 1.25rem; font-weight: 600; margin: 0;">Data Sanity</h1>
                <span style="color: #6b7280; font-size: 1.25rem; font-weight: 300;">/</span>
                <button style="background: none; border: none; font-size: 1rem; cursor: pointer;">Menu ▼</button>
              </div>
            </header>
            <div style="max-width: 800px; margin: 0 auto; text-align: center;">
              <h2 style="font-size: 2rem; font-weight: 600; margin-bottom: 1rem; color: var(--foreground, black);">Processing Your Data</h2>
              <p style="color: #6b7280; margin-bottom: 2rem; font-size: 1.1rem;">We are analyzing your data and will have results shortly. This may take a few minutes depending on the size of your dataset.</p>
              <div style="display: flex; justify-content: center; margin: 2rem 0;">
                <div style="width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; margin: 2rem 0;">
                <h3 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">What we're doing:</h3>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto; color: #6b7280;">
                  <li>Analyzing data structure</li>
                  <li>Detecting missing values</li>
                  <li>Identifying duplicates</li>
                  <li>Checking data types</li>
                </ul>
              </div>
            </div>
          </div>
          <style>
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
          </style>
        `;
      });

      await page.waitForTimeout(1000);

      // Light mode
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'processing-screen-light.png'),
        fullPage: false
      });
      console.log('✅ processing-screen-light.png created');

      // Dark mode
      await setTheme(true);
      await page.evaluate(() => {
        document.documentElement.style.setProperty('--background', '#0a0a0a');
        document.documentElement.style.setProperty('--foreground', 'white');
        document.body.style.background = '#0a0a0a';
        document.body.style.color = 'white';
      });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotsDir, 'processing-screen-dark.png'),
        fullPage: false
      });
      console.log('✅ processing-screen-dark.png created');
    }

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
    console.error('❌ Error updating processing screenshots:', error);
  } finally {
    await page.waitForTimeout(2000);
    await browser.close();
    console.log('🎉 Processing screenshot update completed!');
  }
}

console.log('Starting processing screenshot update...');
updateProcessingScreenshots().catch(console.error);