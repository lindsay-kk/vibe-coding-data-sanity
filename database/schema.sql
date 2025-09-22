-- Data Sanity App - Supabase Database Schema
-- Run this in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
-- Note: Supabase auth.users already exists, so we create a profiles table for additional user data
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  storage_path TEXT, -- For uploaded files
  google_sheet_url TEXT, -- For Google Sheets
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  file_id UUID REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT CHECK (status IN ('processing', 'complete', 'failed')) DEFAULT 'processing',
  google_sheet_url TEXT, -- Copy from files for quick access
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Issues table (stores sanity check results)
CREATE TABLE IF NOT EXISTS issues (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  issues_json JSONB NOT NULL, -- Stores the complete sanity report columns
  summary JSONB NOT NULL, -- Stores the summary statistics
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insights table (stores AI-generated insights)
CREATE TABLE IF NOT EXISTS insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  gemini_summary TEXT,
  gemini_recommendations TEXT,
  gemini_raw JSONB, -- Stores raw Gemini response and metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Annotations table (stores annotated file/sheet information)
CREATE TABLE IF NOT EXISTS annotations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE NOT NULL,
  annotated_file_url TEXT, -- For downloadable annotated files
  google_sheet_url TEXT, -- For annotated Google Sheets
  annotation_type TEXT CHECK (annotation_type IN ('file', 'google_sheet')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_created_at ON files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_report_id ON issues(report_id);
CREATE INDEX IF NOT EXISTS idx_insights_report_id ON insights(report_id);
CREATE INDEX IF NOT EXISTS idx_annotations_report_id ON annotations(report_id);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Files policies
CREATE POLICY "Users can view own files" ON files
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files" ON files
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files" ON files
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files" ON files
  FOR DELETE USING (auth.uid() = user_id);

-- Reports policies
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);

-- Issues policies
CREATE POLICY "Users can view issues for own reports" ON issues
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = issues.report_id
      AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert issues" ON issues
  FOR INSERT WITH CHECK (true); -- Allow service role to insert

-- Insights policies
CREATE POLICY "Users can view insights for own reports" ON insights
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = insights.report_id
      AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert insights" ON insights
  FOR INSERT WITH CHECK (true); -- Allow service role to insert

-- Annotations policies
CREATE POLICY "Users can view annotations for own reports" ON annotations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = annotations.report_id
      AND reports.user_id = auth.uid()
    )
  );

CREATE POLICY "Service can insert annotations" ON annotations
  FOR INSERT WITH CHECK (true); -- Allow service role to insert

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();