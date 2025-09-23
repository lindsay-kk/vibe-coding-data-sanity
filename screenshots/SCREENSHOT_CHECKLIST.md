# Screenshot Checklist for Data Sanity App

## Required Screenshots for README.md

### 1. Login Screen
- **File**: `login-screen.png`
- **URL**: `http://localhost:3000` (logged out)
- **Description**: Clean shadcn login interface with Google OAuth
- **Key Elements**:
  - Data Sanity logo (black icon)
  - "Welcome to Data Sanity" heading
  - Google login button
  - Professional grayish-black theme

### 2. Main Dashboard
- **File**: `dashboard.png`
- **URL**: `http://localhost:3000` (after login)
- **Description**: Main upload interface with dual input methods
- **Key Elements**:
  - Header with Data Sanity logo and user email
  - File upload card with drag-and-drop area
  - Google Sheets URL input card
  - "What We Check" features section
  - Consistent shadcn Card components

### 3. Processing Screen
- **File**: `processing-screen.png`
- **URL**: During file processing
- **Description**: Real-time processing status
- **Key Elements**:
  - Processing spinner/loader
  - "Processing your data..." message
  - Status indicators
  - Loading overlay

### 4. Report Screen
- **File**: `report-screen.png`
- **URL**: `/report/[reportId]` (after processing complete)
- **Description**: Comprehensive report dashboard
- **Key Elements**:
  - Grayish-black gradient background
  - Report header with file name and status
  - Statistics cards (dataset size, missing values, duplicates, etc.)
  - AI Insights section with summary and recommendations
  - Issues breakdown by column
  - Download/view buttons for annotated output

### 5. Additional Screenshots (Optional)
- **File**: `features-section.png` - Close-up of "What We Check" cards
- **File**: `ai-insights.png` - Close-up of AI insights section
- **File**: `issues-breakdown.png` - Close-up of issues by column

## Screenshot Guidelines

### Technical Requirements:
- **Format**: PNG (for transparency support)
- **Resolution**: Minimum 1200px width for clarity
- **Browser**: Chrome/Safari for consistent rendering
- **Device**: Desktop view (responsive design)

### Composition Tips:
- Capture full viewport or relevant sections
- Ensure good contrast and readability
- Show real data/examples where possible
- Highlight key UI elements and functionality

### File Naming Convention:
- Use kebab-case (lowercase with hyphens)
- Be descriptive but concise
- Match the filenames listed above

## How to Take Screenshots:

### macOS:
- **Full Screen**: `Cmd + Shift + 3`
- **Selected Area**: `Cmd + Shift + 4`
- **Specific Window**: `Cmd + Shift + 4`, then `Space`, then click window

### Browser DevTools:
1. Open DevTools (`F12` or `Cmd+Option+I`)
2. Toggle device toolbar (`Cmd+Shift+M`)
3. Select device size or custom dimensions
4. Right-click → "Capture screenshot"

## Checklist Status:
- [x] login-screen.png ✅ COMPLETED
- [x] dashboard.png ✅ COMPLETED
- [x] processing-screen.png ✅ COMPLETED
- [x] report-screen.png ✅ COMPLETED
- [ ] features-section.png (optional)
- [ ] ai-insights.png (optional)
- [ ] issues-breakdown.png (optional)

## Next Steps:
1. Take screenshots following this checklist
2. Save them in the `/screenshots` directory
3. Update README.md with screenshot references
4. Commit and push to GitHub

---

*This checklist ensures comprehensive visual documentation of the Data Sanity platform for the README.md file.*