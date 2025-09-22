# Data Sanity App - Setup Guide

This guide will help you set up the Data Sanity app to satisfy all PRD requirements.

## 🔧 Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Google Sheets API (for direct sheet annotation)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Next.js (for internal API calls)
NEXTAUTH_URL=http://localhost:3000
```

## 🗄️ Database Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for the project to be ready

### 2. Run Database Schema
1. Go to your Supabase dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `database/schema.sql`
4. Click **Run** to create all tables and policies

### 3. Configure Storage Buckets
Run this in Supabase SQL Editor:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('datasets', 'datasets', false),
  ('annotated-files', 'annotated-files', false);

-- Storage policies for datasets bucket
CREATE POLICY "Users can upload their own files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
  FOR SELECT USING (bucket_id = 'datasets' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for annotated-files bucket
CREATE POLICY "Users can view their annotated files" ON storage.objects
  FOR SELECT USING (bucket_id = 'annotated-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service can upload annotated files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'annotated-files');
```

## 🔑 API Keys Setup

### Supabase Keys
1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Create an API key
3. Set as `GEMINI_API_KEY`

### Google Sheets API (Optional but Recommended)
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use existing
3. Enable **Google Sheets API**
4. Create a **Service Account**:
   - Go to **IAM & Admin** → **Service Accounts**
   - Click **Create Service Account**
   - Give it a name like "data-sanity-sheets"
   - Skip roles for now
5. Generate a JSON key:
   - Click on your service account
   - Go to **Keys** tab
   - Click **Add Key** → **Create New Key** → **JSON**
6. From the downloaded JSON:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

## 🚀 Deployment Steps

### 1. Local Development
```bash
npm install
npm run dev
```

### 2. Deploy to Vercel
1. Push code to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

### 3. Configure Authentication
1. In Supabase dashboard, go to **Authentication** → **Settings**
2. Add your Vercel domain to **Site URL**
3. Add your domain to **Redirect URLs**

## 🔍 Testing the Setup

### 1. Test File Upload
1. Sign in with Google
2. Upload a CSV/Excel file
3. Check that file appears in Supabase Storage

### 2. Test Processing Pipeline
1. Upload a file with some data issues (missing values, duplicates)
2. Verify report is created with status "processing"
3. Check that AI insights are generated
4. Verify annotated file is created

### 3. Test Google Sheets (if configured)
1. Create a Google Sheet with some data issues
2. Share it with your service account email (view/edit access)
3. Submit the sheet URL in the app
4. Verify the sheet gets annotated with highlights

## 📊 Data Flow Verification

After setup, the complete flow should work:

1. **Upload** → File stored in Supabase Storage → Report record created
2. **Process** → Sanity check runs → Issues detected → AI insights generated
3. **Annotate** → Annotated file created → Download link provided
4. **View** → Report page shows all results with download/view options

## 🐛 Troubleshooting

### Common Issues:

1. **"Unauthorized" errors**: Check Supabase RLS policies are enabled
2. **File upload fails**: Verify storage bucket policies
3. **Processing hangs**: Check Gemini API key and credits
4. **Google Sheets access denied**: Ensure service account has sheet access
5. **Report page not found**: Verify database schema was applied correctly

### Debug Checklist:
- [ ] All environment variables set
- [ ] Database schema applied
- [ ] Storage buckets created with policies
- [ ] Authentication configured
- [ ] API keys valid and have quota

## 🎯 PRD Compliance Achieved

With this setup, the app now satisfies **100%** of PRD requirements:

✅ **Dataset Input**: File upload + Google Sheets URL
✅ **Sanity Check Engine**: All 5 issue types detected
✅ **AI Insights**: Gemini integration with structured output
✅ **Annotated Output**: Excel highlighting + Google Sheets annotation
✅ **Report View**: Complete UI showing all results
✅ **Technical Requirements**: All API endpoints and database schema
✅ **Deployment**: Vercel-ready with proper environment setup