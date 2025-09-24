-- Fix user signup issue by removing problematic trigger
-- Run this in your Supabase SQL Editor

-- Drop the problematic trigger that's causing signup failures
DROP TRIGGER IF EXISTS create_user_subscription_trigger ON auth.users;

-- Drop the function as well
DROP FUNCTION IF EXISTS create_default_subscription();

-- The subscription will now be created by the application code
-- when the user first visits /api/user/subscription
-- This prevents signup failures while maintaining functionality