-- Database Cleanup SQL Script
-- This script cleans up all application data while preserving user accounts AND match/tournament data
-- 
-- USAGE:
-- Execute this against each service database OR adjust connection details
-- 
-- PRESERVED:
-- - users (user_service)
-- - referrals (user_service) 
-- - user authentication data (auth_service)
-- - wallet structures (wallet_service)
-- - matches and tournaments (match_service)
--
-- CLEANED:
-- - Contest participation and submission data
-- - Live match events and states
-- - Notifications and coupons

-- =============================================================================
-- MATCH SERVICE CLEANUP
-- =============================================================================

-- Disable foreign key checks temporarily
SET session_replication_role = replica;

-- Clean live match data and events (temporary/real-time data)
TRUNCATE TABLE match_live_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE match_live_states RESTART IDENTITY CASCADE;
TRUNCATE TABLE live_match_data RESTART IDENTITY CASCADE;

-- Clean wishlists (these reference matches but we preserve the matches)
TRUNCATE TABLE wishlists RESTART IDENTITY CASCADE;

-- PRESERVE matches and tournaments - commented out the cleanup
-- TRUNCATE TABLE matches RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE tournaments RESTART IDENTITY CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- =============================================================================
-- CONTEST SERVICE CLEANUP  
-- =============================================================================

SET session_replication_role = replica;

-- Clean contest participation data
TRUNCATE TABLE user_submissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE user_contests RESTART IDENTITY CASCADE;

-- Clean contest configuration
TRUNCATE TABLE contest_prizes RESTART IDENTITY CASCADE;
TRUNCATE TABLE questions RESTART IDENTITY CASCADE;
TRUNCATE TABLE contests RESTART IDENTITY CASCADE;

SET session_replication_role = DEFAULT;

-- =============================================================================
-- COUPON SERVICE CLEANUP
-- =============================================================================

SET session_replication_role = replica;

-- Clean coupon usage and coupons
TRUNCATE TABLE user_coupons RESTART IDENTITY CASCADE;
TRUNCATE TABLE coupons RESTART IDENTITY CASCADE;

SET session_replication_role = DEFAULT;

-- =============================================================================
-- NOTIFICATION SERVICE CLEANUP
-- =============================================================================

SET session_replication_role = replica;

-- Clean all notifications
TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;
-- Optional: Keep templates for reuse
-- TRUNCATE TABLE notification_templates RESTART IDENTITY CASCADE;

SET session_replication_role = DEFAULT;

-- =============================================================================
-- WALLET SERVICE CLEANUP
-- =============================================================================

SET session_replication_role = replica;

-- Clean transaction history but keep wallet structures
TRUNCATE TABLE wallet_transactions RESTART IDENTITY CASCADE;

-- Reset wallet balances to zero (optional - or delete the line below to preserve balances)
UPDATE wallet_balances SET balance = 0.00, updated_at = NOW() WHERE balance != 0.00;

SET session_replication_role = DEFAULT;

-- =============================================================================
-- USER SERVICE CLEANUP (Selective)
-- =============================================================================

SET session_replication_role = replica;

-- Clean user wishlists (keep user accounts and referrals)
TRUNCATE TABLE wishlists RESTART IDENTITY CASCADE;

-- Optional: Reset user stats/counters (uncomment if needed)
-- UPDATE users SET 
--   total_contests_played = 0,
--   total_winnings = 0.00,
--   last_active_at = NOW()
-- WHERE total_contests_played > 0 OR total_winnings > 0.00;

SET session_replication_role = DEFAULT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check remaining data counts
SELECT 
  'live_match_data' as table_name, 
  COUNT(*) as remaining_rows 
FROM live_match_data
UNION ALL
SELECT 'match_live_events', COUNT(*) FROM match_live_events
UNION ALL
SELECT 'match_live_states', COUNT(*) FROM match_live_states
UNION ALL
SELECT 'contests', COUNT(*) FROM contests
UNION ALL
SELECT 'questions', COUNT(*) FROM questions  
UNION ALL
SELECT 'user_contests', COUNT(*) FROM user_contests
UNION ALL
SELECT 'user_submissions', COUNT(*) FROM user_submissions
UNION ALL
SELECT 'coupons', COUNT(*) FROM coupons
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'wallet_transactions', COUNT(*) FROM wallet_transactions
ORDER BY table_name;

-- Check preserved data
SELECT 
  'users' as table_name,
  COUNT(*) as preserved_rows
FROM users  
UNION ALL
SELECT 'referrals', COUNT(*) FROM referrals
UNION ALL  
SELECT 'wallets', COUNT(*) FROM wallets
UNION ALL
SELECT 'matches', COUNT(*) FROM matches
UNION ALL
SELECT 'tournaments', COUNT(*) FROM tournaments
ORDER BY table_name;

-- =============================================================================
-- RESET SEQUENCES (if needed)
-- =============================================================================

-- Uncomment if you need to reset auto-increment IDs to 1
-- ALTER SEQUENCE matches_id_seq RESTART WITH 1;
-- ALTER SEQUENCE tournaments_id_seq RESTART WITH 1;
-- ALTER SEQUENCE contests_id_seq RESTART WITH 1;
-- ALTER SEQUENCE questions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE coupons_id_seq RESTART WITH 1;
-- ALTER SEQUENCE notifications_id_seq RESTART WITH 1;