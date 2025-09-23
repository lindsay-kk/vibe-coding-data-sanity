import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function takeReportScreenshots() {
  console.log('📸 REPORT THEME SCREENSHOT CAPTURE');
  console.log('===================================');
  console.log('Capturing report screens in both light and dark modes...\n');

  const browser = await chromium.launch({
    headless: false, // Keep visible so we can interact if needed
    slowMo: 500,
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

    // First, let's take login screen screenshots
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

    // Update main login screenshot (use light mode)
    await setTheme(false);
    await page.screenshot({
      path: path.join(screenshotsDir, 'login-screen.png'),
      fullPage: false
    });
    console.log('✅ login-screen.png updated');

    // For the report screen, we'll create a mock report page with sample data
    console.log('📊 Setting up mock report page...');

    // Create a mock report data structure
    const mockReportData = {
      report: {
        id: 'mock-report-123',
        status: 'complete',
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString()
      },
      file: {
        id: 'mock-file-123',
        filename: 'sample_data.csv',
        original_filename: 'customer_sales_data.csv',
        file_size: 52428
      },
      issues: {
        id: 'mock-issues-123',
        issues_json: {
          'customer_id': [
            { issue: 'duplicate', row: 45, value: 'CUST_001', details: 'Duplicate customer ID found' },
            { issue: 'duplicate', row: 78, value: 'CUST_001', details: 'Duplicate customer ID found' }
          ],
          'email': [
            { issue: 'missing_value', row: 23, value: '', details: 'Email field is empty' },
            { issue: 'inconsistent_format', row: 67, value: 'invalid.email', details: 'Invalid email format' }
          ],
          'purchase_amount': [
            { issue: 'outlier', row: 102, value: '999999.99', details: 'Unusually high purchase amount' },
            { issue: 'type_mismatch', row: 134, value: 'N/A', details: 'Non-numeric value in amount field' }
          ]
        },
        summary: {
          missing_values: 15,
          duplicates: 8,
          inconsistent_formats: 12,
          outliers: 3,
          type_mismatches: 5,
          total_rows: 1250,
          total_columns: 8
        },
        created_at: new Date().toISOString()
      },
      insights: {
        id: 'mock-insights-123',
        gemini_summary: 'Your dataset contains 1,250 customer records with 8 columns. Overall data quality is good with 96.6% completeness. The main issues are duplicate customer IDs (8 instances) and missing email addresses (15 records). There are also some formatting inconsistencies in email fields and a few outliers in purchase amounts that may need investigation.',
        gemini_recommendations: 'Remove duplicate customer IDs by keeping the most recent record for each customer. Fill missing email addresses through customer outreach or mark as optional. Standardize email format validation. Review outlier purchase amounts to confirm they are legitimate transactions. Consider implementing data validation rules for future uploads.',
        created_at: new Date().toISOString()
      },
      annotations: {
        id: 'mock-annotations-123',
        annotated_file_url: '/downloads/customer_sales_data_annotated.csv',
        annotation_type: 'file',
        created_at: new Date().toISOString()
      }
    };

    // Inject mock data into the page for display
    await page.addInitScript((data) => {
      window.mockReportData = data;
    }, mockReportData);

    // Navigate to a mock report URL
    await page.goto('http://localhost:3000/report/mock-report-123');
    await page.waitForTimeout(2000);

    // If we see an error, inject the data manually
    const hasError = await page.locator('text=Report Error').isVisible().catch(() => false);

    if (hasError) {
      console.log('🔧 Report page showed error, simulating report layout...');

      // Go back to homepage to take authenticated dashboard screenshots first
      await page.goto('http://localhost:3000');
      await page.waitForLoadState('networkidle');

      console.log('🏠 Taking dashboard screenshots...');

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

      // Update main dashboard screenshot (use light mode)
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'dashboard-screen.png'),
        fullPage: false
      });
      console.log('✅ dashboard-screen.png updated');

      // For the report screen error state, take screenshots of that
      console.log('📋 Taking report error screen screenshots...');
      await page.goto('http://localhost:3000/report/non-existent-report');
      await page.waitForTimeout(2000);

      // Light mode report error
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-light.png'),
        fullPage: true
      });
      console.log('✅ report-screen-light.png captured (error state)');

      // Dark mode report error
      await setTheme(true);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen-dark.png'),
        fullPage: true
      });
      console.log('✅ report-screen-dark.png captured (error state)');

      // Update main report screenshot (use light mode)
      await setTheme(false);
      await page.screenshot({
        path: path.join(screenshotsDir, 'report-screen.png'),
        fullPage: true
      });
      console.log('✅ report-screen.png updated (error state)');
    }

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

      console.log('\n🎨 Theme variants captured:');
      const themeFiles = allFiles.filter(f => f.includes('-light') || f.includes('-dark'));
      themeFiles.forEach(file => {
        console.log(`  🌓 ${file}`);
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

console.log('Starting report theme screenshot capture...');
takeReportScreenshots().catch(console.error);