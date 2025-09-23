-- Data Sanity App - Schema Update for Report History
-- Run this in your Supabase SQL Editor

-- Add new columns to reports table for better tracking
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS document_name TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('csv', 'excel', 'google_sheet')) DEFAULT 'csv';

-- Create user_subscription table for premium features
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('free', 'premium')) DEFAULT 'free',
  reports_limit INTEGER DEFAULT 5, -- Free users get 5 reports
  reports_used INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE -- For premium subscriptions
);

-- Create index for subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);

-- Enable RLS for subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscription policies
CREATE POLICY "Users can view own subscription" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription" ON user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service can manage subscriptions" ON user_subscriptions
  FOR ALL USING (true); -- Allow service role to manage

-- Add updated_at trigger for subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_subscriptions (user_id, plan_type, reports_limit, reports_used)
  VALUES (NEW.id, 'free', 5, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create subscription when user signs up
CREATE TRIGGER create_user_subscription_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Function to check if user can create new report
CREATE OR REPLACE FUNCTION can_create_report(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  subscription_record user_subscriptions%ROWTYPE;
  completed_reports_count INTEGER;
BEGIN
  -- Get user subscription
  SELECT * INTO subscription_record
  FROM user_subscriptions
  WHERE user_id = user_uuid
  LIMIT 1;

  -- If no subscription found, create default
  IF NOT FOUND THEN
    INSERT INTO user_subscriptions (user_id, plan_type, reports_limit, reports_used)
    VALUES (user_uuid, 'free', 5, 0)
    RETURNING * INTO subscription_record;
  END IF;

  -- Count completed reports for this user
  SELECT COUNT(*) INTO completed_reports_count
  FROM reports
  WHERE user_id = user_uuid
  AND status = 'complete';

  -- Check if user can create more reports
  IF subscription_record.plan_type = 'premium' THEN
    RETURN TRUE; -- Premium users have unlimited reports
  ELSE
    RETURN completed_reports_count < subscription_record.reports_limit;
  END IF;
END;
$$ LANGUAGE plpgsql;