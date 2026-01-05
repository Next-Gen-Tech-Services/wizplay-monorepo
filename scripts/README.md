# Database Cleanup Scripts

This directory contains scripts to clean up the WizPlay database while preserving user accounts and authentication data.

## 🎯 What Gets Cleaned

### ✅ PRESERVED DATA
- User accounts (`users` table)
- User authentication data  
- Referral relationships
- Wallet structures (but not transaction history)
- **Matches and tournaments** - All match and tournament data is preserved
- **Match schedules and basic match information**

### 🧹 CLEANED DATA
- **Live Match Data**: Real-time match events, live states, temporary match data
- **Contest Service**: Contests, questions, user submissions, contest entries, prizes  
- **Coupon Service**: Coupons and user coupon usage
- **Notification Service**: All notifications and templates
- **Wallet Service**: Transaction history (balances optionally reset)
- **User Service**: User wishlists

## 📁 Files

- `cleanup.sh` - Main shell script (recommended)
- `database-cleanup.js` - Node.js implementation  
- `database-cleanup.sql` - Raw SQL script
- `package.json` - Dependencies for Node.js script

## 🚀 Quick Start

### Method 1: Shell Script (Recommended)

```bash
# Navigate to scripts directory
cd /path/to/wizplay-monorepo/scripts

# Preview what would be cleaned (safe)
./cleanup.sh --dry-run

# Clean with confirmation prompt
./cleanup.sh

# Clean without confirmation (be careful!)
./cleanup.sh --confirm
```

### Method 2: Node.js Script

```bash
cd scripts

# Install dependencies
npm install

# Preview changes
npm run cleanup:dry

# Clean with confirmation
npm run cleanup

# Clean without confirmation  
npm run cleanup:confirm
```

### Method 3: Direct SQL

```bash
# Connect to each database and run the SQL script
psql -h localhost -U postgres -d wizplay_matches -f database-cleanup.sql
psql -h localhost -U postgres -d wizplay_contests -f database-cleanup.sql
# ... repeat for other databases
```

## ⚙️ Configuration

### Environment Variables

Set these environment variables to configure database connections:

```bash
# Database connection (applies to all services)
export DB_HOST=localhost
export DB_PORT=5432  
export DB_USER=postgres
export DB_PASSWORD=your_password

# Service-specific overrides (optional)
export AUTH_DB_HOST=auth-db-host
export USER_DB_HOST=user-db-host  
export MATCH_DB_HOST=match-db-host
export CONTEST_DB_HOST=contest-db-host
export COUPON_DB_HOST=coupon-db-host
export NOTIFICATION_DB_HOST=notification-db-host
export WALLET_DB_HOST=wallet-db-host
```

### Database Names

The script assumes these database names (configurable in the scripts):

- `wizplay_auth` - Authentication service
- `wizplay_users` - User management  
- `wizplay_matches` - Match data
- `wizplay_contests` - Contest data
- `wizplay_coupons` - Coupon system
- `wizplay_notifications` - Notifications
- `wizplay_wallet` - Wallet/transactions

## 🛡️ Safety Features

### Dry Run Mode
Always test first with `--dry-run` to see what would be cleaned:

```bash
./cleanup.sh --dry-run
```

### Confirmation Prompts
By default, the script asks for confirmation before making changes.

### Foreign Key Handling
The scripts temporarily disable foreign key constraints during cleanup to avoid constraint violations.

### Error Handling
- Continues with other databases if one fails to connect
- Provides detailed error messages
- Logs all operations

## 📊 Output Example

```
🗂️  WizPlay Database Cleanup Script
=====================================

🔌 Connecting to databases...

✅ Connected to match_service (wizplay_matches)  
✅ Connected to contest_service (wizplay_contests)
✅ Connected to user_service (wizplay_users)

📊 Pre-cleanup Database Statistics:

📁 MATCH_SERVICE:
   match_live_events: 15,678 rows
   match_live_states: 1,234 rows
   live_match_data: 567 rows
   wishlists: 890 rows
   TOTAL: 18,369 rows
   
   PRESERVED: 
   matches: 1,245 rows (preserved)
   tournaments: 89 rows (preserved)

📁 CONTEST_SERVICE:
   contests: 567 rows
   questions: 2,134 rows
   user_contests: 45,789 rows
   user_submissions: 123,456 rows
   TOTAL: 171,946 rows

🧹 Starting cleanup...

🗂️  Cleaning match_service:
✅ Cleaned match_service.match_live_events (15,678 rows deleted)
✅ Cleaned match_service.match_live_states (1,234 rows deleted)
✅ Cleaned match_service.live_match_data (567 rows deleted)
✅ Cleaned match_service.wishlists (890 rows deleted)
   Service total: 18,369 rows
   
   PRESERVED: matches (1,245 rows), tournaments (89 rows)

🗂️  Cleaning contest_service:
✅ Cleaned contest_service.user_submissions (123,456 rows deleted)
✅ Cleaned contest_service.user_contests (45,789 rows deleted)
✅ Cleaned contest_service.questions (2,134 rows deleted)  
✅ Cleaned contest_service.contests (567 rows deleted)
   Service total: 171,946 rows

============================================================
📋 CLEANUP SUMMARY
============================================================
✅ Successfully cleaned 188,958 total rows

PRESERVED DATA:
- ✅ User accounts
- ✅ User authentication data
- ✅ Referral relationships
- ✅ User wallets (structure)
- ✅ Matches and tournaments

CLEANED DATA:  
- 🧹 Live match events and temporary data
- 🧹 Contests and questions
- 🧹 User submissions and contest entries
- 🧹 Coupons and user coupons
- 🧹 Notifications
- 🧹 Wallet transactions
- 🧹 User wishlists
============================================================

✅ Cleanup completed successfully!
```

## ⚠️ Important Notes

1. **Backup First**: Always backup your database before running cleanup
2. **Test Environment**: Run on staging/test environment first  
3. **Downtime**: Consider application downtime during cleanup
4. **Dependencies**: Ensure all application services are stopped
5. **Verification**: Check application functionality after cleanup

## 🔧 Troubleshooting

### Connection Issues
```bash
# Test database connectivity
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -l
```

### Permission Issues  
```bash
# Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE wizplay_matches TO your_user;
```

### Node.js Issues
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📞 Support

If you encounter issues:

1. Check database connectivity
2. Verify environment variables
3. Review error messages in the output  
4. Run in dry-run mode to diagnose
5. Check database permissions

For additional help, consult the application documentation or contact the development team.